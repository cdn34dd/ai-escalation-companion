import InvestigationScreen from '../components/InvestigationScreen';
export default function ResumeInvestigationScreen({ url }: { url: string }) {
  return <InvestigationScreen url={url} mode="resume" extractedContent={null} />;
}
