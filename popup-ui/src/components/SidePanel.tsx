import { useEffect, useState } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { MessageTypes, MessageRecipients, type Message } from '../actions/types';
import { DBClient } from '../db/dbClient';

export default function SidePanel({ isOpen, onClose, currentUrl }: { isOpen: boolean; onClose: () => void; currentUrl: string }) {
  const [paths, setPaths] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [paths, local] = await Promise.all([DBClient.extensionSettings.getPaths(), currentUrl ? DBClient.localSettings.get(currentUrl) : undefined]);
        if (!cancelled) { setPaths(paths); setSelected(local?.selectedPaths || []); setError(''); }
      } catch (error) { if (!cancelled) setError(error instanceof Error ? error.message : 'Could not load directory settings.'); }
    }
    void load();
    return () => { cancelled = true; };
  }, [currentUrl, isOpen]);
  useEffect(() => {
    const listener = (message: Message) => {
      if (message.recipient !== MessageRecipients.POPUP) return;
      if (message.type === MessageTypes.SELECT_PATH_COMPLETE && message.data) {
        const path = message.data;
        setPaths((previous) => previous.includes(path) ? previous : [...previous, path]);
        setBusy(false);
      } else if (message.type === MessageTypes.SELECT_PATH_ERROR) { setBusy(false); setError(message.data || 'Folder selection failed.'); }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);
  async function add() {
    setBusy(true); setError('');
    try {
      const response = await chrome.runtime.sendMessage({ type: MessageTypes.SELECT_PATH_START, recipient: MessageRecipients.SERVICE_WORKER, requestId: crypto.randomUUID() });
      if (!response?.success) throw new Error(response?.error || 'Folder selection failed.');
    } catch (error) { setBusy(false); setError(error instanceof Error ? error.message : 'Folder selection failed.'); }
  }
  async function toggle(path: string) {
    if (busy || !currentUrl) return;
    const next = selected.includes(path) ? selected.filter((value) => value !== path) : [...selected, path];
    setBusy(true); setError('');
    try { await DBClient.localSettings.setPaths(currentUrl, next); setSelected(next); }
    catch (error) { setError(error instanceof Error ? error.message : 'Could not save selected paths.'); }
    finally { setBusy(false); }
  }
  async function remove(path: string) {
    setBusy(true); setError('');
    try { await DBClient.extensionSettings.removePath(path); setPaths((previous) => previous.filter((value) => value !== path)); setSelected((previous) => previous.filter((value) => value !== path)); }
    catch (error) { setError(error instanceof Error ? error.message : 'Could not remove the path.'); }
    finally { setBusy(false); }
  }
  return <>
    {isOpen && <div className="side-panel-overlay" onClick={onClose} />}
    <div className={`side-panel ${isOpen ? 'side-panel-open' : ''}`} aria-hidden={!isOpen}>
      <div className="side-panel-header"><h2 className="side-panel-title">Settings</h2><button className="side-panel-close" aria-label="Close settings" onClick={onClose}><X size={20} /></button></div>
      <div className="side-panel-content">
        {error && <p className="error" role="alert">{error}</p>}
        <div className="side-panel-split side-panel-split-upper">
          <div className="side-panel-split-header"><h3 className="side-panel-split-title">Available Paths</h3><button disabled={busy} className="side-panel-add-button" onClick={() => void add()}><Plus size={16} /> Add</button></div>
          <div className="side-panel-list">{paths.length ? paths.map((path) => <div key={path} className="side-panel-list-item"><span className="side-panel-list-item-text" title={path}>{path}</span><button aria-label={`Remove ${path}`} disabled={busy} className="side-panel-delete-button" onClick={() => void remove(path)}><Trash2 size={16} /></button></div>) : <p>No paths available.</p>}</div>
        </div>
        <div className="side-panel-split side-panel-split-lower">
          <h3 className="side-panel-split-title">Select Paths for This Page</h3>
          <div className="side-panel-list">{paths.map((path) => <label key={path} className="side-panel-list-item"><input type="checkbox" disabled={busy || !currentUrl} checked={selected.includes(path)} onChange={() => void toggle(path)} /><span title={path}>{path}</span></label>)}</div>
        </div>
      </div>
    </div>
  </>;
}
