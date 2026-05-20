import { notFound, redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";

type ShortSessionPageProps = {
  params: Promise<{
    code: string;
  }>;
};

export default async function ShortSessionPage({
  params,
}: ShortSessionPageProps) {
  const { code } = await params;
  const shortCode = code.trim();

  if (!supabase || !/^[A-Za-z0-9]{8}$/.test(shortCode)) {
    notFound();
  }

  const { data: session, error } = await supabase
    .from("sessions")
    .select("id,status")
    .eq("short_code", shortCode)
    .maybeSingle();

  if (error || !session) {
    notFound();
  }

  if (session.status === "ended") {
    redirect(`/session/${session.id}/summary`);
  }

  redirect(`/session/${session.id}`);
}
