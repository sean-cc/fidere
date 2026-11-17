import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { compareVersions, isEntryPoint } from './start.mjs';

test('compareVersions orders releases correctly', () => {
  assert.equal(compareVersions('1.4.0', '1.4.0'), 0);
  assert.equal(compareVersions('v1.4.0', '1.4.0'), 0);
  assert.equal(compareVersions('1.10.0', '1.9.9'), 1);
  assert.equal(compareVersions('2.0.0', '1.99.99'), 1);
  assert.equal(compareVersions('1.4.1', '1.4.0'), 1);
  assert.equal(compareVersions('1.4.0', '1.5.0'), -1);
});

test('compareVersions treats a release as newer than its prerelease', () => {
  assert.equal(compareVersions('1.5.0', '1.5.0-beta.1'), 1);
  assert.equal(compareVersions('1.5.0-beta.2', '1.5.0-beta.1'), 1);
  assert.equal(compareVersions('1.5.0-beta.1', '1.5.0'), -1);
});

// Windows only lets an elevated process (or Developer Mode) create symlinks,
// and this repository does not assume either.
test('a bin symlink is recognised as the entry point', { skip: process.platform === 'win32' }, async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'fidere-entry-'));
  try {
    const real = path.join(dir, 'start.mjs');
    const link = path.join(dir, 'fidere');
    await writeFile(real, '// stand-in for the real script\n');
    await symlink(real, link);
    const url = pathToFileURL(real).href;
    assert.equal(isEntryPoint(real, url), true, 'the file itself must run');
    assert.equal(isEntryPoint(link, url), true, 'npm installs bins as symlinks');
    assert.equal(isEntryPoint(path.join(dir, 'other.mjs'), url), false);
    assert.equal(isEntryPoint(undefined, url), false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
