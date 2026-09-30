import { useCallback, useEffect, useRef, useState } from 'react';
import { MessageRecipients, MessageTypes, type Message } from '../actions/types';
import type { Investigation, ToolUsageEntry } from '../db/schema';
import type { PendingRequest } from '../worker/requestRouter';

export type InvestigationMode = 'new' | 'resume' | 'chat';
interface View {
  text: string;
  sessionId: string | null;
  loading: boolean;
  error: string;
  toolUsage: ToolUsageEntry[];
  hasInvestigation: boolean;
}
export function useInvestigation(url: string, mode: InvestigationMode, extractedContent: string | null) {
  const [view, setView] = useState<View>({ text: '', sessionId: null, loading: false, error: '', toolUsage: [], hasInvestigation: mode === 'chat' });
  const requestId = useRef<string | null>(null);
  const initialized = useRef(false);
  const sending = useRef(false);
  const start = useCallback(async (prompt: string, sessionId: string | null, question?: string) => {
    if (sending.current) return;
    sending.current = true;
    const id = crypto.randomUUID();
    requestId.current = id;
    setView((previous) => ({
      ...previous, text: sessionId ? [previous.text, question].filter(Boolean).join('\n\n') + '\n\n' : question ? question + '\n\n' : '',
      toolUsage: sessionId ? previous.toolUsage : [], loading: true, error: '', hasInvestigation: true,
    }));
    try {
      const response: { success: boolean; error?: string; sessionId?: string } = await chrome.runtime.sendMessage({
        type: MessageTypes.INVESTIGATION_START, recipient: MessageRecipients.SERVICE_WORKER,
        requestId: id, url, data: prompt, sessionId, userQuestion: question,
      });
      if (!response?.success) throw new Error(response?.error || 'Could not start the investigation.');
      setView((previous) => ({ ...previous, sessionId: response.sessionId || previous.sessionId }));
    } catch (error) {
      sending.current = false;
      setView((previous) => ({ ...previous, loading: false, error: error instanceof Error ? error.message : 'Request failed.' }));
    }
  }, [url]);

  useEffect(() => {
    const onMessage = (message: Message) => {
      if (message.recipient !== MessageRecipients.POPUP || message.url !== url || message.requestId !== requestId.current) return;
      if (message.type === MessageTypes.INVESTIGATION_STREAM) {
        setView((previous) => ({ ...previous, text: previous.text + (message.data || ''), sessionId: message.sessionId || previous.sessionId }));
      } else if (message.type === MessageTypes.INVESTIGATION_PROGRESS) {
        setView((previous) => ({ ...previous, toolUsage: [...previous.toolUsage, ...(message.toolUsage || [])] }));
      } else if (message.type === MessageTypes.INVESTIGATION_COMPLETE) {
        sending.current = false;
        setView((previous) => ({ ...previous, loading: false, text: message.data || '', sessionId: message.sessionId || previous.sessionId, toolUsage: message.toolUsage || [] }));
      } else if (message.type === MessageTypes.INVESTIGATION_ERROR) {
        sending.current = false;
        setView((previous) => ({ ...previous, loading: false, error: message.data || 'Investigation failed.' }));
      }
    };
    chrome.runtime.onMessage.addListener(onMessage);
    return () => chrome.runtime.onMessage.removeListener(onMessage);
  }, [url]);

  useEffect(() => {
    if (!url || initialized.current || (mode === 'new' && !extractedContent)) return;
    let cancelled = false;
    async function initialize() {
      try {
        const state: { pending: PendingRequest | null; investigation?: Investigation; hadPending?: boolean; error?: string } = await chrome.runtime.sendMessage({
          type: MessageTypes.REQUEST_STATE_START, recipient: MessageRecipients.SERVICE_WORKER, url, kind: 'investigation',
        });
        if (state.error) throw new Error(state.error);
        const pending = state.pending;
        const saved = state.investigation;
        if (cancelled || initialized.current) return;
        initialized.current = true;
        if (pending) {
          requestId.current = pending.requestId;
          sending.current = true;
          setView({ text: [pending.resume ? saved?.data : '', pending.userQuestion, pending.text].filter(Boolean).join('\n\n'),
            sessionId: pending.sessionId, loading: true, error: '', hasInvestigation: true,
            toolUsage: [...(pending.resume ? saved?.toolUsage || [] : []), ...pending.toolUsage] });
        } else if (mode === 'new' && extractedContent && !state.hadPending) {
          await start(`Analyze this issue and investigate possible root causes and relevant code:\n\n${extractedContent}`, null);
        } else if (saved) {
          setView({ text: saved.data, sessionId: saved.sessionId, loading: false, error: '', toolUsage: saved.toolUsage || [], hasInvestigation: true });
        } else if (mode === 'resume') {
          setView((previous) => ({ ...previous, error: 'No previous investigation found for this page.' }));
        }
      } catch (error) {
        if (!cancelled) setView((previous) => ({ ...previous, error: error instanceof Error ? error.message : 'Could not load the investigation.' }));
      }
    }
    void initialize();
    return () => { cancelled = true; };
  }, [url, mode, extractedContent, start]);

  const send = async (text: string) => {
    if (view.loading || !text.trim()) return;
    const question = text.trim().split('\n').map((line) => `> ${line}`).join('\n');
    await start(text.trim(), view.sessionId, question);
  };
  return { ...view, send };
}
