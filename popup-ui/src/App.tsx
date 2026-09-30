import { ChevronLeft, Cog } from 'lucide-react';
import { useEffect, useState } from 'react';
import { MessageRecipients, MessageTypes, type Message } from './actions/types';
import './App.css';
import './prism.css';
import SidePanel from './components/SidePanel';
import GenericChatScreen from './screens/GenericChatScreen';
import HomeScreen from './screens/HomeScreen';
import NewInvestigationScreen from './screens/NewInvestigationScreen';
import ResumeInvestigationScreen from './screens/ResumeInvestigationScreen';
import SummarizeScreen from './screens/SummarizeScreen';

type ScreenType = 'home' | 'summarize' | 'resume' | 'new-investigation' | 'generic-chat';
export default function App() {
  const [currentScreen, setCurrentScreen] = useState<ScreenType>('home');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [page, setPage] = useState({ url: '', content: null as string | null, error: '' });
  useEffect(() => {
    let generation = 0;
    let activeId: number | undefined;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    async function refresh() {
      const current = ++generation;
      const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      if (!alive || current !== generation) return;
      activeId = tab?.id;
      if (!tab?.id || !tab.url) { setPage({ url: '', content: null, error: 'No active tab found.' }); return; }
      // Clear old content as soon as the active URL changes.
      setPage((previous) => previous.url === tab.url ? previous : { url: tab.url!, content: null, error: '' });
      try {
        const response: Message = await chrome.tabs.sendMessage(tab.id, { type: MessageTypes.EXTRACTION_START, recipient: MessageRecipients.CONTENT_SCRIPT });
        if (!alive || current !== generation) return;
        setPage({ url: response.url || tab.url, content: response.type === MessageTypes.EXTRACTION_COMPLETE ? response.data || null : null,
          error: response.type === MessageTypes.EXTRACTION_COMPLETE && response.data ? '' : 'Open a Jira ticket or GitHub issue with visible content.' });
      } catch {
        if (alive && current === generation) setPage({ url: tab.url, content: null, error: 'Open a supported Jira or GitHub page, then reload that tab if the extension was just installed.' });
      }
    }
    function schedule() { clearTimeout(timer); timer = setTimeout(() => void refresh().catch(console.error), 300); }
    const updated = (id: number, info: chrome.tabs.OnUpdatedInfo) => { if (id === activeId && (info.url || info.status === 'complete')) schedule(); };
    const contentChanged = (message: Message, sender: chrome.runtime.MessageSender) => { if (message.type === MessageTypes.PAGE_CONTENT_CHANGED && sender.tab?.id === activeId) schedule(); };
    chrome.tabs.onActivated.addListener(schedule);
    chrome.tabs.onUpdated.addListener(updated);
    chrome.runtime.onMessage.addListener(contentChanged);
    void refresh().catch(console.error);
    return () => { alive = false; clearTimeout(timer); chrome.tabs.onActivated.removeListener(schedule); chrome.tabs.onUpdated.removeListener(updated); chrome.runtime.onMessage.removeListener(contentChanged); };
  }, []);
  const renderScreen = () => {
    if (currentScreen === 'home') return <HomeScreen onNavigate={(screen) => setCurrentScreen(screen as ScreenType)} />;
    if (currentScreen === 'generic-chat') return <GenericChatScreen />;
    if (!page.url) return <p role="status">Loading the active page…</p>;
    if (currentScreen === 'resume') return <ResumeInvestigationScreen url={page.url} />;
    if (page.error) return <p className="error" role="alert">{page.error}</p>;
    if (!page.content) return <p role="status">Reading ticket content…</p>;
    if (currentScreen === 'summarize') return <SummarizeScreen url={page.url} extractedContent={page.content} />;
    return <NewInvestigationScreen url={page.url} extractedContent={page.content} />;
  };
  return <div className="app">
    <div className="header">
      {currentScreen !== 'home' && <button aria-label="Back to home" className="back-button" onClick={() => setCurrentScreen('home')}><ChevronLeft size={20} /></button>}
      <span className="header-badge">AI Escalation Companion</span>
      <button aria-label="Settings" className="settings-button" onClick={() => setSettingsOpen((open) => !open)}><Cog size={24} /></button>
    </div>
    <div key={`${currentScreen}:${currentScreen === 'generic-chat' ? 'chat://general' : page.url}`}>{renderScreen()}</div>
    <SidePanel key={currentScreen === 'generic-chat' ? 'chat://general' : page.url} isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} currentUrl={currentScreen === 'generic-chat' ? 'chat://general' : page.url} />
  </div>;
}
