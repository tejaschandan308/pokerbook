"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { computeSettlements } from "@/lib/settlements";
import type { Settlement } from "@/lib/settlements";
import { getStoredPin } from "@/lib/pin-auth";
import { AppHeader } from "@/components/ui/app-header";
import { Eyebrow } from "@/components/ui/eyebrow";

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

type PillType = "bigwin" | "cooked" | "even";

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

// ─── Animation variants ───────────────────────────────────────────────────────

const ease = [0.2, 0.7, 0.2, 1] as const;

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

const rowVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease } },
};

const settleVariants = {
  hidden: { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.2, ease } },
  exit: { opacity: 0, y: -4, transition: { duration: 0.15 } },
};

// ─── Status pill ──────────────────────────────────────────────────────────────

function StatusPill({ pill }: { pill: PillType }) {
  const config: Record<
    PillType,
    { label: string; color: string; bg: string; borderColor: string }
  > = {
    bigwin: {
      label: "BIG WIN ▲",
      color: "var(--pos)",
      bg: "rgba(139,199,154,0.12)",
      borderColor: "rgba(139,199,154,0.35)",
    },
    cooked: {
      label: "COOKED ▼",
      color: "var(--neg)",
      bg: "rgba(231,107,92,0.12)",
      borderColor: "rgba(231,107,92,0.35)",
    },
    even: {
      label: "EVEN",
      color: "var(--ink-mute)",
      bg: "rgba(107,126,110,0.12)",
      borderColor: "rgba(107,126,110,0.30)",
    },
  };
  const { label, color, bg, borderColor } = config[pill];

  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2, delay: 0.15 }}
      style={{
        display: "inline-flex",
        alignItems: "center",
        fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace",
        fontSize: 9,
        fontWeight: 500,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color,
        background: bg,
        border: `1px solid ${borderColor}`,
        padding: "2px 7px",
        lineHeight: 1.6,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </motion.span>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        border: "1px solid var(--rule)",
        background: "var(--bg-card)",
        padding: "12px 14px",
      }}
    >
      <p
        style={{
          fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace",
          fontSize: 10,
          fontWeight: 500,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: "var(--ink-mute)",
          margin: 0,
        }}
      >
        {label}
      </p>
      <p
        style={{
          marginTop: 8,
          fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace",
          fontSize: 18,
          fontWeight: 500,
          color: "var(--ink)",
          fontVariantNumeric: "tabular-nums",
          margin: "8px 0 0",
        }}
      >
        {value}
      </p>
    </div>
  );
}

// ─── Loading/error message ────────────────────────────────────────────────────

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
    <div style={{ paddingTop: 80, paddingBottom: 80 }}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h1
        style={{
          marginTop: 20,
          fontFamily: "var(--font-instrument-serif), serif",
          fontStyle: "italic",
          fontSize: "clamp(36px, 7vw, 64px)",
          fontWeight: 400,
          lineHeight: 0.95,
          letterSpacing: "-0.02em",
          color: "var(--ink)",
        }}
      >
        {headline}
      </h1>
      {body ? (
        <p
          style={{
            marginTop: 20,
            maxWidth: 440,
            fontSize: 16,
            lineHeight: 1.6,
            color: "var(--ink-soft)",
          }}
        >
          {body}
        </p>
      ) : null}
    </div>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────

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
  const [isHost, setIsHost] = useState(false);

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

      const { data: hasPinData } = await supabase.rpc("session_has_pin", {
        p_session_id: sessionId,
      });
      if (!isMounted) return;
      if (!hasPinData || getStoredPin(sessionId)) {
        setIsHost(true);
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

  // Pill assignment: BIG WIN for top positive, COOKED for bottom negative,
  // EVEN for exactly ₹0. No pills if only one player.
  const pillMap = useMemo(() => {
    const map = new Map<string, PillType>();
    if (sortedPlayers.length <= 1) return map;

    const positives = sortedPlayers.filter((p) => p.net > 0);
    const negatives = sortedPlayers.filter((p) => p.net < 0);
    const topNet =
      positives.length > 0 ? Math.max(...positives.map((p) => p.net)) : null;
    const bottomNet =
      negatives.length > 0 ? Math.min(...negatives.map((p) => p.net)) : null;

    for (const p of sortedPlayers) {
      if (p.net === 0) {
        map.set(p.id, "even");
      } else if (topNet !== null && p.net === topNet) {
        map.set(p.id, "bigwin");
      } else if (bottomNet !== null && p.net === bottomNet) {
        map.set(p.id, "cooked");
      }
    }
    return map;
  }, [sortedPlayers]);

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
    <main
      style={{
        minHeight: "100vh",
        background: "var(--bg)",
        color: "var(--ink)",
        overflowX: "hidden",
      }}
    >
      <div
        style={{ maxWidth: 1100, margin: "0 auto", padding: "0 20px 80px" }}
        className="sm:px-10"
      >
        <div style={{ position: "relative" }}>
          <div className="felt-motif" />
          <div style={{ position: "relative", zIndex: 1 }}>
            <AppHeader
              right={
                <span
                  style={{
                    fontFamily:
                      "var(--font-jetbrains-mono), ui-monospace, monospace",
                    fontSize: 11,
                    fontWeight: 500,
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                    color: "var(--felt)",
                  }}
                >
                  ended
                </span>
              }
            />

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
              <div style={{ paddingTop: 32, paddingBottom: 48 }}>
                {/* ── Hero heading ── */}
                <header
                  style={{
                    display: "grid",
                    gap: 24,
                    borderBottom: "1px solid var(--rule)",
                    paddingBottom: 28,
                  }}
                  className="lg:grid-cols-[1fr_auto] lg:items-end"
                >
                  {/* Heading + date */}
                  <div>
                    <Eyebrow style={{ color: "var(--felt)" }}>
                      session ended
                    </Eyebrow>

                    <h1 style={{ marginTop: 14 }}>
                      <span
                        style={{
                          display: "block",
                          fontFamily:
                            "var(--font-instrument-serif), serif",
                          fontStyle: "italic",
                          fontSize: "clamp(40px, 8vw, 72px)",
                          fontWeight: 400,
                          lineHeight: 0.95,
                          letterSpacing: "-0.02em",
                          color: "var(--terra)",
                        }}
                      >
                        from chaos,
                      </span>
                      <span
                        style={{
                          display: "block",
                          fontFamily:
                            "var(--font-instrument-serif), serif",
                          fontSize: "clamp(40px, 8vw, 72px)",
                          fontWeight: 400,
                          lineHeight: 0.95,
                          letterSpacing: "-0.015em",
                          color: "var(--ink)",
                          marginTop: 2,
                        }}
                      >
                        to clarity.
                      </span>
                    </h1>

                    {session.ended_at ? (
                      <p
                        style={{
                          marginTop: 16,
                          fontFamily:
                            "var(--font-jetbrains-mono), ui-monospace, monospace",
                          fontSize: 11,
                          fontWeight: 500,
                          letterSpacing: "0.16em",
                          textTransform: "uppercase",
                          color: "var(--ink-mute)",
                        }}
                      >
                        {formatDate(session.ended_at)}
                      </p>
                    ) : null}
                  </div>

                  {/* Stat cards */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(3, 1fr)",
                      gap: 8,
                    }}
                    className="lg:min-w-[420px]"
                  >
                    <Stat label="buy-ins" value={String(totalBuyIns)} />
                    <Stat
                      label="table bank"
                      value={formatCurrency(tableBank)}
                    />
                    <Stat
                      label="final chips"
                      value={
                        hasMissingChips ? "—" : formatCurrency(totalFinalChips)
                      }
                    />
                  </div>
                </header>

                {/* Not balanced warning */}
                {!isBalanced ? (
                  <p
                    style={{
                      marginTop: 20,
                      border: "1px solid var(--terra)",
                      background: "rgba(224,148,114,0.08)",
                      padding: "10px 14px",
                      fontSize: 14,
                      color: "var(--terra)",
                    }}
                  >
                    {hasMissingChips
                      ? "some chip values are missing — "
                      : "math doesn't add up — "}
                    <Link
                      href={`/session/${sessionId}/end`}
                      style={{
                        textDecoration: "underline",
                        textUnderlineOffset: 2,
                      }}
                    >
                      recount or edit.
                    </Link>
                  </p>
                ) : null}

                {/* ── Main content: desktop two-col, mobile stack ── */}
                {/* Wrapper for the two-column layout on desktop */}
                <div
                  style={{ marginTop: 32 }}
                  className="flex flex-col gap-8 lg:grid lg:grid-cols-[1.6fr_1fr] lg:items-start"
                >
                    {/* ── Left: The Standing ── */}
                    <div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "baseline",
                          justifyContent: "space-between",
                          marginBottom: 14,
                        }}
                      >
                        <Eyebrow soft>the standing.</Eyebrow>
                        <span
                          className="hidden lg:block"
                          style={{
                            fontFamily:
                              "var(--font-jetbrains-mono), ui-monospace, monospace",
                            fontSize: 10,
                            fontWeight: 500,
                            letterSpacing: "0.16em",
                            textTransform: "uppercase",
                            color: "var(--ink-mute)",
                          }}
                        >
                          {sortedPlayers.length} players
                        </span>
                      </div>

                      <motion.div
                        variants={containerVariants}
                        initial="hidden"
                        animate="visible"
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 10,
                        }}
                      >
                        {sortedPlayers.map((player) => {
                          const pill = pillMap.get(player.id);
                          const accentColor =
                            player.net > 0
                              ? "var(--pos)"
                              : player.net < 0
                                ? "var(--neg)"
                                : "var(--ink-mute)";
                          const pnlColor =
                            player.net > 0
                              ? "var(--pos)"
                              : player.net < 0
                                ? "var(--neg)"
                                : "var(--ink-mute)";

                          return (
                            <motion.article
                              key={player.id}
                              variants={rowVariants}
                              whileHover={{
                                y: -2,
                                transition: { duration: 0.15 },
                              }}
                              style={{
                                display: "flex",
                                border: "1px solid var(--rule)",
                                background: "var(--bg-card)",
                                overflow: "hidden",
                              }}
                            >
                              {/* Colored left accent bar */}
                              <div
                                style={{
                                  width: 4,
                                  flexShrink: 0,
                                  background: accentColor,
                                }}
                              />

                              {/* Card body */}
                              <div
                                style={{ flex: 1, padding: "16px 18px" }}
                              >
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "flex-start",
                                    justifyContent: "space-between",
                                    gap: 12,
                                  }}
                                >
                                  {/* Left: name + pill + stats row */}
                                  <div
                                    style={{ flex: 1, minWidth: 0 }}
                                  >
                                    <div
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 8,
                                        flexWrap: "wrap",
                                      }}
                                    >
                                      <p
                                        style={{
                                          fontFamily:
                                            "var(--font-instrument-serif), serif",
                                          fontStyle: "italic",
                                          fontSize: 24,
                                          fontWeight: 400,
                                          lineHeight: 1,
                                          color: "var(--ink)",
                                          margin: 0,
                                        }}
                                      >
                                        {player.name}
                                      </p>
                                      {pill ? (
                                        <StatusPill pill={pill} />
                                      ) : null}
                                    </div>

                                    <p
                                      style={{
                                        marginTop: 8,
                                        fontFamily:
                                          "var(--font-jetbrains-mono), ui-monospace, monospace",
                                        fontSize: 10,
                                        fontWeight: 500,
                                        letterSpacing: "0.14em",
                                        textTransform: "uppercase",
                                        color: "var(--ink-mute)",
                                        margin: "8px 0 0",
                                      }}
                                    >
                                      {player.total_buy_ins}× buy-in · in{" "}
                                      {formatCurrency(player.inFor)} · chips{" "}
                                      {player.final_chips !== null
                                        ? formatCurrency(player.final_chips)
                                        : "—"}
                                    </p>
                                  </div>

                                  {/* Right: P&L number + label */}
                                  <div
                                    style={{
                                      flexShrink: 0,
                                      textAlign: "right",
                                    }}
                                  >
                                    <p
                                      style={{
                                        fontFamily:
                                          "var(--font-jetbrains-mono), ui-monospace, monospace",
                                        fontSize: 22,
                                        fontWeight: 500,
                                        lineHeight: 1,
                                        fontVariantNumeric: "tabular-nums",
                                        margin: 0,
                                        color: pnlColor,
                                      }}
                                    >
                                      {player.final_chips !== null
                                        ? formatPnL(player.net)
                                        : "—"}
                                    </p>
                                    <p
                                      style={{
                                        marginTop: 4,
                                        fontFamily:
                                          "var(--font-jetbrains-mono), ui-monospace, monospace",
                                        fontSize: 9,
                                        fontWeight: 500,
                                        letterSpacing: "0.14em",
                                        textTransform: "uppercase",
                                        color: "var(--ink-mute)",
                                        margin: "4px 0 0",
                                      }}
                                    >
                                      net p&amp;l
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </motion.article>
                          );
                        })}
                      </motion.div>

                      {/* Edit values — host only, right-aligned below standing cards */}
                      {isHost ? (
                        <div
                          style={{
                            marginTop: 16,
                            display: "flex",
                            justifyContent: "flex-end",
                          }}
                        >
                          <Link
                            href={`/session/${sessionId}/end`}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              height: 36,
                              padding: "0 14px",
                              border: "1px solid var(--rule-strong)",
                              background: "transparent",
                              fontFamily:
                                "var(--font-jetbrains-mono), ui-monospace, monospace",
                              fontSize: 11,
                              fontWeight: 500,
                              letterSpacing: "0.14em",
                              textTransform: "uppercase",
                              color: "var(--ink-soft)",
                              textDecoration: "none",
                              transition:
                                "border-color 0.15s ease, color 0.15s ease",
                            }}
                            className="hover:border-[var(--ink)] hover:text-[var(--ink)]"
                          >
                            edit values
                          </Link>
                        </div>
                      ) : null}
                    </div>

                    {/* ── Right: Settle Up ── */}
                    <div>
                      <div
                        style={{
                          borderTop: "1px solid var(--rule)",
                          paddingTop: 28,
                        }}
                        className="lg:border-t-0 lg:pt-0"
                      >
                        <Eyebrow soft>settle up.</Eyebrow>

                        {!isBalanced ? (
                          <p
                            style={{
                              marginTop: 16,
                              fontSize: 14,
                              color: "var(--ink-soft)",
                              lineHeight: 1.6,
                            }}
                          >
                            the books don&apos;t balance.{" "}
                            <Link
                              href={`/session/${sessionId}/end`}
                              style={{
                                color: "var(--terra)",
                                textDecoration: "underline",
                                textUnderlineOffset: 2,
                              }}
                            >
                              recount or edit.
                            </Link>
                          </p>
                        ) : everyoneEven ? (
                          <p
                            style={{
                              marginTop: 16,
                              fontSize: 14,
                              color: "var(--ink-soft)",
                              lineHeight: 1.6,
                            }}
                          >
                            everyone&apos;s even. nothing to settle.{" "}
                            <span
                              style={{
                                fontFamily:
                                  "var(--font-instrument-serif), serif",
                                fontStyle: "italic",
                                color: "var(--felt)",
                              }}
                            >
                              ♠
                            </span>
                          </p>
                        ) : (
                          <>
                            {/* Toggle */}
                            <div
                              style={{ marginTop: 16, display: "flex" }}
                            >
                              <button
                                type="button"
                                onClick={() => setView("payer")}
                                style={{
                                  height: 34,
                                  padding: "0 14px",
                                  fontFamily:
                                    "var(--font-jetbrains-mono), ui-monospace, monospace",
                                  fontSize: 11,
                                  fontWeight: 500,
                                  letterSpacing: "0.12em",
                                  textTransform: "uppercase",
                                  border: "1px solid var(--rule-strong)",
                                  cursor: "pointer",
                                  transition:
                                    "background 0.15s ease, color 0.15s ease",
                                  background:
                                    view === "payer"
                                      ? "var(--ink)"
                                      : "transparent",
                                  color:
                                    view === "payer"
                                      ? "var(--bg)"
                                      : "var(--ink-soft)",
                                }}
                              >
                                by payer
                              </button>
                              <button
                                type="button"
                                onClick={() => setView("receiver")}
                                style={{
                                  height: 34,
                                  padding: "0 14px",
                                  fontFamily:
                                    "var(--font-jetbrains-mono), ui-monospace, monospace",
                                  fontSize: 11,
                                  fontWeight: 500,
                                  letterSpacing: "0.12em",
                                  textTransform: "uppercase",
                                  border: "1px solid var(--rule-strong)",
                                  borderLeft: "none",
                                  cursor: "pointer",
                                  transition:
                                    "background 0.15s ease, color 0.15s ease",
                                  background:
                                    view === "receiver"
                                      ? "var(--ink)"
                                      : "transparent",
                                  color:
                                    view === "receiver"
                                      ? "var(--bg)"
                                      : "var(--ink-soft)",
                                }}
                              >
                                by receiver
                              </button>
                            </div>

                            {/* Settlement rows — animated on toggle switch */}
                            <AnimatePresence mode="wait">
                              {view === "payer" ? (
                                <motion.div
                                  key="payer"
                                  variants={settleVariants}
                                  initial="hidden"
                                  animate="visible"
                                  exit="exit"
                                  style={{
                                    marginTop: 16,
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 16,
                                  }}
                                >
                                  {byPayer.map((payer) => (
                                    <div key={payer.fromName}>
                                      <p
                                        style={{
                                          fontFamily:
                                            "var(--font-jetbrains-mono), ui-monospace, monospace",
                                          fontSize: 10,
                                          fontWeight: 500,
                                          letterSpacing: "0.16em",
                                          textTransform: "uppercase",
                                          color: "var(--ink-mute)",
                                          marginBottom: 8,
                                        }}
                                      >
                                        {payer.fromName} owes.
                                      </p>
                                      <ul
                                        style={{
                                          display: "flex",
                                          flexDirection: "column",
                                          gap: 6,
                                          listStyle: "none",
                                          margin: 0,
                                          padding: 0,
                                        }}
                                      >
                                        {payer.payments.map((payment) => (
                                          <li
                                            key={payment.toPlayerId}
                                            style={{
                                              display: "flex",
                                              alignItems: "baseline",
                                              justifyContent: "space-between",
                                              gap: 12,
                                              border:
                                                "1px solid var(--rule)",
                                              background: "var(--bg-elev)",
                                              padding: "10px 14px",
                                            }}
                                          >
                                            <span
                                              style={{
                                                fontSize: 15,
                                                color: "var(--ink)",
                                              }}
                                            >
                                              <span
                                                style={{
                                                  marginRight: 8,
                                                  color: "var(--terra)",
                                                }}
                                              >
                                                →
                                              </span>
                                              <span
                                                style={{
                                                  fontFamily:
                                                    "var(--font-instrument-serif), serif",
                                                  fontStyle: "italic",
                                                }}
                                              >
                                                {payment.toName}
                                              </span>
                                            </span>
                                            <span
                                              style={{
                                                flexShrink: 0,
                                                fontFamily:
                                                  "var(--font-jetbrains-mono), ui-monospace, monospace",
                                                fontSize: 14,
                                                fontWeight: 500,
                                                fontVariantNumeric:
                                                  "tabular-nums",
                                                color: "var(--terra)",
                                              }}
                                            >
                                              {formatCurrency(payment.amount)}
                                            </span>
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  ))}
                                </motion.div>
                              ) : (
                                <motion.div
                                  key="receiver"
                                  variants={settleVariants}
                                  initial="hidden"
                                  animate="visible"
                                  exit="exit"
                                  style={{
                                    marginTop: 16,
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 16,
                                  }}
                                >
                                  {byReceiver.map((receiver) => (
                                    <div key={receiver.toName}>
                                      <p
                                        style={{
                                          fontFamily:
                                            "var(--font-jetbrains-mono), ui-monospace, monospace",
                                          fontSize: 10,
                                          fontWeight: 500,
                                          letterSpacing: "0.16em",
                                          textTransform: "uppercase",
                                          color: "var(--ink-mute)",
                                          marginBottom: 8,
                                        }}
                                      >
                                        {receiver.toName} receives.
                                      </p>
                                      <ul
                                        style={{
                                          display: "flex",
                                          flexDirection: "column",
                                          gap: 6,
                                          listStyle: "none",
                                          margin: 0,
                                          padding: 0,
                                        }}
                                      >
                                        {receiver.receipts.map((receipt) => (
                                          <li
                                            key={receipt.fromPlayerId}
                                            style={{
                                              display: "flex",
                                              alignItems: "baseline",
                                              justifyContent: "space-between",
                                              gap: 12,
                                              border:
                                                "1px solid var(--rule)",
                                              background: "var(--bg-elev)",
                                              padding: "10px 14px",
                                            }}
                                          >
                                            <span
                                              style={{
                                                fontSize: 15,
                                                color: "var(--ink)",
                                              }}
                                            >
                                              <span
                                                style={{
                                                  marginRight: 8,
                                                  color: "var(--pos)",
                                                }}
                                              >
                                                ←
                                              </span>
                                              <span
                                                style={{
                                                  fontFamily:
                                                    "var(--font-instrument-serif), serif",
                                                  fontStyle: "italic",
                                                }}
                                              >
                                                from {receipt.fromName}
                                              </span>
                                            </span>
                                            <span
                                              style={{
                                                flexShrink: 0,
                                                fontFamily:
                                                  "var(--font-jetbrains-mono), ui-monospace, monospace",
                                                fontSize: 14,
                                                fontWeight: 500,
                                                fontVariantNumeric:
                                                  "tabular-nums",
                                                color: "var(--pos)",
                                              }}
                                            >
                                              {formatCurrency(receipt.amount)}
                                            </span>
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  ))}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </>
                        )}

                        {/* Share button — shown when books balance */}
                        {isBalanced ? (
                          <div style={{ marginTop: 20 }}>
                            <button
                              type="button"
                              onClick={handleShare}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                height: 40,
                                padding: "0 18px",
                                border: "1px solid var(--felt)",
                                background: "transparent",
                                fontFamily:
                                  "var(--font-jetbrains-mono), ui-monospace, monospace",
                                fontSize: 11,
                                fontWeight: 500,
                                letterSpacing: "0.14em",
                                textTransform: "uppercase",
                                color: "var(--felt)",
                                cursor: "pointer",
                                transition:
                                  "background 0.15s ease, color 0.15s ease",
                              }}
                              className="hover:bg-[var(--felt)] hover:text-[var(--bg)]"
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
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </main>
  );
}
