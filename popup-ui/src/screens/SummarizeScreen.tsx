import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RotateCw } from 'lucide-react';
import { MessageRecipients, MessageTypes, type Message } from '../actions/types';
import { renderMarkdown } from '../rendering/markdown';
import type { RequestState } from '../actions/types';
import type { Summary } from '../db/schema';

export default function SummarizeScreen({ extractedContent, url }: { extractedContent: string | null; url: string }) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const requestId = useRef<string | null>(null);
  const initialized = useRef(false);
  const sending = useRef(false);
  const html = useMemo(() => renderMarkdown(text), [text]);
  const request = useCallback(async () => {
    if (sending.current || !url || !extractedContent) return;
    sending.current = true;
    requestId.current = crypto.randomUUID();
    setLoading(true);
    setError('');
    try {
      const response: { success: boolean; error?: string } = await chrome.runtime.sendMessage({
        type: MessageTypes.SUMMARIZE_CONTENT_START, recipient: MessageRecipients.SERVICE_WORKER,
        requestId: requestId.current, url, data: extractedContent,
      });
      if (!response?.success) throw new Error(response?.error || 'Could not start the summary.');
    } catch (error) {
      sending.current = false;
      setLoading(false);
      setError(error instanceof Error ? error.message : 'Summary request failed.');
    }
  }, [url, extractedContent]);

  useEffect(() => {
    const listener = (message: Message) => {
      if (message.recipient !== MessageRecipients.POPUP || message.url !== url || message.requestId !== requestId.current) return;
      if (message.type === MessageTypes.SUMMARIZE_CONTENT_COMPLETE || message.type === MessageTypes.SUMMARIZE_CONTENT_ERROR) {
        sending.current = false;
        setLoading(false);
        if (message.type === MessageTypes.SUMMARIZE_CONTENT_COMPLETE) setText(message.data || '');
        else setError(message.data || 'Summary failed.');
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, [url]);
  useEffect(() => {
    if (!url || !extractedContent || initialized.current) return;
    let cancelled = false;
    async function load() {
      try {
        const state: { pending: RequestState | null; summary?: Summary; error?: string } = await chrome.runtime.sendMessage({ type: MessageTypes.REQUEST_STATE_START, recipient: MessageRecipients.SERVICE_WORKER, url, kind: 'summary' });
        if (state.error) throw new Error(state.error);
        const pending = state.pending;
        const cached = state.summary;
        if (cancelled || initialized.current) return;
        initialized.current = true;
        if (cached) setText(cached.data);
        if (pending) { requestId.current = pending.requestId; sending.current = true; setLoading(true); }
        else if (!cached) await request();
      } catch (error) { if (!cancelled) setError(error instanceof Error ? error.message : 'Could not load the summary.'); }
    }
    void load();
    return () => { cancelled = true; };
  }, [url, extractedContent, request]);
  return <div className="card">
    {loading && <p role="status">Generating summary…</p>}
    {html && <div className="chat-output" dangerouslySetInnerHTML={{ __html: html }} />}
    {error && <p className="error" role="alert">{error}</p>}
    {!html && !loading && !error && <p>Waiting for ticket content…</p>}
    <div className="chat-footer"><button onClick={() => void request()} disabled={loading || !extractedContent} className="secondary-button"><RotateCw size={14} /> {error ? 'Retry' : 'Regenerate'}</button></div>
  </div>;
}
