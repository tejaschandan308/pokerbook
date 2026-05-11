"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { computeSettlements } from "@/lib/settlements";
import type { Settlement } from "@/lib/settlements";

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

const shortDateFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

function formatDate(iso: string) {
  return dateFormatter.format(new Date(iso));
}

function buildShareText(
  session: Session,
  settlements: Settlement[],
  tableBank: number,
): string {
  const title = session.name ? `settle up — ${session.name}` : "settle up";
  const lines: string[] = [title];

  if (session.ended_at) {
    lines.push(shortDateFormatter.format(new Date(session.ended_at)));
  }

  if (settlements.length === 0) {
    lines.push("everyone's even. nothing to settle. ♠");
    lines.push(`table bank: ${currencyFormatter.format(tableBank)}`);
  } else {
    for (const s of settlements) {
      lines.push(
        `${s.fromName.toLowerCase()} pays ${s.toName.toLowerCase()} ${currencyFormatter.format(s.amount)}`,
      );
    }
    lines.push(`table bank: ${currencyFormatter.format(tableBank)}`);
    lines.push("all clear ♠");
  }

  return lines.join("\n");
}

export function SummaryView({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loadingState, setLoadingState] = useState<
    "loading" | "ready" | "missing" | "error"
  >("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [view, setView] = useState<"payer" | "receiver">("payer");
  const [shareState, setShareState] = useState<"idle" | "shared" | "copied">(
    "idle",
  );

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

  const settlements = useMemo<Settlement[]>(() => {
    if (!isBalanced) return [];
    return computeSettlements(
      sortedPlayers.map((p) => ({
        playerId: p.id,
        name: p.name,
        netPnL: p.net,
      })),
    );
  }, [isBalanced, sortedPlayers]);

  const byPayer = useMemo(() => {
    const map = new Map<
      string,
      {
        fromName: string;
        payments: { toPlayerId: string; toName: string; amount: number }[];
      }
    >();
    for (const s of settlements) {
      if (!map.has(s.fromPlayerId)) {
        map.set(s.fromPlayerId, { fromName: s.fromName, payments: [] });
      }
      map.get(s.fromPlayerId)!.payments.push({
        toPlayerId: s.toPlayerId,
        toName: s.toName,
        amount: s.amount,
      });
    }
    return Array.from(map.values());
  }, [settlements]);

  const byReceiver = useMemo(() => {
    const map = new Map<
      string,
      {
        toName: string;
        receipts: { fromPlayerId: string; fromName: string; amount: number }[];
      }
    >();
    for (const s of settlements) {
      if (!map.has(s.toPlayerId)) {
        map.set(s.toPlayerId, { toName: s.toName, receipts: [] });
      }
      map.get(s.toPlayerId)!.receipts.push({
        fromPlayerId: s.fromPlayerId,
        fromName: s.fromName,
        amount: s.amount,
      });
    }
    return Array.from(map.values());
  }, [settlements]);

  const everyoneEven = isBalanced && settlements.length === 0;

  async function handleShare() {
    if (!session) return;
    const text = buildShareText(session, settlements, tableBank);

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ text });
        setShareState("shared");
        setTimeout(() => setShareState("idle"), 2000);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        try {
          await navigator.clipboard.writeText(text);
          setShareState("copied");
          setTimeout(() => setShareState("idle"), 2000);
        } catch {
          // Both share and clipboard failed — silently give up
        }
      }
    } else {
      try {
        await navigator.clipboard.writeText(text);
        setShareState("copied");
        setTimeout(() => setShareState("idle"), 2000);
      } catch {
        // Clipboard not available — silently fail
      }
    }
  }

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
                  : "math doesn't add up — "}
                <Link
                  href={`/session/${sessionId}/end`}
                  className="underline underline-offset-2"
                >
                  recount or edit.
                </Link>
              </p>
            ) : null}

            {/* P&L list */}
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

            {/* Settlements */}
            <div className="mt-10 border-t border-[var(--line)] pt-8">
              <p className="font-mono text-sm uppercase tracking-[0.18em] text-[var(--ink-soft)]">
                settle up.
              </p>

              {!isBalanced ? (
                <p className="mt-4 text-base text-[var(--ink-soft)]">
                  the books don&apos;t balance.{" "}
                  <Link
                    href={`/session/${sessionId}/end`}
                    className="text-[var(--terracotta)] underline underline-offset-2"
                  >
                    recount or edit.
                  </Link>
                </p>
              ) : everyoneEven ? (
                <p className="mt-4 text-base text-[var(--ink-soft)]">
                  everyone&apos;s even. nothing to settle.{" "}
                  <span className="font-serif italic text-[var(--table-green)]">
                    ♠
                  </span>
                </p>
              ) : (
                <>
                  {/* Toggle */}
                  <div className="mt-4 flex">
                    <button
                      type="button"
                      onClick={() => setView("payer")}
                      className={`h-8 border px-3 font-mono text-xs uppercase tracking-[0.12em] transition ${
                        view === "payer"
                          ? "border-foreground bg-foreground text-background"
                          : "border-[var(--line)] text-[var(--ink-soft)] hover:text-foreground"
                      }`}
                    >
                      by payer
                    </button>
                    <button
                      type="button"
                      onClick={() => setView("receiver")}
                      className={`h-8 border border-l-0 px-3 font-mono text-xs uppercase tracking-[0.12em] transition ${
                        view === "receiver"
                          ? "border-foreground bg-foreground text-background"
                          : "border-[var(--line)] text-[var(--ink-soft)] hover:text-foreground"
                      }`}
                    >
                      by receiver
                    </button>
                  </div>

                  {/* By payer */}
                  {view === "payer" ? (
                    <div className="mt-4 space-y-5">
                      {byPayer.map((payer) => (
                        <div key={payer.fromName}>
                          <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--ink-soft)]">
                            {payer.fromName} owes.
                          </p>
                          <ul className="mt-2 space-y-2">
                            {payer.payments.map((payment) => (
                              <li
                                key={payment.toPlayerId}
                                className="flex items-baseline justify-between gap-4 border border-[var(--line)] bg-[#fffaf0] px-4 py-3"
                              >
                                <span className="text-sm text-[var(--ink-soft)]">
                                  <span className="mr-2 text-[var(--terracotta)]">
                                    →
                                  </span>
                                  {payment.toName}
                                </span>
                                <span className="shrink-0 font-mono text-sm font-semibold text-[var(--terracotta)]">
                                  {formatCurrency(payment.amount)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {/* By receiver */}
                  {view === "receiver" ? (
                    <div className="mt-4 space-y-5">
                      {byReceiver.map((receiver) => (
                        <div key={receiver.toName}>
                          <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--ink-soft)]">
                            {receiver.toName} receives.
                          </p>
                          <ul className="mt-2 space-y-2">
                            {receiver.receipts.map((receipt) => (
                              <li
                                key={receipt.fromPlayerId}
                                className="flex items-baseline justify-between gap-4 border border-[var(--line)] bg-[#fffaf0] px-4 py-3"
                              >
                                <span className="text-sm text-[var(--ink-soft)]">
                                  <span className="mr-2 text-[var(--table-green)]">
                                    ←
                                  </span>
                                  from {receipt.fromName}
                                </span>
                                <span className="shrink-0 font-mono text-sm font-semibold text-[var(--table-green)]">
                                  {formatCurrency(receipt.amount)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </>
              )}

              {/* Share button — shown only when books balance */}
              {isBalanced ? (
                <div className="mt-6">
                  <button
                    type="button"
                    onClick={handleShare}
                    className="h-11 border border-[var(--table-green)] px-5 font-mono text-xs uppercase tracking-[0.12em] text-[var(--table-green)] transition hover:bg-[var(--table-green)] hover:text-background"
                  >
                    {shareState === "shared"
                      ? "shared."
                      : shareState === "copied"
                        ? "copied to clipboard."
                        : "share settlements."}
                  </button>
                </div>
              ) : null}
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
