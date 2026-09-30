const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

test('installer registers the supplied extension and safely quotes executable paths', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "host setup's "));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const installation = path.join(dir, 'install with spaces');
  await fs.mkdir(installation);
  await fs.copyFile(path.join(__dirname, '..', 'setup.sh'), path.join(installation, 'setup.sh'));
  await fs.writeFile(path.join(dir, "Claude's executable"), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
  const manifestDirectory = path.join(dir, 'manifests');
  const extension = 'abcdefghijklmnopabcdefghijklmnop';
  const result = spawnSync('bash', [path.join(installation, 'setup.sh'), extension], { env: { ...process.env, NODE_BIN: process.execPath, CLAUDE_BIN: path.join(dir, "Claude's executable"), CHROME_NATIVE_DIR: manifestDirectory }, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const manifest = JSON.parse(await fs.readFile(path.join(manifestDirectory, 'com.datadog.ai_escalation_companion.json'), 'utf8'));
  assert.deepEqual(manifest.allowed_origins, [`chrome-extension://${extension}/`]);
  assert.equal(manifest.path, path.join(installation, 'host'));
  const wrapper = await fs.readFile(manifest.path, 'utf8');
  assert.equal(spawnSync('bash', ['-n', manifest.path]).status, 0);
  assert.match(wrapper, /CLAUDE_BIN=/);
  const invalid = spawnSync('bash', [path.join(installation, 'setup.sh'), 'invalid'], { encoding: 'utf8' });
  assert.equal(invalid.status, 1);
  assert.match(invalid.stderr, /Usage/);
});
