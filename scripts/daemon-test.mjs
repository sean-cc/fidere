// Unit tests for the scheduler's pure parts: frontmatter, schedule parsing,
// trigger arithmetic and the daily summary. Nothing here spawns a model.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  loadWorkflows,
  mostRecentTrigger,
  nextRunAt,
  parseBudget,
  parseFrontmatter,
  parseSchedule,
  scaffoldWorkflow,
  timezoneInfo,
} from '../daemon.js';
import { summarizeDay } from '../runner.js';

const DEFAULT_BUDGET = 0.3;

// ── Frontmatter ────────────────────────────────────────────────────────────

test('frontmatter: flat keys, quoted values and a body', () => {
  const { data, body } = parseFrontmatter(`---
name: demo
schedule: "daily 08:00"
budget: 0.3
---

# Title

Body line.
`);
  assert.equal(data.name, 'demo');
  assert.equal(data.schedule, 'daily 08:00');
  assert.equal(data.budget, '0.3');
  assert.match(body, /^# Title/);
});

test('frontmatter: quotes are only stripped in pairs', () => {
  const { data } = parseFrontmatter(`---
name: "demo"
notify: sh -c 'echo hi'
---

body
`);
  assert.equal(data.name, 'demo');
  assert.equal(data.notify, "sh -c 'echo hi'");
});

test('frontmatter: a file without it is all body', () => {
  const { data, body } = parseFrontmatter('# Just content\n');
  assert.deepEqual(data, {});
  assert.equal(body, '# Just content\n');
});

test('frontmatter: an unterminated block is not silently half-parsed', () => {
  const text = '---\nname: demo\n# no closing fence\n';
  const { data, body } = parseFrontmatter(text);
  assert.deepEqual(data, {});
  assert.equal(body, text);
});

// ── Schedules ──────────────────────────────────────────────────────────────

test('schedule: every accepts minutes and hours', () => {
  assert.deepEqual(parseSchedule('every 15m'), { kind: 'every', intervalMs: 900_000 });
  assert.deepEqual(parseSchedule('every 2h'), { kind: 'every', intervalMs: 7_200_000 });
});

test('schedule: daily and weekdays parse a clock time', () => {
  assert.deepEqual(parseSchedule('daily 08:00'), { kind: 'daily', hour: 8, minute: 0 });
  assert.deepEqual(parseSchedule('weekdays 07:30'), { kind: 'weekdays', hour: 7, minute: 30 });
});

test('schedule: invalid values are rejected instead of guessed', () => {
  for (const bad of ['', 'every 0', 'every 5s', 'daily 25:00', 'daily 8:60', 'cron 0 8 * * *', null]) {
    assert.equal(parseSchedule(bad), null, `${bad} should not parse`);
  }
});

// 2026-11-13 is a Friday. All expectations below are in local time.
const friday = (h, m = 0) => new Date(2026, 10, 13, h, m, 0, 0).getTime();
const saturday = (h, m = 0) => new Date(2026, 10, 14, h, m, 0, 0).getTime();

test('trigger: daily returns today when the time has passed, yesterday otherwise', () => {
  const daily = parseSchedule('daily 08:00');
  assert.equal(mostRecentTrigger(daily, friday(9)), friday(8));
  assert.equal(mostRecentTrigger(daily, friday(7)), new Date(2026, 10, 12, 8).getTime());
});

test('trigger: weekdays skips a weekend when looking back', () => {
  const weekdays = parseSchedule('weekdays 08:00');
  // Saturday morning: the most recent weekday trigger is Friday 08:00.
  assert.equal(mostRecentTrigger(weekdays, saturday(9)), friday(8));
});

test('next run: daily points at tomorrow once today has fired', () => {
  const daily = parseSchedule('daily 08:00');
  const fired = friday(8);
  assert.equal(nextRunAt(daily, fired, friday(9)), new Date(2026, 10, 14, 8).getTime());
});

test('next run: every uses the last due time, not the last run time', () => {
  const every = parseSchedule('every 15m');
  assert.equal(nextRunAt(every, 1_000_000, 5_000_000), 1_900_000);
  assert.equal(nextRunAt(every, null, 5_000_000), 5_900_000);
});

test('timezone: reports a name and an offset', () => {
  const tz = timezoneInfo();
  assert.equal(typeof tz.name, 'string');
  assert.ok(Number.isFinite(tz.offset));
  assert.equal(typeof tz.utc, 'boolean');
});

// ── Discovery ──────────────────────────────────────────────────────────────

test('loadWorkflows reads only directories with a SKILL.md', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fidere-wf-'));
  fs.mkdirSync(path.join(root, 'with-skill'));
  fs.mkdirSync(path.join(root, 'no-skill'));
  fs.writeFileSync(path.join(root, 'with-skill', 'SKILL.md'), `---
name: with-skill
description: demo
schedule: daily 08:00
budget: 0.25
verify: node verify.mjs
tools: read,write
---

Do the thing.
`);
  fs.writeFileSync(path.join(root, 'no-skill', 'README.md'), 'not a workflow');

  const entries = loadWorkflows(root);
  assert.equal(entries.length, 1);
  const [entry] = entries;
  assert.equal(entry.name, 'with-skill');
  assert.equal(entry.budgetUsd, 0.25);
  assert.equal(entry.verify, 'node verify.mjs');
  assert.deepEqual(entry.tools, ['read', 'write']);
  assert.equal(entry.schedule.kind, 'daily');
  assert.match(entry.body, /Do the thing/);
  fs.rmSync(root, { recursive: true, force: true });
});

// ── Scaffolding ────────────────────────────────────────────────────────────

test('scaffoldWorkflow writes a workflow the loader can read', () => {
  process.env.FIDERE_USD_CNY = '7.2';
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fidere-new-'));
  const dir = scaffoldWorkflow(root, 'my-task');
  assert.ok(fs.existsSync(path.join(dir, 'SKILL.md')));
  assert.ok(fs.existsSync(path.join(dir, 'verify.mjs')));

  const entries = loadWorkflows(path.join(root, 'workflows'));
  assert.equal(entries.length, 1);
  const [entry] = entries;
  assert.equal(entry.name, 'my-task');
  assert.equal(entry.budgetUsd, 0.055556);
  // schedule, verify and notify stay commented out: a new workflow is manual-only
  // until its author decides otherwise.
  assert.equal(entry.schedule, null);
  assert.equal(entry.verify, null);
  assert.equal(entry.notify, null);
  assert.deepEqual(entry.tools, ['read', 'write', 'edit', 'bash']);
  fs.rmSync(root, { recursive: true, force: true });
});

test('scaffoldWorkflow refuses bad names and existing directories', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fidere-new-'));
  assert.throws(() => scaffoldWorkflow(root, 'Bad_Name'), /lowercase/);
  assert.throws(() => scaffoldWorkflow(root, ''), /lowercase/);
  scaffoldWorkflow(root, 'ok-name');
  assert.throws(() => scaffoldWorkflow(root, 'ok-name'), /already exists/);
  fs.rmSync(root, { recursive: true, force: true });
});

// ── Receipt ────────────────────────────────────────────────────────────────

test('summarizeDay counts only that day and only run records', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fidere-ledger-'));
  const ledger = path.join(dir, 'ledger.jsonl');
  const rows = [
    { type: 'run', name: 'a', startedAt: '2026-11-13T08:00:00.000Z', ok: true, costUsd: 0.01 },
    { type: 'run', name: 'a', startedAt: '2026-11-13T20:00:00.000Z', ok: false, costUsd: 0.02 },
    { type: 'run', name: 'b', startedAt: '2026-11-12T08:00:00.000Z', ok: true, costUsd: 0.5 },
    { type: 'skip', name: 'a', dueAt: '2026-11-13T09:00:00.000Z', reason: 'late' },
  ];
  fs.writeFileSync(ledger, rows.map((r) => JSON.stringify(r)).join('\n') + '\nnot json\n');

  const summary = summarizeDay(ledger, '2026-11-13');
  assert.equal(summary.runs, 2);
  assert.equal(summary.ok, 1);
  assert.equal(summary.failed, 1);
  assert.equal(summary.costUsd, 0.03);
  assert.deepEqual(summary.byWorkflow.a, { runs: 2, failed: 1, costUsd: 0.03 });
  fs.rmSync(dir, { recursive: true, force: true });
});

// ── Budgets ────────────────────────────────────────────────────────────────

test('budget: bare numbers are USD, symbols pick the currency', () => {
  process.env.FIDERE_USD_CNY = '7.2';
  assert.equal(parseBudget('0.05'), 0.05);
  assert.equal(parseBudget('$0.05'), 0.05);
  assert.equal(parseBudget('¥7.2'), 1);
  assert.equal(parseBudget('￥3.6'), 0.5);
  assert.equal(parseBudget('CNY 7.2'), 1);
  assert.equal(parseBudget(undefined), DEFAULT_BUDGET);
  assert.equal(parseBudget('nonsense'), DEFAULT_BUDGET);
});
