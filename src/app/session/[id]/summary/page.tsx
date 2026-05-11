import { SummaryView } from "./summary-view";

type SummaryPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function SummaryPage({ params }: SummaryPageProps) {
  const { id } = await params;

  return <SummaryView sessionId={id} />;
}
