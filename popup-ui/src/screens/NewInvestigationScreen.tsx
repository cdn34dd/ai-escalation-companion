import InvestigationScreen from '../components/InvestigationScreen';
export default function NewInvestigationScreen({ extractedContent, url }: { extractedContent: string | null; url: string }) {
  return <InvestigationScreen url={url} mode="new" extractedContent={extractedContent} />;
}
