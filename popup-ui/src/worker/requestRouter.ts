import { HostMessageTypes, MessageRecipients, MessageTypes, type Message, type RequestState } from '../actions/types';
import type { Investigation, ToolUsageEntry } from '../db/schema';

export interface HostMessage {
  type: string;
  requestId?: string;
  sessionId?: string;
  text?: string;
  error?: string;
}
export interface PendingRequest extends RequestState {
  kind: 'summary' | 'investigation';
  userQuestion?: string;
  resume: boolean;
  completing?: boolean;
}
interface RouterDependencies {
  broadcast: (message: Message) => void;
  saveSummary: (url: string, text: string) => Promise<unknown>;
  saveInvestigation: (request: PendingRequest, text: string) => Promise<Investigation>;
}
export class RequestRouter {
  private requests = new Map<string, PendingRequest>();
  private dependencies: RouterDependencies;
  constructor(dependencies: RouterDependencies) { this.dependencies = dependencies; }

  start(request: PendingRequest) {
    if (this.requests.has(request.requestId) || this.state(request.url, request.kind)) {
      throw new Error('A request for this page is already running.');
    }
    this.requests.set(request.requestId, request);
  }
  state(url: string, kind: PendingRequest['kind']) {
    return [...this.requests.values()].find((request) => request.url === url && request.kind === kind);
  }
  fail(requestId: string, error: string) {
    const request = this.requests.get(requestId);
    if (!request) return;
    this.requests.delete(requestId);
    this.dependencies.broadcast({
      type: request.kind === 'summary' ? MessageTypes.SUMMARIZE_CONTENT_ERROR : MessageTypes.INVESTIGATION_ERROR,
      recipient: MessageRecipients.POPUP, requestId, url: request.url, sessionId: request.sessionId, data: error,
    });
  }
  disconnect(error: string) {
    for (const id of this.requests.keys()) this.fail(id, error);
  }
  async handle(message: HostMessage) {
    const request = this.requests.get(message.requestId || '');
    if (!request || request.completing || (message.sessionId && message.sessionId !== request.sessionId)) return;
    const context = { recipient: MessageRecipients.POPUP, requestId: request.requestId, url: request.url, sessionId: request.sessionId };
    if (message.type === HostMessageTypes.ASK_HOST_STREAM && request.kind === 'investigation') {
      request.text += message.text || '';
      this.dependencies.broadcast({ ...context, type: MessageTypes.INVESTIGATION_STREAM, data: message.text || '' });
    } else if (message.type === HostMessageTypes.ASK_HOST_PROGRESS && request.kind === 'investigation') {
      const text = (message.text || '').trim();
      if (!text) return;
      const entry: ToolUsageEntry = { timestamp: Date.now(), message: text, type: text.startsWith('⏺') ? 'tool_start' : text.startsWith('⎿') ? 'tool_result' : 'thinking' };
      request.toolUsage.push(entry);
      this.dependencies.broadcast({ ...context, type: MessageTypes.INVESTIGATION_PROGRESS, data: text, toolUsage: [entry] });
    } else if (message.type === HostMessageTypes.ASK_HOST_ERROR || message.type === HostMessageTypes.SUMMARIZE_HOST_ERROR) {
      this.fail(request.requestId, message.error || message.text || 'Claude request failed.');
    } else if (
      (message.type === HostMessageTypes.ASK_HOST_COMPLETE && request.kind === 'investigation') ||
      (message.type === HostMessageTypes.SUMMARIZE_HOST_COMPLETE && request.kind === 'summary')
    ) {
      request.completing = true;
      try {
        const text = message.text || request.text;
        if (!text.trim()) throw new Error('Claude returned no response.');
        if (request.kind === 'summary') {
          await this.dependencies.saveSummary(request.url, text);
          this.requests.delete(request.requestId);
          this.dependencies.broadcast({ ...context, type: MessageTypes.SUMMARIZE_CONTENT_COMPLETE, data: text });
        } else {
          const saved = await this.dependencies.saveInvestigation(request, text);
          this.requests.delete(request.requestId);
          this.dependencies.broadcast({ ...context, type: MessageTypes.INVESTIGATION_COMPLETE, data: saved.data, toolUsage: saved.toolUsage || [] });
        }
      } catch (error) {
        this.fail(request.requestId, error instanceof Error ? error.message : 'Could not save the response.');
      }
    }
  }
}
