import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as piSdk from '@earendil-works/pi-coding-agent';
import {
  endpointKey,
  getPriceStatus,
  hasPriceAdapter,
  loadPriceCache,
  refreshOfficialPrices,
  resolveUsageCost,
} from './prices.js';
import { chooseInitialModel } from './default-models.js';
import { createDaemon, loadWorkflows } from './daemon.js';
import { summarizeDay } from './runner.js';
import { shrinkToolImages } from './images.js';

const {
  DefaultResourceLoader,
  ModelRegistry,
  SessionManager,
  SettingsManager,
  createAgentSession,
  getAgentDir,
  resizeImage,
} = piSdk;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '127.0.0.1';
const CWD = process.cwd();

// Uploaded attachments live inside the agent's working directory so the model
// can also reach them through the normal read/bash tools.
const UPLOAD_DIR = path.resolve(CWD, '.fidere', 'uploads');
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
// What one message may carry into a request. Every turn resends these images,
// so the ceiling is the request body, not the disk. 4 x 1 MB keeps the body
// under ~5.5 MB even when all four go inline.
const MAX_IMAGE_BYTES = 1024 * 1024;
const MAX_IMAGES_PER_MESSAGE = 4;
const TEXT_INLINE_LIMIT = 80_000;
try {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
} catch (err) {
  console.warn(`Could not create upload directory ${UPLOAD_DIR}: ${err.message}`);
}

// ── Keep-awake (macOS) ─────────────────────────────────────────────────────
// Long agent turns can outlive the idle sleep timer and lose their network
// connections. While at least one prompt stream is active, hold a caffeinate
// assertion so macOS stays awake. Set FIDERE_KEEP_AWAKE=0 to disable.
const KEEP_AWAKE_ENABLED = process.platform === 'darwin' && process.env.FIDERE_KEEP_AWAKE !== '0';
let activeKeepAwakeTasks = 0;
let keepAwakeProcess = null;

function startKeepAwake() {
  if (!KEEP_AWAKE_ENABLED) return;
  activeKeepAwakeTasks += 1;
  if (keepAwakeProcess) return;

  try {
    // -i: prevent idle system sleep, -m: prevent disk sleep, -s: prevent
    // system sleep while on AC power.
    keepAwakeProcess = spawn('caffeinate', ['-ims'], { stdio: 'ignore' });
    keepAwakeProcess.on('error', () => { keepAwakeProcess = null; });
    keepAwakeProcess.on('exit', () => { keepAwakeProcess = null; });
  } catch {
    keepAwakeProcess = null;
  }
}

function stopKeepAwake() {
  if (!KEEP_AWAKE_ENABLED) return;
  activeKeepAwakeTasks = Math.max(0, activeKeepAwakeTasks - 1);
  if (activeKeepAwakeTasks > 0 || !keepAwakeProcess) return;

  const proc = keepAwakeProcess;
  keepAwakeProcess = null;
  try { proc.kill('SIGTERM'); } catch {}
}

process.on('exit', () => {
  try { keepAwakeProcess?.kill('SIGTERM'); } catch {}
});

// ── Auth & Model Registry ──────────────────────────────────────────────────
const MODELS_FILE = path.join(os.homedir(), '.pi', 'agent', 'models.json');

function modelsFileMtime() {
  try { return fs.statSync(MODELS_FILE).mtimeMs; } catch { return 0; }
}

// pi-coding-agent 1.x replaced AuthStorage with ModelRuntime; 0.x used
// AuthStorage + ModelRegistry.create(). Support both so the server can be
// upgraded (or rolled back) without a flag day.
let modelRuntime = null;
let authStorage = null;
let modelRegistry;

if (typeof piSdk.ModelRuntime === 'function') {
  modelRuntime = await piSdk.ModelRuntime.create();
  modelRegistry = new ModelRegistry(modelRuntime);
} else {
  authStorage = piSdk.AuthStorage.create();
  modelRegistry = ModelRegistry.create(authStorage);
}

let modelRegistryMtime = modelsFileMtime();
let modelRefreshPromise = null;

// Vendor prices (per million tokens) cached per call endpoint. The cache is
// loaded synchronously so the first request already gets last session's
// prices; network checks run in the background at startup.
loadPriceCache();

// models.json can change while the web server is running (new cloud models,
// capability fixes, etc.). Reload when the file's mtime changes so the
// `/model` picker does not stay stale until a full server restart.
function refreshModelRegistry() {
  const mtime = modelsFileMtime();
  if (mtime !== modelRegistryMtime) {
    if (modelRuntime) {
      if (!modelRefreshPromise) {
        const targetMtime = mtime;
        modelRefreshPromise = modelRuntime.refresh()
          .then(() => { modelRegistryMtime = targetMtime; })
          .catch((err) => {
            console.warn(`Could not refresh models.json: ${err.message}`);
          })
          .finally(() => { modelRefreshPromise = null; });
      }
    } else {
      modelRegistry = ModelRegistry.create(authStorage);
      modelRegistryMtime = mtime;
    }
  }
  return modelRegistry;
}

// The loader is the SDK's own discovery (project skills, extensions, prompts)
// plus one inline extension: `images.js` re-encodes any screenshot an agent
// reads down to a byte budget, so a day of UI debugging cannot grow the request
// body until the provider refuses it.
// One loader per working directory: AGENTS.md, project skills, prompts and
// extensions are discovered relative to a cwd, and a session opened from
// another project has to see that project's files, not this one's.
const agentResourceLoaders = new Map();

async function resourceLoaderForSession(cwd = CWD) {
  const key = path.resolve(cwd);
  if (agentResourceLoaders.has(key)) return agentResourceLoaders.get(key);
  const agentDir = getAgentDir();
  let loader;
  try {
    loader = new DefaultResourceLoader({
      cwd: key,
      agentDir,
      settingsManager: SettingsManager.create(key, agentDir),
      extensionFactories: [{ name: 'fidere-images', factory: shrinkToolImages }],
    });
    await loader.reload();
  } catch (err) {
    // Losing the image budget is bad; losing every session because of it is
    // worse. Fall back to the SDK's default loader.
    console.warn(`Could not load agent extensions for ${key}: ${err.message}`);
    loader = undefined;
  }
  agentResourceLoaders.set(key, loader);
  return loader;
}

async function sessionOptions(sessionManager) {
  const options = { sessionManager };
  if (modelRuntime) {
    options.modelRuntime = modelRuntime;
  } else {
    options.authStorage = authStorage;
    options.modelRegistry = modelRegistry;
  }
  let sessionCwd = CWD;
  try {
    sessionCwd = sessionManager.getCwd() || CWD;
  } catch {}
  const loader = await resourceLoaderForSession(sessionCwd);
  if (loader) options.resourceLoader = loader;
  return options;
}

// ── Default model for new sessions ─────────────────────────────────────────
// The SDK falls back to its hard-coded per-provider table when settings.json
// has no default (DeepSeek → the expensive, text-only deepseek-v4-pro). Read
// the saved default here and hand createAgentSession an explicit model when the
// SDK's own choice would be a bad first run.

function readSavedDefaultModel() {
  try {
    const settings = SettingsManager.create(CWD);
    const provider = settings.getDefaultProvider();
    const id = settings.getDefaultModel();
    if (provider && id) return { provider, id };
  } catch (err) {
    console.warn(`Could not read the default model from settings.json: ${err.message}`);
  }
  return null;
}

function defaultModelInfo(available) {
  const pick = chooseInitialModel(available, readSavedDefaultModel());
  if (!pick) return null;
  return {
    provider: pick.model.provider,
    id: pick.model.id,
    name: pick.model.name || pick.model.id,
    source: pick.source,
  };
}

/** Explicit model for a brand-new session, or undefined to let the SDK decide. */
async function initialSessionModel() {
  try {
    const available = await refreshModelRegistry().getAvailable();
    return chooseInitialModel(available, readSavedDefaultModel())?.model;
  } catch (err) {
    console.warn(`Could not resolve a default model: ${err.message}`);
    return undefined;
  }
}

// ── Active sessions pool ───────────────────────────────────────────────────
const activeSessions = new Map();

// Slash commands implemented by the web UI itself. Skills, prompt templates
// and extension commands are added per-session in /api/commands.
const WEB_BUILTIN_COMMANDS = [
  { name: 'model', description: 'Select a model', argumentProvider: 'models' },
  { name: 'skills', description: 'Browse skills and insert a skill command', argumentProvider: 'skills' },
  { name: 'prompts', description: 'Browse prompt templates', argumentProvider: 'prompts' },
  { name: 'new', description: 'Start a new chat session' },
  { name: 'resume', description: 'Switch to another session' },
  { name: 'compact', description: 'Compact the current session context' },
  { name: 'session', description: 'Show session information' },
  { name: 'abort', description: 'Stop the current response' },
  { name: 'help', description: 'Show all available commands' },
];

// ── MIME types ─────────────────────────────────────────────────────────────
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico':  'image/x-icon',
  '.webp': 'image/webp',
  '.gif':  'image/gif',
  '.bmp':  'image/bmp',
  '.pdf':  'application/pdf',
  '.txt':  'text/plain; charset=utf-8',
  '.md':   'text/markdown; charset=utf-8',
  '.csv':  'text/csv; charset=utf-8',
  '.yaml': 'text/yaml; charset=utf-8',
  '.yml':  'text/yaml; charset=utf-8',
  '.toml': 'text/plain; charset=utf-8',
  '.log':  'text/plain; charset=utf-8',
};

// ── Helpers ────────────────────────────────────────────────────────────────

function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch { resolve({}); }
    });
    req.on('error', () => resolve({}));
  });
}

function sendJSON(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

// ── Access control ─────────────────────────────────────────────────────────
// This server can run shell commands as the process user, so every API route
// reachable over the network must be authenticated. The UI gets an HttpOnly
// session cookie derived from the access token; scripts may send the raw token
// as a Bearer header instead. State-changing cookie requests must also echo a
// CSRF token (double submit): SameSite is a browser behaviour, not a guarantee,
// and Origin headers are trivially forged by non-browser clients.

const AUTH_DISABLED = String(process.env.FIDERE_AUTH || '').toLowerCase() === 'off';
const TOKEN_FILE = path.join(os.homedir(), '.pi', 'agent', 'fidere-token');
const SESSION_COOKIE = 'fidere_session';
const CSRF_COOKIE = 'fidere_csrf';
const SESSION_MAX_AGE = Number(process.env.FIDERE_SESSION_MAX_AGE) || 30 * 24 * 60 * 60;
const LOGIN_WINDOW_MS = 60_000;
const LOGIN_MAX_ATTEMPTS = 5;

function loadAccessToken() {
  const fromEnv = String(process.env.FIDERE_TOKEN || '').trim();
  if (fromEnv) return { token: fromEnv, source: 'FIDERE_TOKEN' };
  try {
    const stored = fs.readFileSync(TOKEN_FILE, 'utf8').trim();
    if (stored) return { token: stored, source: TOKEN_FILE };
  } catch {
    // No token yet: generate one below.
  }
  const token = randomBytes(32).toString('base64url');
  try {
    fs.mkdirSync(path.dirname(TOKEN_FILE), { recursive: true });
    fs.writeFileSync(TOKEN_FILE, `${token}\n`, { mode: 0o600 });
  } catch (err) {
    console.warn(`  ⚠️  Could not write ${TOKEN_FILE}: ${err.message}`);
  }
  return { token, source: TOKEN_FILE };
}

const ACCESS = AUTH_DISABLED ? { token: '', source: 'disabled' } : loadAccessToken();

// ── Scheduled tasks ─────────────────────────────────────────────────────────
// The daemon reads ./workflows and keeps its state under .fidere/. It runs in
// this process so there is no second service to start, but it never depends on
// the UI: closing the browser leaves the schedule alone.
const DATA_DIR = path.resolve(CWD, '.fidere');
const WORKFLOWS_DIR = path.resolve(CWD, 'workflows');
const LEDGER_PATH = path.join(DATA_DIR, 'ledger.jsonl');
const DAEMON_ENABLED = process.env.FIDERE_DAEMON !== 'off';

// ./workflows is a runtime directory: everything in it belongs to whoever is
// using this install. The sample therefore ships in templates/workflows, and it
// is copied in once on first start so the daemon has something to watch and the
// user has an example. Nothing under ./workflows is ever packaged or versioned.
const SHIPPED_WORKFLOWS = path.join(__dirname, 'templates', 'workflows');

function ensureWorkflowsDir() {
  if (fs.existsSync(WORKFLOWS_DIR)) return;
  try {
    fs.mkdirSync(WORKFLOWS_DIR, { recursive: true });
    if (!fs.existsSync(SHIPPED_WORKFLOWS)) return;
    for (const name of fs.readdirSync(SHIPPED_WORKFLOWS)) {
      fs.cpSync(path.join(SHIPPED_WORKFLOWS, name), path.join(WORKFLOWS_DIR, name), { recursive: true });
    }
    console.log(`  Created ${WORKFLOWS_DIR} with the sample workflow.`);
  } catch (err) {
    console.warn(`  ⚠️  Could not create ${WORKFLOWS_DIR}: ${err.message}`);
  }
}
ensureWorkflowsDir();

const daemon = createDaemon({ root: CWD });
const SESSION_VALUE = ACCESS.token
  ? createHmac('sha256', ACCESS.token).update('fidere-session-v1').digest('base64url')
  : '';
const CSRF_VALUE = ACCESS.token
  ? createHmac('sha256', ACCESS.token).update('fidere-csrf-v1').digest('base64url')
  : '';

function safeEqual(left, right) {
  const a = Buffer.from(String(left ?? ''));
  const b = Buffer.from(String(right ?? ''));
  return a.length > 0 && a.length === b.length && timingSafeEqual(a, b);
}

function readCookie(req, name) {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const pair of header.split(';')) {
    const eq = pair.indexOf('=');
    if (eq < 0) continue;
    if (pair.slice(0, eq).trim() !== name) continue;
    try { return decodeURIComponent(pair.slice(eq + 1).trim()); } catch { return null; }
  }
  return null;
}

// The proxy terminates TLS, so the Node side only sees http. Trust
// X-Forwarded-Proto for the Secure flag, otherwise browsers silently drop the
// cookie and the login loop never ends.
function secureCookieSuffix(req) {
  const mode = String(process.env.FIDERE_COOKIE_SECURE || 'auto').toLowerCase();
  const forwarded = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase();
  const secure = mode === 'on' || (mode !== 'off' && (Boolean(req.socket.encrypted) || forwarded === 'https'));
  return secure ? '; Secure' : '';
}

function hasBearerToken(req) {
  const header = String(req.headers.authorization || '');
  return header.toLowerCase().startsWith('bearer ') && safeEqual(header.slice(7).trim(), ACCESS.token);
}

function isAuthenticated(req) {
  if (AUTH_DISABLED) return true;
  if (hasBearerToken(req)) return true;
  return safeEqual(readCookie(req, SESSION_COOKIE), SESSION_VALUE);
}

function csrfValid(req) {
  if (AUTH_DISABLED || hasBearerToken(req)) return true;
  return safeEqual(req.headers['x-csrf-token'], readCookie(req, CSRF_COOKIE));
}

function sendAuthCookies(req, res) {
  const secure = secureCookieSuffix(req);
  const age = `; Max-Age=${SESSION_MAX_AGE}`;
  res.setHeader('Set-Cookie', [
    `${SESSION_COOKIE}=${SESSION_VALUE}; Path=/; HttpOnly; SameSite=Strict${age}${secure}`,
    `${CSRF_COOKIE}=${CSRF_VALUE}; Path=/; SameSite=Strict${age}${secure}`,
  ]);
}

function clientAddress(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '')
    .split(',').map((part) => part.trim()).filter(Boolean);
  return forwarded.length > 0 ? forwarded[forwarded.length - 1] : (req.socket.remoteAddress || 'unknown');
}

const loginFailures = new Map();
const authLogThrottle = new Map();

function loginBlocked(req) {
  const entry = loginFailures.get(clientAddress(req));
  return Boolean(entry && entry.count >= LOGIN_MAX_ATTEMPTS && Date.now() <= entry.resetAt);
}

function recordLoginFailure(req) {
  const key = clientAddress(req);
  const now = Date.now();
  const entry = loginFailures.get(key);
  if (!entry || now > entry.resetAt) loginFailures.set(key, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
  else entry.count += 1;
  if (loginFailures.size > 500) {
    for (const [candidate, value] of loginFailures) {
      if (now > value.resetAt) loginFailures.delete(candidate);
    }
  }
}

function logAuthFailure(req, pathname) {
  // Scanners hit every path; keep one line per address per 5s instead of a
  // flood that buries real events.
  const key = clientAddress(req);
  const now = Date.now();
  if ((authLogThrottle.get(key) || 0) > now - 5000) return;
  if (authLogThrottle.size > 500) authLogThrottle.clear();
  authLogThrottle.set(key, now);
  console.warn(`  [auth] rejected ${req.method} ${pathname} from ${key}`);
}

// ── Attachment helpers ─────────────────────────────────────────────────────
const IMAGE_MIME = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);
const TEXT_EXT = new Set([
  'txt', 'md', 'markdown', 'json', 'jsonc', 'js', 'mjs', 'cjs', 'jsx', 'ts', 'tsx',
  'css', 'scss', 'less', 'html', 'htm', 'xml', 'svg', 'yaml', 'yml', 'toml', 'ini',
  'cfg', 'conf', 'env', 'csv', 'tsv', 'log', 'py', 'rb', 'go', 'rs', 'java', 'kt',
  'c', 'h', 'cc', 'cpp', 'hpp', 'cs', 'php', 'sh', 'bash', 'zsh', 'fish', 'sql',
  'graphql', 'gql', 'vue', 'svelte', 'tex', 'rst', 'diff', 'patch',
]);

function sniffImageMime(buffer) {
  if (!buffer || buffer.length < 12) return null;
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47 &&
      buffer[4] === 0x0d && buffer[5] === 0x0a && buffer[6] === 0x1a && buffer[7] === 0x0a) return 'image/png';
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.toString('ascii', 0, 4) === 'GIF8') return 'image/gif';
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  if (buffer[0] === 0x42 && buffer[1] === 0x4d) return 'image/bmp';
  return null;
}

function sanitizeFileName(name) {
  const base = path.basename(String(name || 'attachment')).replace(/[\x00-\x1f<>:"/\\|?*]/g, '_').replace(/^\.+/, '').trim();
  return (base || 'attachment').slice(0, 120);
}

function mimeForName(name) {
  const ext = path.extname(name).slice(1).toLowerCase();
  return MIME['.' + ext] || (TEXT_EXT.has(ext) ? 'text/plain; charset=utf-8' : 'application/octet-stream');
}

function isTextAttachment(buffer, mimeType, name) {
  if (!buffer || buffer.includes(0)) return false;
  const ext = path.extname(name).slice(1).toLowerCase();
  const mime = String(mimeType || '').split(';')[0].trim().toLowerCase();
  if (TEXT_EXT.has(ext)) return true;
  if (mime === 'image/svg+xml' || mime.startsWith('text/') || mime === 'application/json' ||
      mime === 'application/xml' || mime === 'application/javascript' || mime === 'application/x-javascript' ||
      mime === 'application/x-yaml' || mime === 'application/yaml') return true;
  return false;
}

function readRawBody(req, limit = MAX_UPLOAD_BYTES) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let tooLarge = false;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        tooLarge = true;
        chunks.length = 0;
        return;
      }
      if (!tooLarge) chunks.push(chunk);
    });
    req.on('end', () => {
      if (tooLarge) reject(new Error('File too large'));
      else resolve(Buffer.concat(chunks));
    });
    req.on('error', reject);
  });
}

/** Sort key from an isoTime() value; unparseable dates sort last. */
function timestamp(iso) {
  if (!iso) return 0;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? 0 : ms;
}

// Coerce whatever a session listing hands back (Date, epoch ms, ISO string)
// into an ISO string, so the browser always has something parseable.
function isoTime(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  if (typeof value === 'number') return Number.isFinite(value) ? new Date(value).toISOString() : null;
  if (typeof value === 'string' && value) {
    const ms = Date.parse(value);
    return Number.isNaN(ms) ? null : new Date(ms).toISOString();
  }
  return null;
}

function stripAttachmentMarkers(text) {
  return String(text || '')
    .replace(/<fidere-attachments>[\s\S]*?<\/fidere-attachments>/g, '')
    .replace(/\[Attached files\][\s\S]*?\[End attachments\]/g, '')
    .replace(/<fidere-content\b[\s\S]*?<\/fidere-content>/g, '')
    .replace(/<!--fidere-attachments:[\s\S]*?-->/g, '')
    .replace(/<!--fidere-content:[\s\S]*?-->[\s\S]*?<!--\/fidere-content:[\s\S]*?-->/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function serveStatic(res, urlPath) {
  // Security: prevent directory traversal
  const publicDir = path.resolve(path.join(__dirname, 'public'));
  let filePath = path.join(publicDir, urlPath === '/' ? 'index.html' : urlPath);
  filePath = path.resolve(filePath);

  if (!filePath.startsWith(publicDir)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  const ext = path.extname(filePath);
  fs.readFile(filePath, (err, data) => {
    if (err) {
      // SPA fallback: serve index.html for non-file routes
      fs.readFile(path.join(publicDir, 'index.html'), (err2, data2) => {
        if (err2) { res.writeHead(404); res.end('Not Found'); return; }
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-cache',
        });
        res.end(data2);
      });
      return;
    }
    // No ETag/Last-Modified is sent, so heuristic caching would silently pin
    // a stale app.js/style.css in the browser after an edit. Force a
    // conditional-free revalidation on every load instead.
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  });
}

function blockToText(block) {
  if (!block) return '';
  if (typeof block === 'string') return block;
  if (block.type === 'text') return String(block.text || '');
  if (block.type === 'image') return '[image]';
  if (typeof block.text === 'string') return block.text;
  return '';
}

// The image blocks of a tool result, kept whole. `read` returns a screenshot as
// a content block, so a transcript that only ran extractToolOutput() showed
// "[image]" and nothing else: the picture was in the message the whole time and
// never reached the browser.
function extractToolImages(result) {
  const blocks = Array.isArray(result?.content) ? result.content
    : Array.isArray(result) ? result : [];
  const out = [];
  for (const block of blocks){
    if (!block || block.type !== 'image' || typeof block.data !== 'string') continue;
    const mimeType = block.mimeType || block.source?.mediaType || 'image/png';
    out.push({ mimeType, data: block.data, dataUrl: `data:${mimeType};base64,${block.data}` });
  }
  return out;
}

// Extract readable text from a tool result. The agent emits results as
// { content: [{ type: 'text', text }], details }, while older/other shapes
// may be a string, an array of blocks, or { output }.
function extractToolOutput(result) {
  if (result == null) return '';
  if (typeof result === 'string') return result;
  if (Array.isArray(result)) {
    return result.map(blockToText).filter(Boolean).join('\n');
  }
  if (Array.isArray(result.content)) {
    return result.content.map(blockToText).filter(Boolean).join('\n');
  }
  if (typeof result.text === 'string') return result.text;
  if (typeof result.output === 'string') return result.output;
  try {
    return JSON.stringify(result, null, 2);
  } catch {
    return String(result);
  }
}

// Every model is priced by the endpoint it is actually called through. A model
// routed to api.deepseek.com uses DeepSeek's official prices; a model routed to
// a proxy uses that provider's own models.json cost.
function endpointForMessage(message) {
  const provider = message?.provider;
  if (!provider) return null;
  for (const modelId of [message?.responseModel, message?.model]) {
    if (!modelId) continue;
    try {
      const model = modelRegistry.find(provider, modelId);
      const key = endpointKey(model?.baseUrl);
      if (key) return key;
    } catch {}
  }
  return null;
}

// Endpoint -> model ids, so per-model adapters (Aliyun docs pages) know which
// pages to fetch.
function priceEndpoints() {
  const endpoints = new Map();
  for (const model of modelRegistry.getAvailable()) {
    const key = endpointKey(model?.baseUrl);
    if (!key) continue;
    if (!endpoints.has(key)) endpoints.set(key, new Set());
    endpoints.get(key).add(model.id);
  }
  return endpoints;
}

// Convert AgentMessage to a frontend-friendly format
function formatUsage(usage, message = null) {
  if (!usage || typeof usage !== 'object') return null;
  const endpoint = endpointForMessage(message);
  // Prefer the model actually used, but fall back to the requested id when a
  // provider appends a dated suffix that the price table does not carry.
  const official = endpoint
    ? resolveUsageCost(
      usage,
      endpoint,
      [message?.responseModel, message?.model].filter(Boolean),
      message?.timestamp ?? null,
    )
    : null;
  return {
    input: Number(usage.input) || 0,
    output: Number(usage.output) || 0,
    cacheRead: Number(usage.cacheRead) || 0,
    cacheWrite: Number(usage.cacheWrite) || 0,
    reasoning: Number(usage.reasoning) || 0,
    totalTokens: Number(usage.totalTokens) || 0,
    cost: official ? official.cost : (typeof usage.cost === 'number'
      ? usage.cost
      : Number(usage.cost?.total) || 0),
    currency: official?.currency || 'USD',
    priceSource: official?.source || 'local',
    pricePeriod: official?.period || null,
  };
}

function formatMessages(messages, entryIdByMessage = null) {
  const result = [];
  const toolCallsById = new Map();
  for (const msg of messages) {
    if (!msg || !msg.role) continue;
    const role = msg.role;

    // The system prompt carries its text in `sections`, never in `content`. It
    // is not a turn, and rendering it as one put an empty "F" bubble at the top
    // of every reloaded session.
    if (role === 'system') continue;

    // A compaction (or branch) snapshot keeps its text in `summary`, so it used
    // to arrive as a second empty bubble. Forward it under its own role and
    // carry the text through, so the UI can render a card instead of a blank.
    if (role === 'compactionSummary' || role === 'branchSummary') {
      result.push({
        id: msg.id || crypto.randomUUID(),
        entryId: entryIdByMessage?.get(msg) || null,
        role: 'summary',
        kind: role === 'branchSummary' ? 'branch' : 'compaction',
        content: '',
        summary: typeof msg.summary === 'string' ? msg.summary : '',
        tokensBefore: Number(msg.tokensBefore) || 0,
        toolCalls: [],
        thinking: '',
        images: [],
        usage: null,
        timestamp: msg.timestamp || new Date().toISOString(),
      });
      continue;
    }
    let content = '';
    let toolCalls = [];
    let thinking = '';
    let images = [];

    // Tool results are separate messages in the agent's message list. Merge
    // them into the assistant tool call so reloaded sessions render the same
    // tool blocks as live streaming.
    if (role === 'toolResult') {
      const tc = msg.toolCallId ? toolCallsById.get(msg.toolCallId) : null;
      if (tc) {
        tc.result = extractToolOutput({ content: msg.content });
        tc.images = extractToolImages({ content: msg.content });
        tc.isError = Boolean(msg.isError);
      }
      continue;
    }

    if (typeof msg.content === 'string') {
      content = msg.content;
    } else if (Array.isArray(msg.content)) {
      for (const block of msg.content) {
        if (block.type === 'text') {
          content += block.text;
        } else if (block.type === 'toolCall' || block.type === 'tool_use') {
          const tc = {
            id: block.id,
            name: block.name,
            input: block.arguments ?? block.input ?? {},
            result: null,
            images: [],
            isError: false,
          };
          toolCalls.push(tc);
          if (tc.id) toolCallsById.set(tc.id, tc);
        } else if (block.type === 'tool_result') {
          // Attach result to the matching tool call
          const tc = toolCalls.find(t => t.id === block.tool_use_id);
          if (tc) {
            tc.result = extractToolOutput(block.content);
            tc.isError = block.is_error || false;
          }
        } else if (block.type === 'thinking') {
          thinking += block.thinking || '';
        } else if (block.type === 'image') {
          const data = block.data || block.source?.data;
          const mimeType = block.mimeType || block.source?.mediaType;
          if (data && mimeType) {
            images.push({ mimeType, data, dataUrl: `data:${mimeType};base64,${data}` });
          }
        }
      }
    }

    result.push({
      id: msg.id || crypto.randomUUID(),
      entryId: entryIdByMessage?.get(msg) || null,
      role,
      content: content.trim(),
      toolCalls,
      thinking: thinking.trim(),
      images,
      usage: formatUsage(msg.usage, msg),
      timestamp: msg.timestamp || new Date().toISOString(),
    });
  }
  return result;
}

// ── Session helpers ────────────────────────────────────────────────────────

// ── Session discovery ──────────────────────────────────────────────────────
// pi keeps sessions in ~/.pi/agent/sessions/<encoded-cwd>/, so listing only the
// current directory hid every conversation started somewhere else. Fidere is a
// single workspace over all of them: the sidebar shows every session the user
// has, and each one runs in the directory it was started in.
async function listAllSessions() {
  try {
    return await SessionManager.listAll();
  } catch (err) {
    // One unreadable file in an unrelated project must not empty the sidebar.
    console.warn(`Could not list sessions across projects: ${err.message}`);
    return await SessionManager.list(CWD);
  }
}

async function findSessionInfo(id) {
  if (!id) return undefined;
  const sessions = await listAllSessions();
  return sessions.find(s => s.id === id);
}

/** True when the directory a session was started in is still there. */
function sessionCwdExists(cwd) {
  if (!cwd) return true; // pre-cwd sessions inherit this process's cwd
  try {
    return fs.statSync(cwd).isDirectory();
  } catch {
    return false;
  }
}

async function getOrCreateSession(sessionId) {
  if (sessionId && activeSessions.has(sessionId)) {
    return activeSessions.get(sessionId);
  }
  // Create new
  const sm = SessionManager.create(CWD);
  const model = await initialSessionModel();
  const { session } = await createAgentSession({ ...(await sessionOptions(sm)), ...(model ? { model } : {}) });
  const id = session.sessionId;
  activeSessions.set(id, { session, sessionManager: sm, modelFallbackMessage: null });
  return activeSessions.get(id);
}

// `modelFallbackMessage` is what the SDK says when the model recorded in a
// session file no longer exists (or lost its credentials) and it silently picked
// another one. That replacement can be a much more expensive model, so the UI
// must be able to show it instead of letting the switch go unnoticed.
async function openSession(sessionPath) {
  let sm = SessionManager.open(sessionPath);
  // Sessions outlive the folders they were started in. Refusing to open one
  // whose cwd is gone would silently cut the history in half, so continue it
  // here instead of failing.
  const storedCwd = sm.getCwd();
  if (!sessionCwdExists(storedCwd)) {
    console.warn(`Session ${path.basename(sessionPath)} was started in ${storedCwd}, which no longer exists; continuing in ${CWD}`);
    sm = SessionManager.open(sessionPath, path.dirname(sessionPath), CWD);
  }
  const { session, modelFallbackMessage } = await createAgentSession(await sessionOptions(sm));
  const id = session.sessionId;
  activeSessions.set(id, { session, sessionManager: sm, modelFallbackMessage: modelFallbackMessage || null });
  return { id, modelFallbackMessage };
}

// ── Router ─────────────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  // The UI and API are same-origin. Do not add wildcard CORS headers here:
  // this server has no authentication and should not be callable by arbitrary
  // websites. Put a reverse proxy in front for cross-origin/remote use.
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');

  const url = new URL(req.url, `http://localhost:${PORT}`);
  const p = url.pathname;

  // ── Access control ───────────────────────────────────────────────────
  // Gate every API route. Static files stay public on purpose: the login
  // overlay needs the CSS and the module script to render at all.
  const isApiPath = p === '/api' || p.startsWith('/api/');
  if (isApiPath && p !== '/api/login') {
    if (!isAuthenticated(req)) {
      logAuthFailure(req, p);
      sendJSON(res, 401, { error: 'unauthorized' });
      return;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD' && !csrfValid(req)) {
      sendJSON(res, 403, { error: 'csrf check failed' });
      return;
    }
  }

  // ── API: Sign in ────────────────────────────────────────────────────
  if (p === '/api/login' && req.method === 'POST') {
    if (loginBlocked(req)) {
      sendJSON(res, 429, { error: 'too many attempts, try again later' });
      return;
    }
    if (Number(req.headers['content-length'] || 0) > 8192) {
      sendJSON(res, 413, { error: 'payload too large' });
      return;
    }
    const body = await parseBody(req);
    if (!safeEqual(String(body?.token || '').trim(), ACCESS.token)) {
      recordLoginFailure(req);
      console.warn(`  [auth] failed sign-in from ${clientAddress(req)}`);
      sendJSON(res, 401, { error: 'invalid token' });
      return;
    }
    loginFailures.delete(clientAddress(req));
    sendAuthCookies(req, res);
    sendJSON(res, 200, { ok: true });
    return;
  }

  // ── API: Session probe ──────────────────────────────────────────────
  if (p === '/api/auth' && req.method === 'GET') {
    sendJSON(res, 200, { authenticated: true, disabled: AUTH_DISABLED });
    return;
  }

  // ── API: Sign out ───────────────────────────────────────────────────
  if (p === '/api/logout' && req.method === 'POST') {
    res.setHeader('Set-Cookie', [
      `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`,
      `${CSRF_COOKIE}=; Path=/; SameSite=Strict; Max-Age=0`,
    ]);
    sendJSON(res, 200, { ok: true });
    return;
  }

  // ── API: Health ──────────────────────────────────────────────────────
  if (p === '/api/health' && req.method === 'GET') {
    const available = await refreshModelRegistry().getAvailable();
    sendJSON(res, 200, {
      status: 'ok',
      modelsAvailable: available.length,
      activeSessions: activeSessions.size,
      workflows: daemon.status().workflows.length,
    });
    return;
  }

  // ── API: Scheduled tasks ─────────────────────────────────────────────
  // The UI reads everything from here and never talks to the daemon directly,
  // so the same state is visible whether the page is open or not.
  if (p === '/api/tasks' && req.method === 'GET') {
    const status = daemon.status();
    const today = new Date().toISOString().slice(0, 10);
    sendJSON(res, 200, { ...status, enabled: DAEMON_ENABLED, today: summarizeDay(LEDGER_PATH, today) });
    return;
  }

  const taskRunMatch = p.match(/^\/api\/tasks\/([^/]+)\/run$/);
  if (taskRunMatch && req.method === 'POST') {
    const name = decodeURIComponent(taskRunMatch[1]);
    const entry = loadWorkflows(WORKFLOWS_DIR).find((w) => w.name === name);
    if (!entry) {
      sendJSON(res, 404, { error: `no workflow named ${name}` });
      return;
    }
    if (daemon.status().running) {
      sendJSON(res, 409, { error: 'a task is already running' });
      return;
    }
    // Answer immediately: a task can take minutes, and holding the request open
    // would turn a dropped browser tab into a failed run.
    void daemon.execute(entry, Date.now()).catch((err) => {
      console.warn(`  ⚠️  task ${name} failed: ${err.message}`);
    });
    sendJSON(res, 202, { started: name });
    return;
  }

  const taskLogMatch = p.match(/^\/api\/tasks\/([^/]+)\/runs$/);
  if (taskLogMatch && req.method === 'GET') {
    const name = decodeURIComponent(taskLogMatch[1]);
    const runs = [];
    try {
      for (const line of fs.readFileSync(LEDGER_PATH, 'utf8').split('\n')) {
        if (!line.trim()) continue;
        try {
          const row = JSON.parse(line);
          if (row.name === name) runs.push(row);
        } catch { /* skip a truncated line rather than failing the request */ }
      }
    } catch { /* no ledger yet */ }
    sendJSON(res, 200, { name, runs: runs.slice(-50).reverse() });
    return;
  }

  // ── API: List models ───────────────────────────────────────────────
  if (p === '/api/models' && req.method === 'GET') {
    try {
      const available = await refreshModelRegistry().getAvailable();
      const grouped = {};
      for (const m of available) {
        const provider = m.provider || 'unknown';
        if (!grouped[provider]) grouped[provider] = [];
        grouped[provider].push({
          id: m.id,
          name: m.name || m.id,
          reasoning: m.reasoning || false,
          input: m.input || ['text'],
          contextWindow: m.contextWindow || 128000,
          maxTokens: m.maxTokens || 16384,
          cost: m.cost || { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        });
      }
      sendJSON(res, 200, {
        models: available.length,
        defaultModel: defaultModelInfo(available),
        grouped,
        all: available.map(m => ({
          provider: m.provider,
          id: m.id,
          name: m.name || m.id,
          reasoning: m.reasoning || false,
          input: m.input || ['text'],
        })),
      });
    } catch (err) {
      sendJSON(res, 500, { error: err.message });
    }
    return;
  }

  // ── API: Set the default model for new sessions ─────────────────────
  if (p === '/api/models/default' && req.method === 'POST') {
    const body = await parseBody(req);
    const provider = String(body.provider || '');
    const modelId = String(body.modelId || '');
    if (!provider || !modelId) {
      sendJSON(res, 400, { error: 'provider and modelId are required' });
      return;
    }
    try {
      const model = refreshModelRegistry().find(provider, modelId);
      if (!model) {
        sendJSON(res, 404, { error: `Model not found: ${provider}/${modelId}` });
        return;
      }
      SettingsManager.create(CWD).setDefaultModelAndProvider(provider, modelId);
      sendJSON(res, 200, {
        ok: true,
        defaultModel: {
          provider,
          id: modelId,
          name: model.name || modelId,
          source: 'settings',
        },
      });
    } catch (err) {
      sendJSON(res, 500, { error: err.message });
    }
    return;
  }

  // ── API: Official price status ──────────────────────────────────────
  if (p === '/api/prices' && req.method === 'GET') {
    sendJSON(res, 200, getPriceStatus());
    return;
  }

  // ── API: List slash commands for a session ──────────────────────────
  if (p === '/api/commands' && req.method === 'GET') {
    try {
      const sid = url.searchParams.get('sessionId');
      let entry = sid ? activeSessions.get(sid) : null;

      if (!entry && sid) {
        try {
          const found = await findSessionInfo(sid);
          if (found) {
            const { id } = await openSession(found.path);
            entry = activeSessions.get(id);
          }
        } catch (err) {
          console.warn(`Could not load session ${sid} for /api/commands: ${err.message}`);
        }
      }

      const commands = WEB_BUILTIN_COMMANDS.map(c => ({ ...c, source: 'builtin' }));
      const seen = new Set(commands.map(c => c.name));

      if (entry) {
        const { session } = entry;

        // File-based prompt templates (/name)
        try {
          for (const template of session.promptTemplates) {
            if (!template?.name || seen.has(template.name)) continue;
            seen.add(template.name);
            commands.push({
              name: template.name,
              description: template.description || '',
              argumentHint: template.argumentHint || '',
              scope: template.sourceInfo?.scope || '',
              source: 'prompt',
            });
          }
        } catch (err) {
          console.warn(`Could not list prompt templates for /api/commands: ${err.message}`);
        }

        // Commands registered by extensions (/name)
        try {
          for (const cmd of session.extensionRunner.getRegisteredCommands()) {
            const name = cmd.invocationName || cmd.name;
            if (!name || seen.has(name)) continue;
            seen.add(name);
            commands.push({
              name,
              description: cmd.description || '',
              scope: cmd.sourceInfo?.scope || '',
              source: 'extension',
            });
          }
        } catch (err) {
          console.warn(`Could not list extension commands for /api/commands: ${err.message}`);
        }

        // Skills (/skill:name)
        try {
          if (session.settingsManager.getEnableSkillCommands()) {
            for (const skill of session.resourceLoader.getSkills().skills) {
              if (!skill?.name) continue;
              const name = `skill:${skill.name}`;
              if (seen.has(name)) continue;
              seen.add(name);
              commands.push({
                name,
                description: skill.description || '',
                scope: skill.sourceInfo?.scope || '',
                source: 'skill',
              });
            }
          }
        } catch (err) {
          console.warn(`Could not list skill commands for /api/commands: ${err.message}`);
        }
      }

      sendJSON(res, 200, { commands });
    } catch (err) {
      sendJSON(res, 500, { error: err.message });
    }
    return;
  }

  // ── API: Which directory this server was launched in ──────────────────
  // The sidebar needs it to tell "this project" apart from every other one.
  if (p === '/api/workspace' && req.method === 'GET') {
    sendJSON(res, 200, { cwd: CWD, name: path.basename(CWD) || CWD });
    return;
  }

  // ── API: List sessions ───────────────────────────────────────────────
  if (p === '/api/sessions' && req.method === 'GET') {
    try {
      const sessions = await listAllSessions();
      // The SDK's SessionInfo names these `path`, `created` and `modified`
      // (Date objects). Older names are kept as fallbacks so the list keeps
      // working if the SDK ever renames them again — when this mapping drops
      // the timestamps, the sidebar silently shows no dates at all.
      const formatted = sessions.map(s => ({
        id: s.id || s.sessionId,
        file: s.path || s.file || s.sessionFile,
        label: s.name || '',
        firstMessage: stripAttachmentMarkers(s.firstMessage || '').replace(/\s+/g, ' ').slice(0, 160),
        messageCount: s.messageCount || 0,
        // Empty for sessions created before the SDK recorded a cwd; those
        // run in whichever directory this process was launched from.
        cwd: s.cwd || CWD,
        cwdExists: sessionCwdExists(s.cwd),
        created: isoTime(s.created),
        updatedAt: isoTime(s.modified ?? s.updatedAt ?? s.mtime),
      }));
      // Most recent first, across every project. The sidebar and the startup
      // "open the latest session" both rely on this order.
      formatted.sort((a, b) => timestamp(b.updatedAt) - timestamp(a.updatedAt));
      sendJSON(res, 200, formatted);
    } catch (err) {
      sendJSON(res, 500, { error: err.message });
    }
    return;
  }

  // ── API: Create session ──────────────────────────────────────────────
  if (p === '/api/sessions' && req.method === 'POST') {
    try {
      const entry = await getOrCreateSession(null);
      const msgs = formatMessages(entry.session.messages || []);
      sendJSON(res, 201, { sessionId: entry.session.sessionId, messages: msgs });
    } catch (err) {
      sendJSON(res, 500, { error: err.message });
    }
    return;
  }

  // ── API: Is this session still generating? ──────────────────────────
  // A few bytes, so a client whose prompt stream has gone quiet can ask
  // repeatedly without pulling the whole transcript (which can be megabytes).
  const statusMatch = p.match(/^\/api\/sessions\/([^/]+)\/status$/);
  if (statusMatch && req.method === 'GET') {
    try {
      const entry = activeSessions.get(statusMatch[1]);
      if (entry) {
        res.setHeader('Cache-Control', 'no-store');
        sendJSON(res, 200, { sessionId: entry.session.sessionId, isStreaming: entry.session.isStreaming });
        return;
      }
      // A turn only runs inside a session this process has open, so a session
      // that is not loaded here is not generating. Confirm the id exists so a
      // stale one gets a 404 instead of a hopeful false.
      if (!(await findSessionInfo(statusMatch[1]))) {
        sendJSON(res, 404, { error: 'Session not found' });
        return;
      }
      res.setHeader('Cache-Control', 'no-store');
      sendJSON(res, 200, { sessionId: statusMatch[1], isStreaming: false });
    } catch (err) {
      sendJSON(res, 500, { error: err.message });
    }
    return;
  }

  // ── API: Get session info ────────────────────────────────────────────
  const sessionMatch = p.match(/^\/api\/sessions\/([^/]+)$/);
  if (sessionMatch && req.method === 'GET') {
    try {
      let entry = activeSessions.get(sessionMatch[1]);
      if (!entry) {
        // Try to load from file
        const found = await findSessionInfo(sessionMatch[1]);
        if (!found) { sendJSON(res, 404, { error: 'Session not found' }); return; }
        const { id } = await openSession(found.path);
        entry = activeSessions.get(id);
      }
      const entryIdByMessage = new Map();
      for (const branchEntry of entry.session.sessionManager.getBranch()) {
        if (branchEntry.type === 'message' && branchEntry.message) {
          entryIdByMessage.set(branchEntry.message, branchEntry.id);
        }
      }
      const msgs = formatMessages(entry.session.messages || [], entryIdByMessage);
      const m = entry.session.model;
      // A session file can name a model that no longer exists; the SDK then
      // silently picks another one (possibly far more expensive). Report it so
      // the UI can show the swap above the transcript.
      const modelFallbackMessage = entry.modelFallbackMessage || null;
      // The session's own working directory: sessions opened here may have been
      // started in another project, and the tools run there.
      let sessionCwd = CWD;
      try { sessionCwd = entry.session.sessionManager.getCwd() || CWD; } catch {}
      sendJSON(res, 200, {
        sessionId: entry.session.sessionId,
        cwd: sessionCwd,
        messages: msgs,
        isStreaming: entry.session.isStreaming,
        model: m?.name || m?.id || 'unknown',
        currentModel: m ? { provider: m.provider, id: m.id, name: m.name || m.id, input: m.input || ['text'] } : null,
        modelFallbackMessage,
      });
    } catch (err) {
      sendJSON(res, 500, { error: err.message });
    }
    return;
  }

  // ── API: Branch from a historical user message ──────────────────────
  const branchMatch = p.match(/^\/api\/sessions\/([^/]+)\/branch$/);
  if (branchMatch && req.method === 'POST') {
    const body = await parseBody(req);
    const entryId = String(body.entryId || '');
    if (!entryId) {
      sendJSON(res, 400, { error: 'entryId is required' });
      return;
    }

    try {
      let entry = activeSessions.get(branchMatch[1]);
      if (!entry) {
        const found = await findSessionInfo(branchMatch[1]);
        if (!found) { sendJSON(res, 404, { error: 'Session not found' }); return; }
        const { id } = await openSession(found.path);
        entry = activeSessions.get(id);
      }

      if (entry.session.isStreaming) {
        sendJSON(res, 409, { error: 'Wait for the current response to finish' });
        return;
      }

      const manager = entry.session.sessionManager;
      const target = manager.getEntry(entryId);
      const onActiveBranch = manager.getBranch().some(item => item.id === entryId);
      if (!target || target.type !== 'message' || target.message?.role !== 'user' || !onActiveBranch) {
        sendJSON(res, 400, { error: 'Cannot branch from this message' });
        return;
      }

      let sessionId;
      if (target.parentId) {
        // createBranchedSession mutates the manager it is called on. Use a
        // separate manager opened from the same file so the live original
        // session keeps its current leaf and full history.
        const sessionFile = manager.getSessionFile();
        if (!sessionFile) {
          sendJSON(res, 500, { error: 'Session has no file to branch from' });
          return;
        }
        const branchSource = SessionManager.open(sessionFile);
        const branchPath = branchSource.createBranchedSession(target.parentId);
        if (!branchPath) {
          sendJSON(res, 500, { error: 'Could not create a branch' });
          return;
        }
        const opened = await openSession(branchPath);
        sessionId = opened.id;
      } else {
        // Editing the first message: start a fresh session with the same model,
        // in the same project, so the edit does not silently move the chat.
        const sm = SessionManager.create(manager.getCwd() || CWD);
        const { session } = await createAgentSession({
          ...(await sessionOptions(sm)),
          model: entry.session.model,
        });
        sessionId = session.sessionId;
        activeSessions.set(sessionId, { session, sessionManager: sm, modelFallbackMessage: null });
      }

      sendJSON(res, 200, { sessionId });
    } catch (err) {
      sendJSON(res, 500, { error: err.message });
    }
    return;
  }

  // ── API: Set model for session ──────────────────────────────────────
  const modelMatch = p.match(/^\/api\/sessions\/([^/]+)\/model$/);
  if (modelMatch && req.method === 'POST') {
    const body = await parseBody(req);
    const { provider, modelId } = body;
    if (!provider && !modelId) {
      sendJSON(res, 400, { error: 'provider and modelId are required' });
      return;
    }
    try {
      let entry = activeSessions.get(modelMatch[1]);
      if (!entry) {
        // Try to load from file
        const found = await findSessionInfo(modelMatch[1]);
        if (!found) { sendJSON(res, 404, { error: 'Session not found' }); return; }
        const { id } = await openSession(found.path);
        entry = activeSessions.get(id);
      }
      const model = refreshModelRegistry().find(provider, modelId);
      if (!model) {
        sendJSON(res, 404, { error: `Model not found: ${provider}/${modelId}` });
        return;
      }
      await entry.session.setModel(model);
      sendJSON(res, 200, {
        success: true,
        model: { provider: model.provider, id: model.id, name: model.name || model.id, input: model.input || ['text'] },
      });
    } catch (err) {
      sendJSON(res, 500, { error: err.message });
    }
    return;
  }

  // ── API: Upload an attachment ────────────────────────────────────────
  if (p === '/api/uploads' && req.method === 'POST') {
    try {
      const buffer = await readRawBody(req);
      if (!buffer.length) {
        sendJSON(res, 400, { error: 'Empty upload' });
        return;
      }

      let name = 'attachment';
      const rawName = req.headers['x-file-name'];
      if (rawName) {
        try { name = decodeURIComponent(String(rawName)); } catch { name = String(rawName); }
      }
      name = sanitizeFileName(name);

      const headerType = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
      const sniffed = sniffImageMime(buffer);
      const imageMime = IMAGE_MIME.has(sniffed) ? sniffed : '';
      let kind = 'file';
      let mimeType = headerType && headerType !== 'application/octet-stream' ? headerType : mimeForName(name);
      let data;
      let inlineMime;
      let text;
      let truncated = false;

      if (imageMime) {
        kind = 'image';
        mimeType = imageMime;
        data = buffer.length <= MAX_IMAGE_BYTES ? buffer.toString('base64') : undefined;
        inlineMime = imageMime;
        if (buffer.length > 300 * 1024) {
          try {
            const resized = await resizeImage(buffer, imageMime, {
              maxWidth: 2000,
              maxHeight: 2000,
              maxBytes: MAX_IMAGE_BYTES,
              jpegQuality: 85,
            });
            if (resized) {
              data = resized.data;
              inlineMime = resized.mimeType;
            }
          } catch {
            // Keep the original if the resizer is unavailable; the prompt route
            // will refuse it if it is too large to send inline.
          }
        }
      } else if (isTextAttachment(buffer, headerType, name)) {
        kind = 'text';
        mimeType = headerType.startsWith('text/') || headerType === 'application/json' || headerType === 'application/xml'
          ? headerType
          : mimeForName(name);
        const full = buffer.toString('utf8');
        text = full.slice(0, TEXT_INLINE_LIMIT);
        truncated = full.length > TEXT_INLINE_LIMIT;
      }

      const id = randomUUID();
      const stored = `${id}-${name}`;
      const filePath = path.join(UPLOAD_DIR, stored);
      await fs.promises.writeFile(filePath, buffer);
      await fs.promises.writeFile(`${filePath}.meta.json`, JSON.stringify({ name, mimeType, kind, size: buffer.length }));

      sendJSON(res, 201, {
        id,
        name,
        mimeType,
        size: buffer.length,
        kind,
        // Relative so the attachment resolves under a path prefix too.
        url: `api/uploads/${encodeURIComponent(stored)}`,
        path: filePath,
        data,
        inlineMime,
        text,
        truncated,
        inline: Boolean(data),
      });
    } catch (err) {
      sendJSON(res, /too large/i.test(err.message) ? 413 : 500, { error: err.message });
    }
    return;
  }

  // ── API: Serve an uploaded attachment ────────────────────────────────
  if (p.startsWith('/api/uploads/') && req.method === 'GET') {
    let name = '';
    try { name = decodeURIComponent(p.slice('/api/uploads/'.length)); } catch {}
    if (!name || name.endsWith('.meta.json') || name !== path.basename(name) || name.includes('\\') || name.includes('..')) {
      sendJSON(res, 400, { error: 'Invalid attachment path' });
      return;
    }
    const filePath = path.join(UPLOAD_DIR, name);
    if (!filePath.startsWith(UPLOAD_DIR + path.sep)) {
      sendJSON(res, 403, { error: 'Forbidden' });
      return;
    }
    fs.readFile(filePath, async (err, contents) => {
      if (err) {
        sendJSON(res, 404, { error: 'Attachment not found' });
        return;
      }
      let meta = {};
      try { meta = JSON.parse(await fs.promises.readFile(`${filePath}.meta.json`, 'utf8')); } catch {}
      const kind = meta.kind || (mimeForName(name).startsWith('image/') ? 'image' : 'file');
      // Only decoded images are served inline. Text is served as plain text so
      // an uploaded HTML/SVG file cannot run same-origin script; binaries are
      // downloads for the same reason.
      const mimeType = kind === 'image' ? (meta.mimeType || mimeForName(name)) : kind === 'text' ? 'text/plain; charset=utf-8' : 'application/octet-stream';
      const disposition = kind === 'file' ? 'attachment' : 'inline';
      res.writeHead(200, {
        'Content-Type': mimeType,
        'Content-Length': contents.length,
        'Content-Disposition': `${disposition}; filename*=UTF-8''${encodeURIComponent(meta.name || name)}`,
        'X-Content-Type-Options': 'nosniff',
      });
      res.end(contents);
    });
    return;
  }

  // ── API: Send prompt (SSE stream) ────────────────────────────────────
  const promptMatch = p.match(/^\/api\/sessions\/([^/]+)\/prompt$/);
  if (promptMatch && req.method === 'POST') {
    const body = await parseBody(req);
    const message = String(body.message || body.prompt || '');
    const rawImages = Array.isArray(body.images) ? body.images : [];
    // Refuse loudly instead of dropping images silently: a picture that never
    // reached the model and never said so is worse than an error.
    if (rawImages.length > MAX_IMAGES_PER_MESSAGE) {
      sendJSON(res, 400, { error: `At most ${MAX_IMAGES_PER_MESSAGE} images per message.` });
      return;
    }
    const images = [];
    for (const img of rawImages) {
      const data = String(img?.data || img?.source?.data || '').replace(/^data:[^;]+;base64,/, '');
      const mimeType = String(img?.mimeType || img?.source?.mediaType || '').toLowerCase();
      if (!data || !IMAGE_MIME.has(mimeType)) continue;
      // Keep the request inside provider inline-image limits.
      if (data.length > Math.ceil(MAX_IMAGE_BYTES * 4 / 3) + 1024) {
        sendJSON(res, 400, {
          error: `An image is larger than ${Math.round(MAX_IMAGE_BYTES / 1024 / 1024)} MB.`,
        });
        return;
      }
      images.push({ type: 'image', data, mimeType });
    }

    if (!message.trim() && images.length === 0) {
      sendJSON(res, 400, { error: 'Message is required' });
      return;
    }

    let entry = activeSessions.get(promptMatch[1]);
    if (!entry) { sendJSON(res, 404, { error: 'Session not found' }); return; }

    const { session } = entry;

    // Setup SSE
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    function send(event, data) {
      if (res.writableEnded) return;
      if (event) res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    }

    if (images.length > 0 && Array.isArray(session.model?.input) && !session.model.input.includes('image')) {
      send('warning', { message: 'The selected model does not declare image input; attached images may be ignored. Choose a vision model to read them.' });
    }

    // Track streaming state
    let currentToolName = '';
    let thinkingBlock = false;

    const unsub = session.subscribe((event) => {
      if (res.writableEnded) return;

      switch (event.type) {
        case 'message_update': {
          const me = event.assistantMessageEvent;
          if (me.type === 'text_delta') {
            send('text', { delta: me.delta });
          } else if (me.type === 'thinking_delta') {
            if (!thinkingBlock) {
              thinkingBlock = true;
              send('thinking_start', {});
            }
            send('thinking', { delta: me.delta });
          }
          break;
        }

        case 'tool_execution_start':
          currentToolName = event.toolName || 'unknown';
          thinkingBlock = false;
          send('tool_start', {
            toolCallId: event.toolCallId,
            toolName: event.toolName,
            input: event.args ?? event.input ?? {},
          });
          break;

        case 'tool_execution_update':
          // partialResult is cumulative: it contains all output so far.
          send('tool_update', {
            toolCallId: event.toolCallId,
            output: extractToolOutput(event.partialResult ?? event.output ?? event.delta),
          });
          break;

        case 'tool_execution_end':
          send('tool_end', {
            toolCallId: event.toolCallId,
            isError: event.isError || false,
            output: extractToolOutput(event.result ?? event.output),
            images: extractToolImages(event.result ?? event.output),
            details: event.result?.details ?? event.details ?? {},
          });
          currentToolName = '';
          break;

        case 'message_start':
          thinkingBlock = false;
          send('message_start', {});
          break;

        case 'message_end':
          send('message_end', {
            usage: formatUsage(event.message?.usage, event.message),
            timestamp: event.message?.timestamp || null,
          });
          break;

        case 'agent_start':
          send('agent_start', {});
          break;

        case 'agent_end':
          send('agent_end', {
            messages: formatMessages(event.messages || session.messages || []),
          });
          break;

        case 'turn_start':
          send('turn_start', {});
          break;

        case 'turn_end':
          send('turn_end', {
            toolResults: event.toolResults || [],
          });
          break;

        default:
          break;
      }
    });

    const previousLastUser = [...session.sessionManager.getBranch()]
      .reverse()
      .find(entry => entry.type === 'message' && entry.message?.role === 'user');

    try {
      const promptOptions = {
        expandPromptTemplates: true,
      };
      if (images.length > 0) {
        promptOptions.images = images;
      }
      if (session.isStreaming) {
        promptOptions.streamingBehavior = body.streamingBehavior || 'steer';
      }

      startKeepAwake();
      await session.prompt(message, promptOptions);

      const lastUser = [...session.sessionManager.getBranch()]
        .reverse()
        .find(entry => entry.type === 'message' && entry.message?.role === 'user');
      const userEntryId = lastUser && lastUser.id !== previousLastUser?.id ? lastUser.id : null;
      send('done', { userEntryId });
    } catch (err) {
      send('error', { error: err.message });
    } finally {
      stopKeepAwake();
      unsub();
      if (!res.writableEnded) res.end();
    }

    // Handle client disconnect
    req.on('close', () => {
      unsub();
    });

    return;
  }

  // ── API: Compact a session ──────────────────────────────────────────
  const compactMatch = p.match(/^\/api\/sessions\/([^/]+)\/compact$/);
  if (compactMatch && req.method === 'POST') {
    const entry = activeSessions.get(compactMatch[1]);
    if (!entry) { sendJSON(res, 404, { error: 'Session not found' }); return; }
    try {
      const body = await parseBody(req);
      const result = await entry.session.compact(body.instructions || undefined);
      sendJSON(res, 200, {
        success: true,
        summary: result?.summary || '',
        tokensBefore: result?.tokensBefore ?? null,
      });
    } catch (err) {
      sendJSON(res, 500, { error: err.message });
    }
    return;
  }

  // ── API: Abort ───────────────────────────────────────────────────────
  const abortMatch = p.match(/^\/api\/sessions\/([^/]+)\/abort$/);
  if (abortMatch && req.method === 'POST') {
    const entry = activeSessions.get(abortMatch[1]);
    if (!entry) { sendJSON(res, 404, { error: 'Session not found' }); return; }
    try {
      await entry.session.abort();
      sendJSON(res, 200, { success: true });
    } catch (err) {
      sendJSON(res, 500, { error: err.message });
    }
    return;
  }

  // ── API: Delete session ──────────────────────────────────────────────
  const deleteMatch = p.match(/^\/api\/sessions\/([^/]+)$/);
  if (deleteMatch && req.method === 'DELETE') {
    const sid = deleteMatch[1];
    const entry = activeSessions.get(sid);
    if (entry) {
      try { entry.session.dispose(); } catch {}
      activeSessions.delete(sid);
    }
    // Also try to delete the file
    try {
      const found = await findSessionInfo(sid);
      if (found) {
        if (found.path) fs.unlinkSync(found.path);
      }
    } catch {}
    sendJSON(res, 200, { success: true });
    return;
  }

  // ── Static files / SPA fallback ──────────────────────────────────────
  serveStatic(res, p);
});

// Start the vendor price check before accepting requests. Requests that arrive
// while it runs use the previous cache (or the SDK price when there is no
// cache); successful checks are persisted as they complete.
if (getPriceStatus().enabled) {
  const endpoints = new Map([...priceEndpoints()].filter(([endpoint]) => hasPriceAdapter(endpoint)));
  if (endpoints.size > 0) {
    console.log(`  Updating vendor prices for ${endpoints.size} endpoint(s)…`);
    void refreshOfficialPrices(endpoints)
      .then((status) => {
        if (status.lastError) {
          console.warn(`  ⚠️  Some vendor prices were unavailable, keeping cached/local prices: ${status.lastError}`);
        }
        console.log(`  Prices: ${status.models} models across ${status.endpoints} endpoints (checked ${status.updatedAt})`);
      })
      .catch((err) => console.warn(`  ⚠️  Price refresh failed: ${err.message}`));
  }
}

server.listen(PORT, HOST, () => {
  const displayHost = HOST === '0.0.0.0' || HOST === '::' ? 'localhost' : HOST;
  console.log(`\n  🚀 Fidere running at http://${displayHost}:${PORT}\n`);
  console.log(`  Listening on: ${HOST}:${PORT}`);
  console.log(`  Sessions directory: ${CWD}\n`);

  if (DAEMON_ENABLED) {
    daemon.start();
    const scheduled = loadWorkflows(WORKFLOWS_DIR).filter((w) => w.schedule).length;
    console.log(`  Workflows: ${WORKFLOWS_DIR} (${scheduled} scheduled)`);
    console.log(`  Ledger: ${LEDGER_PATH}\n`);
  } else {
    console.log('  Scheduled tasks are disabled (FIDERE_DAEMON=off).\n');
  }

  if (AUTH_DISABLED) {
    console.warn('  ⚠️  Authentication is disabled (FIDERE_AUTH=off). Do not expose this server.\n');
  } else {
    // Print the value, not just where it lives: "paste the access token printed
    // on startup" is what every document says, and telling someone to go and
    // read a file first is exactly the step people skip.
    const signIn = `http://${displayHost}:${PORT}/#token=${ACCESS.token}`;
    console.log(`  Access token: ${ACCESS.token}`);
    console.log(`  Stored in:    ${ACCESS.source === 'FIDERE_TOKEN' ? 'FIDERE_TOKEN (environment)' : ACCESS.source}`);
    console.log('  Sign in with it once; the session cookie lasts 30 days.');
    console.log(`  Shortcut:     ${signIn}`);
    console.log('  Anyone with this value can use the server: do not paste this output publicly.\n');
  }
});
