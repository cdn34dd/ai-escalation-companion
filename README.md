# AI Escalation Companion

A Chrome side-panel extension that extracts Jira tickets and GitHub issues, generates summaries, and investigates selected local code directories through Claude Code. Responses stream into the panel; summaries, conversations, session IDs, and tool history are saved in IndexedDB.

The extension talks directly to a Chrome native messaging host. No HTTP server is required.

## Setup

Requirements: macOS, Chrome with the Side Panel API, Node.js 24.11.1, Yarn Classic 1.22.22, and an authenticated Claude Code CLI. The live native-host integration was verified with Claude Code 2.1.280.

From the repository root:

```sh
nvm use
corepack yarn --cwd popup-ui install --frozen-lockfile
npm run check
```

`npm run check` runs lint, the regression tests, TypeScript checks, and both extension builds. The native host has no package dependencies. Yarn is the dependency manager for the frontend; root npm commands only invoke scripts.

1. Open `chrome://extensions` and enable **Developer mode**.
2. Choose **Load unpacked** and select `popup-ui/`, which contains `manifest.json`. Do not select `dist/`.
3. Copy the extension ID shown by Chrome.
4. Register the native host:

   ```sh
   bash native-host/setup.sh YOUR_CHROME_EXTENSION_ID
   ```

5. Reload the extension and the Jira or GitHub tab. Click the extension action to open the side panel.

The installer resolves the current Node and Claude executables and copies the native runtime into `~/Library/Application Support/AI Escalation Companion/`. This keeps Chrome's executable outside development folders that macOS may restrict, such as Documents or Desktop. It writes Chrome's registration manifest to `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.datadog.ai_escalation_companion.json`.

For a custom installation, provide absolute executable paths:

```sh
NODE_BIN=/absolute/path/to/node CLAUDE_BIN=/absolute/path/to/claude \
  bash native-host/setup.sh YOUR_CHROME_EXTENSION_ID
```

Run the installer again after changing native-host code or the Node/Claude installation. Moving the repository does not affect the installed host. `HOST_INSTALL_DIR` and `CHROME_NATIVE_DIR` override the runtime and registration directories for custom installations.

## Using the extension

- **Summarize** loads a saved summary or generates one for the active ticket. **Regenerate** refreshes it.
- **New Investigation** starts a new session for the active ticket. Follow-up questions reuse that session.
- **Resume Investigation** restores the saved conversation and tool history for the current page.
- **Generic Chat** provides a persistent general conversation independent of the active ticket.
- **Settings** lets you add directories with the macOS folder picker and select which directories apply to the current page. Generic Chat has its own directory selection.

Select directories before starting a code investigation. Without selected directories, Claude can discuss the supplied ticket text but cannot inspect local code. Removing an available directory also removes it from every page's selection.

The content script extracts the visible ticket/issue body and comments. Tab changes and DOM updates refresh extraction, including navigation without a full page reload. Jira Cloud organizations, Jira `/browse/` and `/jira/` pages, and GitHub issues/pull requests are recognized. Zendesk is not implemented.

## Architecture

| Location | Responsibility |
| --- | --- |
| `popup-ui/src/content.ts`, `processing/extractor/` | Extract fresh page content and announce DOM changes. |
| `popup-ui/src/App.tsx`, `screens/`, `components/` | Side-panel navigation, directory settings, summaries, and chat. |
| `popup-ui/src/hooks/useInvestigation.ts` | Stream handling, errors, session restoration, and reattachment to running requests. |
| `popup-ui/src/rendering/markdown.ts` | Markdown/code rendering with DOMPurify sanitization. |
| `popup-ui/src/worker/` | Request correlation, native messaging, and completion delivery after persistence. |
| `popup-ui/src/db/` | Dexie tables, typed RPC helpers, and transactional conversation updates. |
| `native-host/host.js` | Native message framing, Claude process lifecycle, streaming, timeouts, and CLI capability checks. |
| `native-host/workspace-tools.js` | Read-only MCP tools restricted to selected directory roots. |
| `native-host/setup.sh` | Generate the executable wrapper and register it with Chrome on macOS. |

Every AI request has a request ID, session ID, and page URL. The background worker owns conversation writes and saves complete responses and tool history before notifying the UI. Different pages can run requests concurrently; overlapping requests of the same kind for one page are rejected. Closing and reopening the UI reattaches to a running request while the worker/native connection remains alive.

Code investigations expose only `Read`, `Glob`, and `Grep` through the `escalation_files` MCP server. The server resolves canonical paths and checks symlink targets against selected roots. It exposes no shell or write tools. Built-in Claude tools are disabled, and the host rejects sessions whose reported tool list does not match the expected read-only tools. A harmless CLI `EndConversation` tool is permitted if present.

The host preserves authentication helper/environment settings from user and managed Claude settings. Project settings sources and hooks are disabled for these calls, and the MCP configuration is explicitly restricted. See the [official Claude CLI reference](https://code.claude.com/docs/en/cli-reference) for the underlying flags. `workspace` must not be used as the MCP server name: the tested CLI treats it as reserved and skips it.

## Development and validation

```sh
npm run lint
npm test
npm run build
```

Frontend watch builds:

```sh
cd popup-ui
corepack yarn dev:watch
```

Reload Chrome's extension and the ticket tab after rebuilding. `yarn dev` runs a UI development server; the functional UI needs a Chrome extension context for Chrome APIs.

Validation completed with Node.js 24.11.1:

- ESLint passes.
- TypeScript and both Vite builds pass.
- Ten native-host regression tests pass: framing, Unicode streaming, invalid paths, concurrent requests, error results, startup failures, timeouts, missing tools, directory boundaries, symlinks, installation quoting, and closed Chrome output pipes.
- Twenty-two frontend regression tests pass: routing, storage ordering, history preservation, HTML sanitization, extraction, StrictMode, recovery, retries, and active-tab changes.
- A live Claude check loaded all three MCP tools, invoked `Read`, and returned the actual marker from a temporary file.
- Manual Chrome testing confirmed the native host works after installing its runtime in Application Support instead of launching it from the Documents checkout.

Automated tests use a mock Claude process and do not consume model usage. One manual integration diagnostic is available for a real Claude process:

```sh
node native-host/test-host-integration.js
```

The manual diagnostic inspects the native-host directory and uses your Claude authentication; it can consume model usage. Runtime errors and tool initialization details are logged to `~/native_host_debug.log`. `NATIVE_HOST_LOG` overrides this path. `NATIVE_HOST_CLAUDE_DEBUG` enables a separate CLI debug log when troubleshooting.

For **Native host has exited**, rerun the installer, reload the extension, and retry. Check current timestamps in `~/native_host_debug.log` for startup/exit messages. If the host cannot start Node, the launcher captures its errors in `~/Library/Application Support/AI Escalation Companion/host-stderr.log`. No startup entry indicates a failure before the JavaScript runtime started. Old `/snapshot/` stack traces belong to the retired packaged host.

Runtime options: `CLAUDE_BIN` chooses the Claude executable, `CLAUDE_MODEL` defaults to `sonnet`, and `CLAUDE_TIMEOUT_MS` defaults to 180000. `CLAUDE_CONFIG_DIR` selects an alternate Claude configuration directory; `CLAUDE_AUTH_SETTINGS_FILE` can explicitly select authentication settings for specialized installations.
