import { MessageTypes, MessageRecipients, HostMessageTypes, type Message } from '../actions/types';
import { executeDBAction, type DBActionRequest } from '../db/dbActions';
import { db } from '../db/schema';
import { extensionSettingsDb } from '../db/extensionSettings';
import { localSettingsDb } from '../db/localSettings';
import { summariesDb } from '../db/summaries';
import { investigationsDb } from '../db/investigations';
import { RequestRouter, type HostMessage } from './requestRouter';

let port: chrome.runtime.Port | null = null;
function broadcast(message: Message) {
  void chrome.runtime.sendMessage(message).catch(() => { /* The UI may be closed. */ });
}
const router = new RequestRouter({
  broadcast,
  saveSummary: (url, data) => summariesDb.upsert({ url, data }),
  saveInvestigation: (request, text) => investigationsDb.completeTurn(request, text),
});

function connect() {
  if (port) return port;
  const connected = chrome.runtime.connectNative('com.datadog.ai_escalation_companion');
  port = connected;
  connected.onDisconnect.addListener(() => {
    const error = chrome.runtime.lastError?.message || 'Native host disconnected. Check the host installation and try again.';
    if (port === connected) port = null;
    router.disconnect(error);
    broadcast({ type: MessageTypes.SELECT_PATH_ERROR, recipient: MessageRecipients.POPUP, data: error });
  });
  connected.onMessage.addListener((message: HostMessage) => {
    if (message.type === HostMessageTypes.SELECT_HOST_PATH_COMPLETE && message.text) {
      void extensionSettingsDb.addPath(message.text).then(() => {
        broadcast({ type: MessageTypes.SELECT_PATH_COMPLETE, recipient: MessageRecipients.POPUP, data: message.text, requestId: message.requestId });
      }).catch((error: Error) => {
        broadcast({ type: MessageTypes.SELECT_PATH_ERROR, recipient: MessageRecipients.POPUP, data: error.message });
      });
    } else if (message.type === HostMessageTypes.SELECT_HOST_PATH_ERROR) {
      broadcast({ type: MessageTypes.SELECT_PATH_ERROR, recipient: MessageRecipients.POPUP, data: message.error || 'Folder selection failed.' });
    } else {
      void router.handle(message);
    }
  });
  return connected;
}

interface IncomingMessage extends Omit<Message, 'data'> {
  data?: string | DBActionRequest;
  kind?: 'summary' | 'investigation';
}
chrome.runtime.onMessage.addListener((message: IncomingMessage, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id || message.recipient !== MessageRecipients.SERVICE_WORKER) return false;
  if (message.type === MessageTypes.DB_ACTION_START) {
    if (!message.data || typeof message.data === 'string') { sendResponse({ success: false, error: 'Invalid database request.' }); return false; }
    void executeDBAction(message.data).then(sendResponse);
    return true;
  }
  if (message.type === MessageTypes.REQUEST_STATE_START) {
    const kind = message.kind || 'investigation';
    const url = message.url || '';
    const hadPending = !!router.state(url, kind);
    void (async () => {
      try {
        const saved = kind === 'summary' ? await db.summaries.get(url) : await db.investigations.get(url);
        sendResponse({ pending: router.state(url, kind) || null, hadPending, [kind === 'summary' ? 'summary' : 'investigation']: saved });
      } catch (error) { sendResponse({ error: String(error) }); }
    })();
    return true;
  }
  if (message.type === MessageTypes.SELECT_PATH_START) {
    try { connect().postMessage({ type: HostMessageTypes.SELECT_HOST_PATH_START, requestId: message.requestId }); sendResponse({ success: true }); }
    catch (error) { sendResponse({ success: false, error: String(error) }); }
    return false;
  }
  if (message.type !== MessageTypes.SUMMARIZE_CONTENT_START && message.type !== MessageTypes.INVESTIGATION_START) return false;
  void (async () => {
    const requestId = message.requestId || crypto.randomUUID();
    let started = false;
    try {
      if (!message.url || typeof message.data !== 'string' || !message.data.trim()) throw new Error('A page URL and non-empty prompt are required.');
      const kind = message.type === MessageTypes.SUMMARIZE_CONTENT_START ? 'summary' : 'investigation';
      const settings = kind === 'investigation' ? await localSettingsDb.get(message.url) : undefined;
      const sessionId = message.sessionId || crypto.randomUUID();
      const currentPort = connect();
      router.start({ kind, requestId, sessionId, url: message.url, text: '', toolUsage: [], userQuestion: message.userQuestion, resume: !!message.sessionId });
      started = true;
      currentPort.postMessage({
        type: kind === 'summary' ? HostMessageTypes.SUMMARIZE_HOST_START : HostMessageTypes.ASK_HOST_START,
        requestId, sessionId, resume: !!message.sessionId, text: message.data, paths: settings?.selectedPaths || [],
      });
      sendResponse({ success: true, requestId, sessionId });
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Could not start the request.';
      if (started) router.fail(requestId, text);
      sendResponse({ success: false, error: text });
    }
  })();
  return true;
});

void extensionSettingsDb.initialize();
void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
