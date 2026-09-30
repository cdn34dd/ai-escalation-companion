const fs = require('node:fs/promises');
const path = require('node:path');
const readline = require('node:readline');

function createWorkspaceTools(roots) {
  if (!Array.isArray(roots) || roots.some((root) => typeof root !== 'string' || !path.isAbsolute(root))) {
    throw new Error('Workspace roots must be absolute directory paths.');
  }
  const canonicalRoots = Promise.all(roots.map((root) => fs.realpath(root)));
  const inside = (candidate, root) => {
    const relative = path.relative(root, candidate);
    return relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative));
  };
  async function resolve(value) {
    const selected = await canonicalRoots;
    if (typeof value !== 'string' || !value) throw new Error('A file or directory path is required.');
    const candidate = await fs.realpath(path.resolve(selected[0] || '.', value));
    if (!selected.some((root) => inside(candidate, root))) throw new Error('Path is outside the selected directories.');
    return candidate;
  }
  async function files(directory) {
    const result = [];
    const visited = new Set();
    async function walk(dir) {
      const real = await resolve(dir);
      if (visited.has(real)) return;
      visited.add(real);
      for (const entry of await fs.readdir(real, { withFileTypes: true })) {
        if (result.length >= 2000) break;
        if (['.git', 'node_modules', 'dist', '.env'].includes(entry.name) || entry.name.startsWith('.env.')) continue;
        const candidate = path.join(real, entry.name);
        let safe;
        try { safe = await resolve(candidate); } catch { continue; }
        const stat = await fs.stat(safe);
        if (stat.isDirectory()) await walk(safe);
        else if (stat.isFile()) result.push(safe);
      }
    }
    await walk(directory);
    return result;
  }
  async function read(file) {
    const safe = await resolve(file);
    const handle = await fs.open(safe, 'r');
    try {
      const stat = await handle.stat();
      if (!stat.isFile() || stat.size > 1024 * 1024) throw new Error('Select a text file smaller than 1 MiB.');
      const text = await handle.readFile('utf8');
      if (text.includes('\0')) throw new Error('Binary files are not supported.');
      return text;
    } finally { await handle.close(); }
  }
  function globRegex(pattern) {
    let regex = '';
    for (let i = 0; i < pattern.length; i++) {
      if (pattern.slice(i, i + 3) === '**/') { regex += '(?:.*/)?'; i += 2; }
      else if (pattern.slice(i, i + 2) === '**') { regex += '.*'; i++; }
      else if (pattern[i] === '*') regex += '[^/]*';
      else if (pattern[i] === '?') regex += '[^/]';
      else regex += pattern[i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    return new RegExp(`^${regex}$`);
  }
  return async function execute(name, input = {}) {
    if (name === 'Read') {
      const text = await read(input.file_path);
      const offset = Math.max(1, Number(input.offset) || 1);
      const limit = Math.min(500, Math.max(1, Number(input.limit) || 200));
      return text.split('\n').slice(offset - 1, offset - 1 + limit)
        .map((line, i) => `${offset + i}: ${line}`).join('\n').slice(0, 64000);
    }
    const directory = await resolve(input.path || (await canonicalRoots)[0]);
    if (name === 'Glob') {
      const regex = globRegex(input.pattern || '**/*');
      return (await files(directory)).filter((file) => regex.test(path.relative(directory, file).split(path.sep).join('/'))).join('\n').slice(0, 64000);
    }
    if (name === 'Grep') {
      if (typeof input.pattern !== 'string' || !input.pattern) throw new Error('A literal search pattern is required.');
      const matches = [];
      for (const file of await files(directory)) {
        let text;
        try { text = await read(file); } catch { continue; }
        text.split('\n').forEach((line, i) => {
          if (matches.length < 200 && line.includes(input.pattern)) matches.push(`${file}:${i + 1}: ${line.slice(0, 500)}`);
        });
        if (matches.length >= 200) break;
      }
      return matches.join('\n');
    }
    throw new Error(`Unknown workspace tool: ${name}`);
  };
}

const tools = [
  { name: 'Read', description: 'Read a text file within selected directories, with line numbers.', inputSchema: { type: 'object', properties: { file_path: { type: 'string' }, offset: { type: 'integer' }, limit: { type: 'integer' } }, required: ['file_path'] } },
  { name: 'Glob', description: 'Find files within selected directories. Supports *, **, and ? patterns.', inputSchema: { type: 'object', properties: { pattern: { type: 'string' }, path: { type: 'string' } }, required: ['pattern'] } },
  { name: 'Grep', description: 'Search text files for a literal string within selected directories.', inputSchema: { type: 'object', properties: { pattern: { type: 'string' }, path: { type: 'string' } }, required: ['pattern'] } },
];

if (require.main === module) {
  const execute = createWorkspaceTools(JSON.parse(process.env.WORKSPACE_ROOTS || '[]'));
  readline.createInterface({ input: process.stdin }).on('line', async (line) => {
    let request;
    try { request = JSON.parse(line); } catch { return; }
    if (request.id === undefined) return;
    try {
      let result;
      if (request.method === 'initialize') result = { protocolVersion: request.params.protocolVersion, capabilities: { tools: {} }, serverInfo: { name: 'selected-workspace', version: '1.0.0' } };
      else if (request.method === 'ping') result = {};
      else if (request.method === 'tools/list') result = { tools };
      else if (request.method === 'tools/call') {
        try { result = { content: [{ type: 'text', text: await execute(request.params.name, request.params.arguments) }] }; }
        catch (error) { result = { isError: true, content: [{ type: 'text', text: error.message }] }; }
      } else throw new Error('Unsupported method');
      process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: request.id, result }) + '\n');
    } catch (error) {
      process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: request.id, error: { code: -32601, message: error.message } }) + '\n');
    }
  });
}
module.exports = { createWorkspaceTools };
