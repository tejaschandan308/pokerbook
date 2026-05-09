import { EndSessionForm } from "./end-session-form";

type EndSessionPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EndSessionPage({ params }: EndSessionPageProps) {
  const { id } = await params;

  return <EndSessionForm sessionId={id} />;
}
