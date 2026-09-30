import { FileSearch, History, MessageSquarePlus, Sparkles } from "lucide-react";

interface HomeScreenProps {
  onNavigate: (screen: string) => void;
}

function HomeScreen({ onNavigate }: HomeScreenProps) {
  return (
    <div className="home-screen">
      <div className="home-buttons">
        <button
          className="home-button"
          onClick={() => onNavigate("summarize")}
        >
          <FileSearch size={32} />
          <span className="home-button-title">Summarize</span>
          <span className="home-button-description">
            Get a quick summary of the current ticket
          </span>
        </button>

        <button
          className="home-button"
          onClick={() => onNavigate("resume")}
        >
          <History size={32} />
          <span className="home-button-title">Resume Investigation</span>
          <span className="home-button-description">
            Continue your previous investigation
          </span>
        </button>

        <button
          className="home-button"
          onClick={() => onNavigate("new-investigation")}
        >
          <Sparkles size={32} />
          <span className="home-button-title">New Investigation</span>
          <span className="home-button-description">
            Start a new investigation for this ticket
          </span>
        </button>

        <button
          className="home-button"
          onClick={() => onNavigate("generic-chat")}
        >
          <MessageSquarePlus size={32} />
          <span className="home-button-title">Generic Chat</span>
          <span className="home-button-description">
            Have a general conversation with the AI
          </span>
        </button>
      </div>
    </div>
  );
}

export default HomeScreen;
