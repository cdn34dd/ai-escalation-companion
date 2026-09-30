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
  for (const file of ['host.js', 'workspace-tools.js']) {
    await fs.copyFile(path.join(__dirname, '..', file), path.join(installation, file));
  }
  await fs.writeFile(path.join(dir, "Claude's executable"), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
  const manifestDirectory = path.join(dir, 'manifests');
  const runtimeDirectory = path.join(dir, 'Application Support', "Companion's runtime");
  const extension = 'abcdefghijklmnopabcdefghijklmnop';
  const result = spawnSync('bash', [path.join(installation, 'setup.sh'), extension], { env: { ...process.env, NODE_BIN: process.execPath, CLAUDE_BIN: path.join(dir, "Claude's executable"), CHROME_NATIVE_DIR: manifestDirectory, HOST_INSTALL_DIR: runtimeDirectory }, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const manifest = JSON.parse(await fs.readFile(path.join(manifestDirectory, 'com.datadog.ai_escalation_companion.json'), 'utf8'));
  assert.deepEqual(manifest.allowed_origins, [`chrome-extension://${extension}/`]);
  assert.equal(manifest.path, path.join(runtimeDirectory, 'host'));
  const wrapper = await fs.readFile(manifest.path, 'utf8');
  assert.equal(spawnSync('bash', ['-n', manifest.path]).status, 0);
  assert.match(wrapper, /CLAUDE_BIN=/);
  const invalid = spawnSync('bash', [path.join(installation, 'setup.sh'), 'invalid'], { encoding: 'utf8' });
  assert.equal(invalid.status, 1);
  assert.match(invalid.stderr, /Usage/);
  // Exercise the registered executable after removing its source checkout.
  await fs.rm(installation, { recursive: true, force: true });
  const payload = Buffer.from(JSON.stringify({ type: 'SUMMARIZE_HOST_START', requestId: 'startup-probe', text: '' }));
  const header = Buffer.alloc(4); header.writeUInt32LE(payload.length);
  const logFile = path.join(dir, 'host.log');
  const probe = spawnSync(manifest.path, [`chrome-extension://${extension}/`], {
    cwd: runtimeDirectory, env: { HOME: dir, PATH: '/usr/bin:/bin', NATIVE_HOST_LOG: logFile },
    input: Buffer.concat([header, payload]), timeout: 5000,
  });
  assert.equal(probe.status, 0, probe.stderr.toString());
  assert.equal(probe.stdout.length, 4 + probe.stdout.readUInt32LE());
  const response = JSON.parse(probe.stdout.subarray(4));
  assert.equal(response.type, 'SUMMARIZE_HOST_ERROR');
  assert.equal(response.requestId, 'startup-probe');
  assert.match(await fs.readFile(logFile, 'utf8'), /Native host started/);
  assert.equal(await fs.readFile(path.join(runtimeDirectory, 'host-stderr.log'), 'utf8'), '');
  assert.equal(await fs.readFile(path.join(runtimeDirectory, 'workspace-tools.js'), 'utf8'), await fs.readFile(path.join(__dirname, '..', 'workspace-tools.js'), 'utf8'));
});
