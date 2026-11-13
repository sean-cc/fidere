// The scheduler. One timer, one state file, one append-only ledger.
//
// This is deliberately not a job queue: there is no database, no broker and no
// worker pool. A single 60-second tick aligned to the minute is enough for
// "run this once a day", and keeping the state in one JSON file means a crash
// costs at most the task that was mid-flight. What it does *not* skip is
// correctness: a task missed because the machine slept is caught up on the next
// tick, and the ledger records how late it was.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { appendLedger, runWorkflow, summarizeDay } from './runner.js';

const TICK_MS = 60_000;
// A task that is more than this late is not "caught up", it is stale: running a
// week of missed daily briefings back to back helps nobody and costs real money.
const CATCH_UP_MS = Number(process.env.FIDERE_CATCH_UP_MS || 6 * 3600_000);
const DEFAULT_BUDGET_USD = Number(process.env.FIDERE_TASK_BUDGET || 0.30);
const DEFAULT_TIMEOUT_MS = Number(process.env.FIDERE_TASK_TIMEOUT || 20 * 60_000);

// ── Frontmatter ────────────────────────────────────────────────────────────

// Only the flat `key: value` subset of YAML is supported. Anything more
// elaborate belongs in a script, not in a scheduler config.
export function parseFrontmatter(text) {
  const src = String(text || '');
  if (!src.startsWith('---')) return { data: {}, body: src };
  const end = src.indexOf('\n---', 3);
  if (end === -1) return { data: {}, body: src };
  const data = {};
  for (const line of src.slice(3, end).split('\n')) {
    const match = /^([A-Za-z][\w-]*):\s*(.*)$/.exec(line);
    if (!match) continue;
    // Only strip a quote pair that wraps the whole value. Stripping either end
    // independently would corrupt a command like `sh -c 'echo ...'`.
    let value = match[2].trim();
    const quoted = (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"));
    if (quoted && value.length > 1) value = value.slice(1, -1);
    data[match[1]] = value;
  }
  return { data, body: src.slice(end + 4).replace(/^\s*\n/, '') };
}

// ── Schedules ──────────────────────────────────────────────────────────────

// Budgets are written the way a person thinks about them: `budget: ¥0.4` or
// `budget: $0.05`. A bare number is read as USD, because that is the unit every
// vendor price in models.json is stored in.
const USD_CNY = () => Number(process.env.FIDERE_USD_CNY || 7.2);

export function parseBudget(value) {
  if (value === undefined || value === null || value === '') return DEFAULT_BUDGET_USD;
  const text = String(value).trim();
  const amount = Number(text.replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(amount) || amount <= 0) return DEFAULT_BUDGET_USD;
  if (/^[¥￥]|^CNY/i.test(text)) return Number((amount / USD_CNY()).toFixed(6));
  return amount;
}

export function parseSchedule(value) {
  const [kind, arg = ''] = String(value || '').trim().split(/\s+/);
  if (kind === 'every') {
    const match = /^(\d+)\s*(m|h)$/.exec(arg);
    if (!match) return null;
    return { kind, intervalMs: Number(match[1]) * (match[2] === 'h' ? 3600_000 : 60_000) };
  }
  if (kind === 'daily' || kind === 'weekdays') {
    const match = /^(\d{1,2}):(\d{2})$/.exec(arg);
    if (!match) return null;
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (hour > 23 || minute > 59) return null;
    return { kind, hour, minute };
  }
  return null;
}

const isWeekend = (date) => date.getDay() === 0 || date.getDay() === 6;

// The most recent moment the schedule should have fired, at or before `now`.
// Working backwards from "when should it have run" rather than forwards from
// "when did it run" is what makes a missed day recoverable.
export function mostRecentTrigger(schedule, now = Date.now()) {
  if (schedule.kind === 'every') return now;
  const at = (base) => {
    const d = new Date(base);
    d.setHours(schedule.hour, schedule.minute, 0, 0);
    return d.getTime();
  };
  let trigger = at(now);
  if (trigger > now) trigger = at(trigger - 86_400_000);
  if (schedule.kind === 'weekdays') {
    while (isWeekend(new Date(trigger))) trigger -= 86_400_000;
  }
  return trigger;
}

// Schedules are wall-clock times, so they follow the machine's timezone. On a
// server that defaults to UTC, "daily 08:00" means 08:00 UTC — which is 16:00 in
// China. Print the clock at startup instead of letting that be discovered by
// noticing the briefing arrives in the afternoon.
export function timezoneInfo() {
  const name = process.env.TZ || Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown';
  const offset = -new Date().getTimezoneOffset() / 60;
  return { name, offset, utc: /^utc$/i.test(name) };
}

export function nextRunAt(schedule, lastDue, now = Date.now()) {
  if (schedule.kind === 'every') {
    return (lastDue || now) + schedule.intervalMs;
  }
  const next = mostRecentTrigger(schedule, now) + 86_400_000;
  if (schedule.kind === 'weekdays') {
    let candidate = next;
    while (isWeekend(new Date(candidate))) candidate += 86_400_000;
    return candidate;
  }
  return next;
}

// ── Workflow discovery ─────────────────────────────────────────────────────

export function loadWorkflows(dir) {
  const entries = [];
  let names = [];
  try { names = fs.readdirSync(dir); } catch { return entries; }
  for (const name of names.sort()) {
    const skillPath = path.join(dir, name, 'SKILL.md');
    if (!fs.existsSync(skillPath)) continue;
    const { data, body } = parseFrontmatter(fs.readFileSync(skillPath, 'utf8'));
    const schedule = parseSchedule(data.schedule);
    entries.push({
      name,
      dir: path.join(dir, name),
      body,
      data,
      schedule,
      scheduleText: data.schedule || null,
      budgetUsd: parseBudget(data.budget),
      budgetText: data.budget || null,
      timeoutMs: Number(data.timeout) * 1000 || DEFAULT_TIMEOUT_MS,
      verify: data.verify || null,
      notify: data.notify || null,
      tools: data.tools ? data.tools.split(',').map((t) => t.trim()).filter(Boolean) : null,
      prompt: data.prompt || '开始执行任务。',
      model: parseModel(data.model),
      escalate: parseModel(data.escalate),
      enabled: data.enabled !== 'false',
    });
  }
  return entries;
}

function parseModel(value) {
  if (!value) return null;
  const [provider, id] = String(value).split('/');
  return provider && id ? { provider, id } : null;
}

// ── Default model ──────────────────────────────────────────────────────────

// A workflow that does not name a model uses the same default the UI uses, so
// "what it runs on" stays one answer instead of two.
function defaultModel() {
  const fromEnv = parseModel(process.env.FIDERE_TASK_MODEL);
  if (fromEnv) return { ...fromEnv, thinking: process.env.FIDERE_TASK_THINKING || 'low' };
  try {
    const settings = JSON.parse(fs.readFileSync(path.join(process.env.HOME, '.pi/agent/settings.json'), 'utf8'));
    if (settings.defaultProvider && settings.defaultModel) {
      return {
        provider: settings.defaultProvider,
        id: settings.defaultModel,
        thinking: process.env.FIDERE_TASK_THINKING || 'low',
      };
    }
  } catch {
    // fall through to the explicit failure below
  }
  return null;
}

// ── Daemon ─────────────────────────────────────────────────────────────────

export function createDaemon(options = {}) {
  const root = options.root || process.cwd();
  const workflowsDir = options.workflowsDir || path.join(root, 'workflows');
  const dataDir = options.dataDir || path.join(root, '.fidere');
  const runsDir = path.join(dataDir, 'runs');
  const statePath = path.join(dataDir, 'daemon-state.json');
  const ledgerPath = path.join(dataDir, 'ledger.jsonl');
  const log = options.log || ((line) => console.log(`[daemon] ${line}`));

  const state = { workflows: {}, lastReceiptDay: null };
  const runtime = { ticking: false, current: null, lastError: null };

  function loadState() {
    try {
      Object.assign(state, JSON.parse(fs.readFileSync(statePath, 'utf8')));
    } catch {
      // first start, or an unreadable state file: start clean rather than refuse to run
    }
  }

  function saveState() {
    fs.mkdirSync(dataDir, { recursive: true });
    const tmp = `${statePath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
    fs.renameSync(tmp, statePath);
  }

  function stateFor(name) {
    return state.workflows[name] || (state.workflows[name] = { lastDue: 0, lastRun: 0, lastOk: null });
  }

  function dueFor(entry, now = Date.now()) {
    const s = stateFor(entry.name);
    if (!entry.schedule) return null;
    if (entry.schedule.kind === 'every') {
      const due = s.lastDue ? s.lastDue + entry.schedule.intervalMs : now;
      return due <= now ? due : null;
    }
    const trigger = mostRecentTrigger(entry.schedule, now);
    return trigger > (s.lastDue || 0) ? trigger : null;
  }

  async function execute(entry, dueAt) {
    const primary = entry.model || defaultModel();
    if (!primary) {
      log(`${entry.name}: no model configured — set FIDERE_TASK_MODEL or a default in settings.json`);
      return { ok: false, reason: 'no model configured' };
    }

    const late = Date.now() - dueAt;
    runtime.current = entry.name;
    log(`${entry.name}: starting${late > TICK_MS ? ` (${Math.round(late / 60000)}min late)` : ''}`);

    // Retry once on the same model, then once on the escalation model if the
    // workflow names one. A task that cannot pass its own check twice is a task
    // that needs a human, not a fourth attempt.
    const attempts = entry.escalate ? [primary, primary, entry.escalate] : [primary, primary];
    let result = null;
    // The budget covers the whole task, retries included. Counting attempts
    // separately would let a failing workflow spend two or three times its cap.
    const spent = { costUsd: 0, tokens: 0, turns: 0 };
    for (let i = 0; i < attempts.length; i += 1) {
      const remaining = entry.budgetUsd - spent.costUsd;
      if (remaining <= 0) {
        result = { ...(result || {}), ok: false, reason: `over budget ($${spent.costUsd.toFixed(4)}) — retry skipped` };
        break;
      }
      const model = { ...attempts[i], thinking: attempts[i].thinking || entry.data.thinking || 'low' };
      result = await runWorkflow(entry, {
        runsDir,
        model,
        runKey: `${entry.name}:${dueAt}`,
        budgetUsd: remaining,
        timeoutMs: entry.timeoutMs,
        onEvent: options.onEvent,
      });
      spent.costUsd += result.costUsd;
      spent.tokens += result.tokens;
      spent.turns += result.turns;
      if (result.ok) break;
      log(`${entry.name}: attempt ${i + 1} failed — ${result.reason}`);
      // Running out of budget or time is not a transient failure: retrying just
      // spends the budget again.
      if (/over budget|timed out/.test(result.reason || '')) break;
    }

    const record = {
      type: 'run',
      name: entry.name,
      startedAt: result.startedAt,
      dueAt: new Date(dueAt).toISOString(),
      lateMs: Math.max(0, late),
      ok: result.ok,
      reason: result.reason,
      costUsd: Number(spent.costUsd.toFixed(6)),
      costCny: Number((spent.costUsd * Number(process.env.FIDERE_USD_CNY || 7.2)).toFixed(4)),
      tokens: spent.tokens,
      turns: spent.turns,
      durationMs: result.durationMs,
      verify: result.verify ? { ok: result.verify.ok, code: result.verify.code } : null,
      runDir: result.runDir,
    };
    appendLedger(ledgerPath, record);
    await runNotify(entry.notify, record);

    const s = stateFor(entry.name);
    s.lastDue = dueAt;
    s.lastRun = Date.now();
    s.lastOk = result.ok;
    saveState();

    runtime.current = null;
    log(`${entry.name}: ${result.ok ? 'ok' : `failed — ${result.reason}`} ($${spent.costUsd.toFixed(4)})`);
    return { ...result, costUsd: spent.costUsd, costCny: Number((spent.costUsd * Number(process.env.FIDERE_USD_CNY || 7.2)).toFixed(4)), tokens: spent.tokens, turns: spent.turns };
  }

  // Notification is a shell command the workflow owns, so it can be `curl` to a
  // webhook, a `say` on macOS, or nothing at all. Daemon-owned transports would
  // mean a settings screen, credentials and a second failure mode.
  async function runNotify(command, record) {
    if (!command) return;
    await new Promise((resolve) => {
      let child;
      try {
        child = spawn(process.env.SHELL || 'sh', ['-c', command], {
          cwd: record.runDir,
          stdio: ['ignore', 'ignore', 'inherit'],
          env: {
            ...process.env,
            FIDERE_TASK: record.name,
            FIDERE_TASK_OK: record.ok ? '1' : '0',
            FIDERE_TASK_REASON: record.reason || '',
            FIDERE_TASK_COST_USD: String(record.costUsd),
            FIDERE_TASK_COST_CNY: String(record.costCny),
          },
        });
      } catch (err) {
        log(`notify failed: ${err.message}`);
        resolve();
        return;
      }
      // A notification must never hold the scheduler hostage.
      const timer = setTimeout(() => child.kill('SIGKILL'), 30_000);
      const done = () => { clearTimeout(timer); resolve(); };
      child.on('error', (err) => { log(`notify failed: ${err.message}`); done(); });
      child.on('close', done);
    });
  }

  async function tick() {
    if (runtime.ticking) return [];
    runtime.ticking = true;
    const done = [];
    try {
      const now = Date.now();
      for (const entry of loadWorkflows(workflowsDir)) {
        if (!entry.enabled || !entry.schedule) continue;
        const dueAt = dueFor(entry, now);
        if (!dueAt) continue;
        if (now - dueAt > CATCH_UP_MS) {
          const s = stateFor(entry.name);
          s.lastDue = dueAt;
          saveState();
          appendLedger(ledgerPath, {
            type: 'skip',
            name: entry.name,
            dueAt: new Date(dueAt).toISOString(),
            reason: 'missed by more than the catch-up window',
          });
          log(`${entry.name}: skipped, ${Math.round((now - dueAt) / 3600000)}h late`);
          continue;
        }
        done.push(await execute(entry, dueAt));
      }
      writeReceiptIfDue(now);
    } catch (err) {
      runtime.lastError = err.message;
      log(`tick failed: ${err.message}`);
    } finally {
      runtime.ticking = false;
    }
    return done;
  }

  // One line a day is the whole point: without it, "is it still working?" turns
  // into a question you answer by reading logs.
  function writeReceiptIfDue(now) {
    const day = new Date(now).toISOString().slice(0, 10);
    const hour = new Date(now).getHours();
    if (state.lastReceiptDay === day || hour < 23) return;
    const previous = new Date(now - 86_400_000).toISOString().slice(0, 10);
    const summary = summarizeDay(ledgerPath, previous);
    state.lastReceiptDay = day;
    saveState();
    if (!summary.runs) return;
    appendLedger(ledgerPath, { type: 'receipt', ...summary });
    log(`receipt ${previous}: ${summary.ok}/${summary.runs} ok, $${summary.costUsd.toFixed(4)}`);
  }

  function status() {
    const entries = loadWorkflows(workflowsDir);
    return {
      running: runtime.current,
      lastError: runtime.lastError,
      workflows: entries.map((entry) => {
        const s = stateFor(entry.name);
        return {
          name: entry.name,
          description: entry.data.description || '',
          schedule: entry.scheduleText,
          enabled: entry.enabled,
          budgetUsd: entry.budgetUsd,
          budget: entry.budgetText,
          lastDue: s.lastDue ? new Date(s.lastDue).toISOString() : null,
          lastRun: s.lastRun ? new Date(s.lastRun).toISOString() : null,
          lastOk: s.lastOk,
          nextRunAt: entry.schedule ? new Date(nextRunAt(entry.schedule, s.lastDue)).toISOString() : null,
        };
      }),
    };
  }

  let timer = null;
  function arm() {
    // Re-align to the next whole minute every time: a plain setInterval drifts,
    // and a drifted tick is how "daily at 08:00" quietly becomes "08:00:47".
    const delay = TICK_MS - (Date.now() % TICK_MS);
    timer = setTimeout(async () => {
      await tick();
      if (timer) arm();
    }, delay);
  }

  loadState();

  return {
    tick,
    status,
    execute,
    start() {
      const tz = timezoneInfo();
      log(`watching ${workflowsDir}`);
      log(`schedules use ${tz.name} (UTC${tz.offset >= 0 ? '+' : ''}${tz.offset})`);
      if (tz.utc && !process.env.TZ) {
        log('warning: this machine is on UTC — set TZ=Asia/Shanghai (or your zone) if "daily 08:00" should mean local time');
      }
      arm();
      tick();
      return this;
    },
    stop() {
      if (timer) clearTimeout(timer);
      timer = null;
    },
  };
}

// ── CLI ────────────────────────────────────────────────────────────────────

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (isMain) {
  const argv = process.argv.slice(2);
  const root = process.cwd();
  const daemon = createDaemon({ root });

  if (argv.includes('--list')) {
    const { workflows } = daemon.status();
    if (!workflows.length) console.log('no workflows found in ./workflows');
    for (const w of workflows) {
      const last = w.lastRun ? `${w.lastRun}${w.lastOk === false ? ' FAILED' : ''}` : 'never';
      console.log(`${w.name.padEnd(22)} ${(w.schedule || 'manual').padEnd(16)} next ${w.nextRunAt || '-'}  last ${last}`);
    }
    process.exit(0);
  }

  if (argv.includes('--run')) {
    const name = argv[argv.indexOf('--run') + 1];
    const entry = loadWorkflows(path.join(root, 'workflows')).find((w) => w.name === name);
    if (!entry) {
      console.error(`no workflow named ${name}`);
      process.exit(1);
    }
    daemon.execute(entry, Date.now()).then((result) => {
      process.exit(result.ok ? 0 : 1);
    });
  } else if (argv.includes('--once')) {
    daemon.tick().then((results) => {
      console.log(`[daemon] tick finished, ${results.length} task(s)`);
      process.exit(0);
    });
  } else {
    daemon.start();
    const shutdown = () => {
      daemon.stop();
      console.log('\n[daemon] stopped');
      process.exit(0);
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  }
}
