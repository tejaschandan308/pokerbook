"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Session = {
  id: string;
  name: string | null;
  buy_in_amount: number;
  status: "active" | "ended" | string;
  ended_at: string | null;
};

type Player = {
  id: string;
  name: string;
  total_buy_ins: number;
  final_chips: number | null;
};

type PlayerPnL = Player & {
  inFor: number;
  net: number;
};

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  currency: "INR",
  maximumFractionDigits: 0,
  style: "currency",
});

function formatCurrency(amount: number) {
  return currencyFormatter.format(amount);
}

function formatPnL(net: number) {
  if (net > 0) return "+" + currencyFormatter.format(net);
  return currencyFormatter.format(net);
}

const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

function formatDate(iso: string) {
  return dateFormatter.format(new Date(iso));
}

export function SummaryView({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loadingState, setLoadingState] = useState<
    "loading" | "ready" | "missing" | "error"
  >("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadSummary() {
      if (!supabase) {
        setLoadingState("error");
        setErrorMessage("supabase keys are missing.");
        return;
      }

      setLoadingState("loading");
      setErrorMessage("");

      const { data: sessionData, error: sessionError } = await supabase
        .from("sessions")
        .select("id,name,buy_in_amount,status,ended_at")
        .eq("id", sessionId)
        .single();

      if (!isMounted) return;

      if (sessionError || !sessionData) {
        setLoadingState("missing");
        return;
      }

      if (sessionData.status === "active") {
        router.replace(`/session/${sessionId}`);
        return;
      }

      const { data: playerData, error: playersError } = await supabase
        .from("players")
        .select("id,name,total_buy_ins,final_chips")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true });

      if (!isMounted) return;

      if (playersError || !playerData) {
        setLoadingState("error");
        setErrorMessage("couldn't load the players.");
        return;
      }

      setSession(sessionData);
      setPlayers(playerData);
      setLoadingState("ready");
    }

    loadSummary();

    return () => {
      isMounted = false;
    };
  }, [router, sessionId]);

  const totalBuyIns = useMemo(
    () => players.reduce((sum, p) => sum + p.total_buy_ins, 0),
    [players],
  );

  const tableBank = session ? totalBuyIns * session.buy_in_amount : 0;

  const hasMissingChips = useMemo(
    () => players.some((p) => p.final_chips === null),
    [players],
  );

  const totalFinalChips = useMemo(
    () => players.reduce((sum, p) => sum + (p.final_chips ?? 0), 0),
    [players],
  );

  const isBalanced = !hasMissingChips && totalFinalChips === tableBank;

  const sortedPlayers = useMemo<PlayerPnL[]>(() => {
    const buyInAmount = session?.buy_in_amount ?? 0;
    return players
      .map((p) => {
        const inFor = p.total_buy_ins * buyInAmount;
        const net = (p.final_chips ?? 0) - inFor;
        return { ...p, inFor, net };
      })
      .sort((a, b) => b.net - a.net);
  }, [players, session]);

  return (
    <main className="min-h-screen overflow-x-hidden bg-background px-5 py-6 text-foreground sm:px-10 sm:py-8">
      <section className="mx-auto w-full max-w-5xl">
        <nav className="flex items-center justify-between gap-4 border-b border-[var(--line)] pb-5 font-mono text-xs uppercase tracking-[0.18em] text-[var(--ink-soft)]">
          <Link href="/" className="transition hover:text-[var(--terracotta)]">
            pokerbook
          </Link>
          <span className="text-[var(--table-green)]">ended</span>
        </nav>

        {loadingState === "loading" ? (
          <SummaryMessage eyebrow="loading" headline="counting the chips." />
        ) : null}

        {loadingState === "missing" ? (
          <SummaryMessage
            eyebrow="not found"
            headline="no table here."
            body="Check the link and try again."
          />
        ) : null}

        {loadingState === "error" ? (
          <SummaryMessage
            eyebrow="blocked"
            headline="couldn't load this one."
            body={errorMessage || "Try refreshing the page."}
          />
        ) : null}

        {loadingState === "ready" && session ? (
          <div className="py-8 sm:py-12">
            <header className="grid gap-6 border-b border-[var(--line)] pb-8 lg:grid-cols-[1fr_auto] lg:items-end">
              <div>
                <p className="font-mono text-sm uppercase tracking-[0.18em] text-[var(--table-green)]">
                  {"♣"} session ended
                </p>
                <h1 className="mt-4 text-5xl font-semibold leading-none tracking-normal sm:text-7xl">
                  {session.name || "poker night."}
                </h1>
                {session.ended_at ? (
                  <p className="mt-4 font-mono text-xs uppercase tracking-[0.16em] text-[var(--ink-soft)]">
                    {formatDate(session.ended_at)}
                  </p>
                ) : null}
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:min-w-[460px]">
                <Stat label="total buy-ins" value={String(totalBuyIns)} />
                <Stat label="table bank" value={formatCurrency(tableBank)} />
                <Stat
                  label="final chips"
                  value={
                    hasMissingChips ? "—" : formatCurrency(totalFinalChips)
                  }
                />
              </div>
            </header>

            {!isBalanced ? (
              <p className="mt-5 border border-[var(--terracotta)] bg-[#fffaf0] p-3 text-sm text-[var(--terracotta)]">
                {hasMissingChips
                  ? "some chip values are missing — "
                  : "math doesn’t add up — "}
                <Link
                  href={`/session/${sessionId}/end`}
                  className="underline underline-offset-2"
                >
                  recount or edit.
                </Link>
              </p>
            ) : null}

            <div className="mt-8">
              <p className="font-mono text-sm uppercase tracking-[0.18em] text-[var(--ink-soft)]">
                the night.
              </p>
              <div className="mt-4 space-y-3">
                {sortedPlayers.map((player) => {
                  const isWinner = player.net > 0;
                  const isLoser = player.net < 0;
                  const pnlColor = isWinner
                    ? "text-[var(--table-green)]"
                    : isLoser
                      ? "text-[var(--terracotta)]"
                      : "text-[var(--ink-soft)]";

                  return (
                    <article
                      key={player.id}
                      className="border border-[var(--line)] bg-[#fffaf0] p-5 shadow-[0_18px_60px_rgba(36,25,19,0.07)]"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="truncate text-2xl font-semibold leading-tight">
                            {player.name}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs uppercase tracking-[0.14em] text-[var(--ink-soft)]">
                            <span>{player.total_buy_ins}&times; buy-in</span>
                            <span>in for {formatCurrency(player.inFor)}</span>
                            {player.final_chips !== null ? (
                              <span>
                                chips {formatCurrency(player.final_chips)}
                              </span>
                            ) : (
                              <span className="text-[var(--terracotta)]">
                                chips missing
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <p
                            className={`text-2xl font-semibold leading-tight sm:text-3xl ${pnlColor}`}
                          >
                            {player.final_chips !== null
                              ? formatPnL(player.net)
                              : "—"}
                          </p>
                          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--ink-soft)]">
                            net p&amp;l
                          </p>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>

            <div className="mt-10 border-t border-[var(--line)] pt-8">
              <p className="font-mono text-sm uppercase tracking-[0.18em] text-[var(--ink-soft)]">
                settlements.
              </p>
              <p className="mt-4 text-lg leading-7 text-[var(--ink-soft)]">
                settlements coming.{" "}
                <span className="font-serif italic text-[var(--terracotta)]">
                  for now: pay the winner.
                </span>
              </p>
              <p className="mt-2 font-mono text-xs uppercase tracking-[0.14em] text-[var(--ink-soft)]">
                phase 3 will show who pays whom.
              </p>
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}

function SummaryMessage({
  eyebrow,
  headline,
  body,
}: {
  eyebrow: string;
  headline: string;
  body?: string;
}) {
  return (
    <div className="py-20">
      <p className="font-mono text-sm uppercase tracking-[0.18em] text-[var(--terracotta)]">
        {eyebrow}
      </p>
      <h1 className="mt-5 text-5xl font-semibold leading-none tracking-normal sm:text-6xl">
        {headline}
      </h1>
      {body ? (
        <p className="mt-6 max-w-xl text-lg leading-8 text-[var(--ink-soft)]">
          {body}
        </p>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-[var(--line)] bg-[#fffaf0] p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--ink-soft)]">
        {label}
      </p>
      <p className="mt-2 text-xl font-semibold leading-tight">{value}</p>
    </div>
  );
}
