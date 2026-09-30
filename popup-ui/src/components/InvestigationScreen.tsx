import { useMemo, useState } from 'react';
import { Loader2, SendHorizontal } from 'lucide-react';
import { useInvestigation, type InvestigationMode } from '../hooks/useInvestigation';
import { renderMarkdown } from '../rendering/markdown';
import ToolUsageBlock from './ToolUsageBlock';

export default function InvestigationScreen({ url, mode, extractedContent }: { url: string; mode: InvestigationMode; extractedContent: string | null }) {
  const investigation = useInvestigation(url, mode, extractedContent);
  const [message, setMessage] = useState('');
  const html = useMemo(() => renderMarkdown(investigation.text), [investigation.text]);
  const submit = () => {
    if (!message.trim() || investigation.loading) return;
    void investigation.send(message);
    setMessage('');
  };
  return <>
    <div className="card">
      {html && <div className="chat-output" dangerouslySetInnerHTML={{ __html: html }} />}
      {investigation.loading && <p role="status">{html ? 'Working…' : 'Starting investigation…'}</p>}
      {!html && !investigation.loading && !investigation.error && <p>{mode === 'chat' ? 'Ask a question to start a conversation.' : 'Waiting for ticket content…'}</p>}
      {investigation.error && <p className="error" role="alert">{investigation.error}</p>}
      {investigation.toolUsage.length > 0 && <ToolUsageBlock entries={investigation.toolUsage} />}
    </div>
    {(investigation.hasInvestigation || mode === 'chat' || mode === 'new') && <form className="chat-footer" onSubmit={(event) => { event.preventDefault(); submit(); }}>
      <input aria-label="Message" value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Ask follow-up questions…" className="input" disabled={investigation.loading} />
      <button aria-label="Send message" type="submit" disabled={investigation.loading || !message.trim()} className="primary-button">
        {investigation.loading ? <Loader2 size={20} className="loading-icon" /> : <SendHorizontal size={20} />}
      </button>
    </form>}
  </>;
}
