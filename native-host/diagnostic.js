const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const path = require('node:path');
function diagnose(text, paths = [], summary = false) {
  const host = spawn(process.execPath, [path.join(__dirname, 'host.js')]);
  let buffer = Buffer.alloc(0);
  const timeout = setTimeout(() => { console.error('Diagnostic timed out.'); host.kill(); process.exitCode = 1; }, 190000);
  host.stdout.on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    while (buffer.length >= 4 && buffer.length >= buffer.readUInt32LE() + 4) {
      const length = buffer.readUInt32LE();
      const message = JSON.parse(buffer.subarray(4, length + 4));
      buffer = buffer.subarray(length + 4);
      console.log(message.type, message.text || message.error || '');
      if (message.type.endsWith('_COMPLETE') || message.type.endsWith('_ERROR')) {
        clearTimeout(timeout); host.stdin.end(); host.kill();
        process.exitCode = message.type.endsWith('_ERROR') ? 1 : 0;
      }
    }
  });
  host.stderr.pipe(process.stderr);
  host.on('error', (error) => { console.error(error.message); clearTimeout(timeout); process.exitCode = 1; });
  host.on('close', () => clearTimeout(timeout));
  const payload = Buffer.from(JSON.stringify({ type: summary ? 'SUMMARIZE_HOST_START' : 'ASK_HOST_START', requestId: randomUUID(), sessionId: randomUUID(), text, paths }));
  const header = Buffer.alloc(4); header.writeUInt32LE(payload.length);
  host.stdin.write(Buffer.concat([header, payload]));
}
module.exports = { diagnose };
