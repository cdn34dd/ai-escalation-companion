#!/bin/bash
set -euo pipefail
HOST_NAME="com.datadog.ai_escalation_companion"
EXTENSION_ID="${1:-${EXTENSION_ID:-}}"
if [[ ! "$EXTENSION_ID" =~ ^[a-p]{32}$ ]]; then
    echo "Usage: bash setup.sh <Chrome extension ID>" >&2
    exit 1
fi
INSTALL_DIR="$(cd "$(dirname "$0")" && pwd)"
export PATH="${PATH:-/usr/bin:/bin}:/opt/homebrew/bin:/usr/local/bin"
NODE_BIN="${NODE_BIN:-$(command -v node || true)}"
if [ -z "$NODE_BIN" ]; then
    echo "Node.js not found. Set NODE_BIN to an absolute Node executable." >&2
    exit 1
fi
CHROME_NATIVE_DIR="${CHROME_NATIVE_DIR:-$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts}"
mkdir -p "$CHROME_NATIVE_DIR"
# Generate escaped JSON and a wrapper containing the resolved executable paths.
"$NODE_BIN" - "$INSTALL_DIR" "$CHROME_NATIVE_DIR" "$EXTENSION_ID" "$NODE_BIN" "${CLAUDE_BIN:-$(command -v claude || true)}" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');
const [dir, target, extensionId, node, claude] = process.argv.slice(2);
if (!claude) throw new Error('Claude Code was not found. Set CLAUDE_BIN to its absolute executable path.');
fs.accessSync(claude, fs.constants.X_OK);
const quote = (text) => "'" + text.replace(/'/g, "'\\''") + "'";
const host = path.join(dir, 'host');
const executablePath = [path.dirname(node), path.dirname(claude), '/opt/homebrew/bin', '/usr/local/bin'].join(':');
const wrapper = '#!/bin/bash\nexport PATH=' + quote(executablePath) + ':"${PATH:-/usr/bin:/bin}"\n'
  + `export CLAUDE_BIN=${quote(claude)}\nexec ${quote(node)} ${quote(path.join(dir, 'host.js'))}\n`;
fs.writeFileSync(host, wrapper, { mode: 0o755 });
fs.chmodSync(host, 0o755);
const manifest = { name: 'com.datadog.ai_escalation_companion', description: 'AI Escalation Companion native host', path: host, type: 'stdio', allowed_origins: [`chrome-extension://${extensionId}/`] };
fs.writeFileSync(path.join(target, manifest.name + '.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`Registered native host at ${host}`);
NODE
