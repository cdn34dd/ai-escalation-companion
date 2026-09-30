const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { once } = require('node:events');

const mockCode = `#!${process.execPath}
const fs = require('node:fs');
const args = process.argv.slice(2);
let prompt = '';
process.stdin.on('data', chunk => prompt += chunk);
process.stdin.on('end', () => {
  fs.appendFileSync(process.env.MOCK_CALLS_FILE, JSON.stringify({args, prompt, cwd: process.cwd()}) + '\\n');
  const config = JSON.parse(args[args.indexOf('--mcp-config') + 1]);
  const hasWorkspace = !!config.mcpServers.escalation_files;
  process.stdout.write(JSON.stringify({type:'system',subtype:'init',tools:prompt.includes('mock:missing-tools') ? [] : hasWorkspace ? ['mcp__escalation_files__Read','mcp__escalation_files__Glob','mcp__escalation_files__Grep'] : [],mcp_servers:[]})+'\\n');
  if (prompt.includes('mock:error')) { process.stdout.write(JSON.stringify({type:'result', is_error:true, errors:['Mock failure']})); return; }
  const text = prompt.includes('mock:second') ? 'second' : 'First response: café 🐕';
  const delay = prompt.includes('mock:slow') ? 2000 : prompt.includes('mock:second') ? 1 : 20;
  setTimeout(() => {
    const event = Buffer.from(JSON.stringify({type:'stream_event',event:{type:'content_block_delta',delta:{type:'text_delta',text}}})+'\\n');
    const split = event.indexOf(Buffer.from('é')) + 1;
    process.stdout.write(event.subarray(0, split));
    setTimeout(() => { process.stdout.write(event.subarray(split)); process.stdout.write(JSON.stringify({type:'result',is_error:false,result:text})); }, 5);
  }, delay);
});
`;
async function hostFixture(t, extra = {}) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'native-host-test-'));
  const mock = path.join(dir, 'mock-claude');
  await fs.writeFile(mock, mockCode, { mode: 0o755 });
  const calls = path.join(dir, 'calls.jsonl');
  const host = spawn(process.execPath, [path.join(__dirname, '..', 'host.js')], {
    env: { ...process.env, CLAUDE_BIN: mock, CLAUDE_CONFIG_DIR: dir, CLAUDE_AUTH_SETTINGS_FILE: path.join(dir, 'auth.json'), NATIVE_HOST_LOG: path.join(dir, 'host.log'), MOCK_CALLS_FILE: calls, ...extra },
  });
  let buffer = Buffer.alloc(0);
  const messages = [];
  host.stdout.on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    while (buffer.length >= 4 && buffer.length >= 4 + buffer.readUInt32LE()) {
      const length = buffer.readUInt32LE();
      messages.push(JSON.parse(buffer.subarray(4, length + 4)));
      buffer = buffer.subarray(length + 4);
    }
  });
  t.after(async () => { const closed = host.exitCode === null ? once(host, 'close') : Promise.resolve(); host.stdin.end(); host.kill(); await closed; await fs.rm(dir, { recursive: true, force: true }); });
  function send(message, fragmented = false) {
    const payload = Buffer.from(JSON.stringify(message));
    const header = Buffer.alloc(4); header.writeUInt32LE(payload.length);
    const bytes = Buffer.concat([header, payload]);
    if (fragmented) { host.stdin.write(bytes.subarray(0, 2)); host.stdin.write(bytes.subarray(2, 7)); host.stdin.write(bytes.subarray(7)); }
    else host.stdin.write(bytes);
  }
  async function waitFor(count) {
    const deadline = Date.now() + 4000;
    while (messages.filter((message) => /_(COMPLETE|ERROR)$/.test(message.type)).length < count) {
      if (Date.now() > deadline) throw new Error('Host did not respond.');
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    return messages;
  }
  return { dir, calls, send, waitFor };
}
function request(text, fields = {}) { return { type: 'ASK_HOST_START', requestId: randomUUID(), sessionId: randomUUID(), text, paths: [], ...fields }; }

test('fragmented native frames, Unicode chunks, and final JSON without a newline', async (t) => {
  const host = await hostFixture(t);
  const input = request('mock:unicode'); host.send(input, true);
  const messages = await host.waitFor(1);
  const complete = messages.find((message) => message.type === 'ASK_HOST_COMPLETE');
  assert.equal(complete.text, 'First response: café 🐕');
  assert.equal(complete.requestId, input.requestId); assert.equal(complete.sessionId, input.sessionId);
  const [{ args }] = (await fs.readFile(host.calls, 'utf8')).trim().split('\n').map(JSON.parse);
  assert.ok(args.includes('--print')); assert.ok(!args.includes('--dangerously-skip-permissions'));
  assert.equal(args[args.indexOf('--tools') + 1], '');
  assert.equal(args[args.indexOf('--mcp-config') + 1], '{"mcpServers":{}}');
});
test('invalid selected paths do not poison subsequent messages', async (t) => {
  const host = await hostFixture(t);
  const invalid = request('bad path', { paths: [path.join(host.dir, 'missing')] });
  const valid = request('mock:valid'); host.send(invalid); host.send(valid);
  const messages = await host.waitFor(2);
  assert.ok(messages.some((message) => message.type === 'ASK_HOST_ERROR' && message.requestId === invalid.requestId));
  assert.ok(messages.some((message) => message.type === 'ASK_HOST_COMPLETE' && message.requestId === valid.requestId));
});
test('concurrent requests retain their own IDs even when completions reverse order', async (t) => {
  const host = await hostFixture(t);
  const first = request('mock:first'); const second = request('mock:second'); host.send(first); host.send(second);
  const complete = (await host.waitFor(2)).filter((message) => message.type === 'ASK_HOST_COMPLETE');
  assert.equal(complete.find((message) => message.requestId === first.requestId).text, 'First response: café 🐕');
  assert.equal(complete.find((message) => message.requestId === second.requestId).text, 'second');
});
test('summary uses print mode and reports result errors despite a zero exit code', async (t) => {
  const host = await hostFixture(t);
  const input = request('mock:error', { type: 'SUMMARIZE_HOST_START' }); host.send(input);
  const [error] = await host.waitFor(1);
  assert.equal(error.type, 'SUMMARIZE_HOST_ERROR'); assert.equal(error.error, 'Mock failure');
});
test('missing executables and request timeouts return correlated errors', async (t) => {
  const missing = await hostFixture(t, { CLAUDE_BIN: '/missing/claude' });
  const first = request('test'); missing.send(first);
  assert.equal((await missing.waitFor(1))[0].requestId, first.requestId);
  const slow = await hostFixture(t, { CLAUDE_TIMEOUT_MS: '50' }); slow.send(request('mock:slow'));
  assert.match((await slow.waitFor(1))[0].error, /timed out/);
});
test('workspace configuration exposes only confined tools and valid resume arguments', async (t) => {
  const host = await hostFixture(t);
  const input = request('mock:inspect', { paths: [host.dir], resume: true }); host.send(input);
  await host.waitFor(1);
  const [{ args, cwd }] = (await fs.readFile(host.calls, 'utf8')).trim().split('\n').map(JSON.parse);
  assert.equal(cwd, await fs.realpath(host.dir));
  assert.equal(args[args.indexOf('--resume') + 1], input.sessionId);
  const config = JSON.parse(args[args.indexOf('--mcp-config') + 1]);
  assert.deepEqual(JSON.parse(config.mcpServers.escalation_files.env.WORKSPACE_ROOTS), [await fs.realpath(host.dir)]);
  assert.ok(args.includes('mcp__escalation_files__Read'));
});

test('missing workspace tools stop investigations instead of returning fabricated analysis', async (t) => {
  const host = await hostFixture(t);
  const input = request('mock:missing-tools', { paths: [host.dir] }); host.send(input);
  const messages = await host.waitFor(1);
  assert.equal(messages[0].type, 'ASK_HOST_ERROR');
  assert.match(messages[0].error, /read-only workspace tools/);
  assert.ok(!messages.some((message) => message.type === 'ASK_HOST_COMPLETE'));
});
