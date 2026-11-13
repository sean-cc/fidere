// Runs one workflow as an isolated child process of the pi CLI.
//
// The pi CLI ships inside Fidere's only dependency, so "running a task" means
// spawning `node_modules/.bin/pi` — not re-implementing the agent loop here.
// That buys three things for free: a hung task can be killed outright, a
// crashed task cannot take the daemon down with it, and the per-task limits
// (tools, skills, MCP, context files) are plain command-line flags.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const DEFAULT_TOOLS = ['read', 'write', 'edit', 'grep', 'find', 'ls', 'bash'];
const SKIP_ON_COPY = new Set(['node_modules', '.git', '.session', 'out', 'runs']);
// grace period between SIGTERM and SIGKILL when a task runs over budget or time
const KILL_GRACE_MS = 5000;

// Resolve the CLI from the package's own bin entry so this works whether
// Fidere is run from a clone (`npm start`) or from a global install. The
// package's `exports` map only exposes "." and "./rpc-entry", so the package
// root has to be derived from the resolved library entry point.
export function resolvePiCli() {
  try {
    const entry = fileURLToPath(import.meta.resolve('@earendil-works/pi-coding-agent'));
    const pkgDir = path.resolve(path.dirname(entry), '..');
    const pkg = JSON.parse(fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf8'));
    const rel = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin?.pi;
    if (rel) return path.resolve(pkgDir, rel);
  } catch {
    // fall through: the caller reports a readable error
  }
  return null;
}

function copyWorkflow(from, to) {
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    if (SKIP_ON_COPY.has(entry.name) || entry.name.startsWith('.')) continue;
    const src = path.join(from, entry.name);
    const dst = path.join(to, entry.name);
    fs.cpSync(src, dst, { recursive: true });
  }
}

// A run's working directory starts as a copy of the workflow directory: the
// task can change anything it likes without touching the definition it ran from.
function prepareRunDir(runsDir, name, startedAt) {
  const stamp = startedAt.toISOString().replace(/[:]/g, '-').replace(/\..*$/, '');
  let runDir = path.join(runsDir, name, stamp);
  for (let i = 2; fs.existsSync(runDir); i += 1) runDir = path.join(runsDir, name, `${stamp}-${i}`);
  fs.mkdirSync(runDir, { recursive: true });
  return runDir;
}

// Usage arrives per assistant message; turn_end repeats the same object, so
// summing only `message_end` keeps the total from doubling.
function accumulate(run, message) {
  const usage = message?.usage;
  if (!usage) return;
  const cost = typeof usage.cost === 'number' ? usage.cost : Number(usage.cost?.total) || 0;
  run.costUsd += cost;
  run.tokens += Number(usage.totalTokens) || 0;
  run.turns += 1;
}

function summarizeToolCalls(run, message) {
  for (const block of message?.content || []) {
    if (block?.type !== 'toolCall') continue;
    const args = block.arguments || {};
    const hint = args.command || args.path || args.file_path || args.pattern || '';
    run.toolCalls.push({ name: block.name, hint: String(hint).slice(0, 160) });
  }
}

function runVerify(command, cwd, timeoutMs = 120_000) {
  return new Promise((resolve) => {
    const child = spawn(process.env.SHELL || 'sh', ['-c', command], {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, FIDERE_RUN_DIR: cwd },
    });
    let output = '';
    const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs);
    child.stdout.on('data', (d) => { output += d; });
    child.stderr.on('data', (d) => { output += d; });
    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({ ok: false, code: null, output: err.message });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ ok: code === 0, code, output: output.slice(-4000) });
    });
  });
}

/**
 * Run one workflow once.
 *
 * spec:   { name, dir, body, tools?, prompt?, verify? }
 * options: { runsDir, model: {provider,id,thinking}, budgetUsd, timeoutMs, onEvent }
 *
 * Resolves with a result even when the task fails — the caller decides whether
 * to retry, escalate or report. It never throws for a failed run.
 */
export async function runWorkflow(spec, options = {}) {
  const {
    runsDir,
    model = {},
    budgetUsd = 0.30,
    timeoutMs = 10 * 60 * 1000,
    runKey = '',
    onEvent = () => {},
  } = options;

  const cli = resolvePiCli();
  const startedAt = new Date();
  const runDir = prepareRunDir(runsDir, spec.name, startedAt);
  copyWorkflow(spec.dir, runDir);

  const result = {
    name: spec.name,
    startedAt: startedAt.toISOString(),
    runDir,
    ok: false,
    reason: null,
    costUsd: 0,
    costCny: 0,
    tokens: 0,
    turns: 0,
    toolCalls: [],
    verify: null,
    durationMs: 0,
  };

  if (!cli) {
    result.reason = 'pi CLI not found — reinstall Fidere or run npm install';
    return result;
  }

  // The workflow body goes in as a file: it keeps quoting out of argv and lets
  // the CLI read it the same way it reads any other prompt file.
  const taskFile = path.join(runDir, '.task.md');
  fs.writeFileSync(taskFile, spec.body || `# ${spec.name}\n`);

  const sessionDir = path.join(runDir, '.session');
  const args = [
    '--mode', 'json',
    '--no-context-files', '--no-skills', '--no-extensions', '--no-mcp', '--no-approve',
    '--provider', model.provider,
    '--model', model.id,
    '--thinking', model.thinking || 'low',
    '--tools', (spec.tools?.length ? spec.tools : DEFAULT_TOOLS).join(','),
    '--append-system-prompt', taskFile,
    '--session-dir', sessionDir,
    '-p', spec.prompt || '开始执行任务。',
  ];

  const child = spawn(process.execPath, [cli, ...args], {
    cwd: runDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    // The CLI reads the same credentials and model catalogue the UI does, so a
    // task and a chat never disagree about either. The one thing added is a
    // stable key for this scheduled moment, so a workflow can dedupe its own
    // external side effects (an order, an email) across retries and reruns.
    env: { ...process.env, ...(runKey ? { FIDERE_RUN_KEY: runKey } : {}) },
  });

  const stderrPath = path.join(runDir, 'stderr.log');
  const stderrStream = fs.createWriteStream(stderrPath);
  child.stderr.pipe(stderrStream);

  let killedFor = null;
  const kill = (why) => {
    if (killedFor) return;
    killedFor = why;
    child.kill('SIGTERM');
    setTimeout(() => child.kill('SIGKILL'), KILL_GRACE_MS).unref();
  };

  const timer = setTimeout(() => kill('timeout'), timeoutMs);

  let buffer = '';
  const handle = (line) => {
    if (!line.trim()) return;
    let event;
    try { event = JSON.parse(line); } catch { return; }
    const message = event.message;

    if (event.type === 'message_end' && message?.role === 'assistant') {
      accumulate(result, message);
      summarizeToolCalls(result, message);
      onEvent({ type: 'usage', costUsd: result.costUsd, tokens: result.tokens });
      if (result.costUsd > budgetUsd) kill('budget');
    }

    if (event.type === 'tool_execution_start') {
      onEvent({ type: 'tool', name: event.toolName, input: event.input });
    }

    if (event.type === 'message_update' && event.assistantMessageEvent?.type === 'text_delta') {
      onEvent({ type: 'text', delta: event.assistantMessageEvent.delta });
    }
  };

  const exit = await new Promise((resolve) => {
    child.stdout.on('data', (chunk) => {
      buffer += chunk;
      let index;
      while ((index = buffer.indexOf('\n')) !== -1) {
        handle(buffer.slice(0, index));
        buffer = buffer.slice(index + 1);
      }
    });
    child.on('error', (err) => resolve({ code: null, error: err.message }));
    child.on('close', (code) => {
      if (buffer) handle(buffer);
      resolve({ code });
    });
  });

  clearTimeout(timer);
  stderrStream.end();

  const finishedAt = Date.now();
  result.durationMs = finishedAt - startedAt.getTime();
  result.costCny = Number((result.costUsd * Number(process.env.FIDERE_USD_CNY || 7.2)).toFixed(4));

  if (killedFor === 'budget') {
    result.reason = `over budget ($${result.costUsd.toFixed(4)})`;
  } else if (killedFor === 'timeout') {
    result.reason = `timed out after ${Math.round(timeoutMs / 1000)}s`;
  } else if (exit.error) {
    result.reason = exit.error;
  } else if (exit.code !== 0) {
    result.reason = `pi exited with code ${exit.code}`;
  }

  // Verification is the only thing that decides success. A model that says it
  // finished, or a process that exits 0, is not evidence that the work is done.
  if (!result.reason && spec.verify) {
    const verify = await runVerify(spec.verify, runDir);
    result.verify = verify;
    if (!verify.ok) result.reason = `verify failed (exit ${verify.code})`;
  }

  result.ok = !result.reason;
  return result;
}

/**
 * Write a one-line JSON record for a finished run. The ledger is append-only on
 * purpose: it is the cheapest audit trail that survives a crash, and `jq` can
 * read it without any code from us.
 */
export function appendLedger(ledgerPath, record) {
  fs.mkdirSync(path.dirname(ledgerPath), { recursive: true });
  fs.appendFileSync(ledgerPath, `${JSON.stringify(record)}\n`);
}

/** Total a day's runs out of the ledger, for the daily receipt. */
export function summarizeDay(ledgerPath, day) {
  const summary = { day, runs: 0, ok: 0, failed: 0, costUsd: 0, byWorkflow: {} };
  let text = '';
  try { text = fs.readFileSync(ledgerPath, 'utf8'); } catch { return summary; }
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    let row;
    try { row = JSON.parse(line); } catch { continue; }
    if (row.type !== 'run' || !String(row.startedAt || '').startsWith(day)) continue;
    summary.runs += 1;
    if (row.ok) summary.ok += 1;
    else summary.failed += 1;
    summary.costUsd += Number(row.costUsd) || 0;
    const bucket = summary.byWorkflow[row.name] || (summary.byWorkflow[row.name] = { runs: 0, failed: 0, costUsd: 0 });
    bucket.runs += 1;
    if (!row.ok) bucket.failed += 1;
    bucket.costUsd += Number(row.costUsd) || 0;
  }
  summary.costUsd = Number(summary.costUsd.toFixed(4));
  return summary;
}
