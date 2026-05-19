"use client";

import type { FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { getStoredPin } from "@/lib/pin-auth";
import { AppHeader } from "@/components/ui/app-header";
import { Eyebrow } from "@/components/ui/eyebrow";

type Session = {
  id: string;
  name: string | null;
  buy_in_amount: number;
  status: "active" | "ended" | string;
};

type Player = {
  id: string;
  name: string;
  total_buy_ins: number;
  final_chips: number | null;
  created_at: string;
};

type PlayerForm = {
  id: string;
  name: string;
  buyIns: string;
  finalChips: string;
};

type FieldErrors = {
  buyIns?: string;
  finalChips?: string;
};

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  currency: "INR",
  maximumFractionDigits: 0,
  style: "currency",
});

function formatCurrency(amount: number) {
  return currencyFormatter.format(amount);
}

/* ─── Animation constants ────────────────────────────────────────────────── */

const ease = [0.2, 0.7, 0.2, 1] as const;

const rowVariants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.32, ease } },
};

const statVariants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease } },
};

function containerVariants(stagger = 0.07, delay = 0.1) {
  return {
    hidden: {},
    show: { transition: { staggerChildren: stagger, delayChildren: delay } },
  };
}

/* ─── Stat card with animated number ────────────────────────────────────── */

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <motion.div
      variants={statVariants}
      style={{
        minWidth: 0,
        border: "1px solid var(--rule)",
        background: "var(--bg-card)",
        padding: "14px 16px",
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
        }}
      >
        {label}
      </p>
      <div style={{ marginTop: 8, overflow: "hidden", position: "relative" }}>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.p
            key={value}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.22, ease }}
            style={{
              fontFamily: "var(--font-instrument-serif), serif",
              fontSize: 22,
              fontWeight: 400,
              lineHeight: 1.1,
              letterSpacing: "-0.01em",
              color: "var(--ink)",
            }}
          >
            {value}
          </motion.p>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

/* ─── Loading / error message ────────────────────────────────────────────── */

function EndSessionMessage({
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
      <p
        style={{
          fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace",
          fontSize: 11,
          fontWeight: 500,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: "var(--terra)",
        }}
      >
        {eyebrow}
      </p>
      <h1
        style={{
          fontFamily: "var(--font-instrument-serif), serif",
          fontSize: "clamp(48px, 10vw, 96px)",
          fontWeight: 400,
          lineHeight: 0.95,
          letterSpacing: "-0.02em",
          color: "var(--ink)",
          marginTop: 20,
        }}
      >
        {headline}
      </h1>
      {body ? (
        <p
          style={{
            fontSize: 15,
            lineHeight: 1.6,
            color: "var(--ink-soft)",
            marginTop: 20,
            maxWidth: 480,
          }}
        >
          {body}
        </p>
      ) : null}
    </div>
  );
}

/* ─── Main component ─────────────────────────────────────────────────────── */

export function EndSessionForm({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [players, setPlayers] = useState<PlayerForm[]>([]);
  const [loadingState, setLoadingState] = useState<
    "loading" | "ready" | "missing" | "error"
  >("loading");
  const [fieldErrors, setFieldErrors] = useState<Record<string, FieldErrors>>(
    {},
  );
  const [submitError, setSubmitError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [pendingBuyInPlayerId, setPendingBuyInPlayerId] = useState<
    string | null
  >(null);

  const totalBuyIns = useMemo(
    () =>
      players.reduce((sum, player) => {
        const parsedBuyIns = Number(player.buyIns);
        return Number.isInteger(parsedBuyIns) ? sum + parsedBuyIns : sum;
      }, 0),
    [players],
  );

  const tableBank = session ? totalBuyIns * session.buy_in_amount : 0;

  const allChipsFilled = useMemo(
    () =>
      players.length > 0 &&
      players.every((p) => {
        const v = p.finalChips.trim();
        if (v === "") return false;
        const n = Number(v);
        return Number.isInteger(n) && n >= 0;
      }),
    [players],
  );

  const totalFinalChips = useMemo(
    () =>
      allChipsFilled
        ? players.reduce((sum, p) => sum + Number(p.finalChips), 0)
        : 0,
    [players, allChipsFilled],
  );

  const delta = allChipsFilled ? totalFinalChips - tableBank : null;

  useEffect(() => {
    let isMounted = true;

    async function loadSession() {
      if (!supabase) {
        setLoadingState("error");
        setSubmitError("supabase keys are missing.");
        return;
      }

      setLoadingState("loading");
      setSubmitError("");

      const { data: sessionData, error: sessionError } = await supabase
        .from("sessions")
        .select("id,name,buy_in_amount,status")
        .eq("id", sessionId)
        .single();

      if (!isMounted) return;

      if (sessionError || !sessionData) {
        setLoadingState("missing");
        return;
      }

      const { data: hasPinData } = await supabase.rpc("session_has_pin", {
        p_session_id: sessionId,
      });

      if (!isMounted) return;

      if (hasPinData) {
        const storedPin = getStoredPin(sessionId);
        if (!storedPin) {
          if (sessionData.status === "ended") {
            router.replace(`/session/${sessionId}/summary`);
          } else {
            router.replace(`/session/${sessionId}`);
          }
          return;
        }
      }

      if (isMounted) setIsHost(true);

      if (sessionData.status === "ended") {
        setIsEditing(true);
      }

      const { data: playerData, error: playersError } = await supabase
        .from("players")
        .select("id,name,total_buy_ins,final_chips,created_at")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true });

      if (!isMounted) return;

      if (playersError || !playerData) {
        setLoadingState("error");
        setSubmitError("couldn't load the table.");
        return;
      }

      setSession(sessionData);
      setPlayers(
        playerData.map((player: Player) => ({
          id: player.id,
          name: player.name,
          buyIns: String(player.total_buy_ins),
          finalChips:
            player.final_chips === null ? "" : String(player.final_chips),
        })),
      );
      setLoadingState("ready");
    }

    loadSession();
    return () => {
      isMounted = false;
    };
  }, [router, sessionId]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.visualViewport) return;

    const viewport = window.visualViewport;
    const initialHeight = viewport.height;

    function handleResize() {
      setIsKeyboardOpen(initialHeight - viewport.height > 150);
    }

    viewport.addEventListener("resize", handleResize);
    return () => viewport.removeEventListener("resize", handleResize);
  }, []);

  function updatePlayerField(
    playerId: string,
    field: "buyIns" | "finalChips",
    value: string,
  ) {
    setPlayers((currentPlayers) =>
      currentPlayers.map((player) =>
        player.id === playerId ? { ...player, [field]: value } : player,
      ),
    );
    setFieldErrors((currentErrors) => ({
      ...currentErrors,
      [playerId]: {
        ...currentErrors[playerId],
        [field]: undefined,
      },
    }));
  }

  function validatePlayers() {
    const nextErrors: Record<string, FieldErrors> = {};

    players.forEach((player) => {
      const buyIns = Number(player.buyIns);
      const finalChips = Number(player.finalChips);
      const playerErrors: FieldErrors = {};

      if (!Number.isInteger(buyIns) || buyIns < 1) {
        playerErrors.buyIns = "buy-ins can't be zero.";
      }

      if (player.finalChips.trim() === "") {
        playerErrors.finalChips = "needs a chip value.";
      } else if (!Number.isInteger(finalChips) || finalChips < 0) {
        playerErrors.finalChips = "chips can't be negative.";
      }

      if (Object.keys(playerErrors).length > 0) {
        nextErrors[player.id] = playerErrors;
      }
    });

    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function handleDivideEqually() {
    if (delta === null || delta === 0) return;
    const n = players.length;
    if (n === 0) return;
    const absAdj = Math.abs(delta);
    const sign = delta > 0 ? -1 : 1;
    const perPlayer = Math.floor(absAdj / n);
    const remainder = absAdj - perPlayer * n;
    setPlayers((currentPlayers) =>
      currentPlayers.map((player, index) => {
        const adj = (index === 0 ? perPlayer + remainder : perPlayer) * sign;
        return {
          ...player,
          finalChips: String(Math.max(0, Number(player.finalChips) + adj)),
        };
      }),
    );
  }

  async function adjustBuyIn(player: PlayerForm, buyDelta: number) {
    if (!supabase || pendingBuyInPlayerId || !isHost) return;
    const currentCount = Number(player.buyIns);
    if (buyDelta < 0 && currentCount <= 1) return;

    setPendingBuyInPlayerId(player.id);
    setSubmitError("");

    const storedPin = getStoredPin(sessionId);
    const { data, error } = await supabase
      .rpc("adjust_player_buy_in", {
        player_id: player.id,
        p_delta: buyDelta,
        p_pin: storedPin,
      })
      .single<Player>();

    if (error || !data) {
      setSubmitError("couldn't update buy-in. please try again.");
      setPendingBuyInPlayerId(null);
      return;
    }

    setPlayers((current) =>
      current.map((p) =>
        p.id === data.id ? { ...p, buyIns: String(data.total_buy_ins) } : p,
      ),
    );
    setPendingBuyInPlayerId(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase || isSaving) return;

    setSubmitError("");

    if (!validatePlayers()) return;

    setIsSaving(true);

    const storedPin = getStoredPin(sessionId);

    for (const player of players) {
      const { error } = await supabase.rpc("update_player_with_pin", {
        p_player_id: player.id,
        p_session_id: sessionId,
        p_pin: storedPin,
        p_total_buy_ins: Number(player.buyIns),
        p_final_chips: Number(player.finalChips),
      });

      if (error) {
        setSubmitError("couldn't save the chip counts.");
        setIsSaving(false);
        return;
      }
    }

    const { error: sessionError } = await supabase.rpc("end_session_with_pin", {
      p_session_id: sessionId,
      p_pin: storedPin,
    });

    if (sessionError) {
      setSubmitError("couldn't end the session.");
      setIsSaving(false);
      return;
    }

    router.push(`/session/${sessionId}/summary`);
  }

  return (
    <>
      <main
        style={{
          background: "var(--bg)",
          color: "var(--ink)",
          minHeight: "100dvh",
          position: "relative",
          overflowX: "hidden",
        }}
      >
        <div className="felt-motif" />

        <div
          style={{
            position: "relative",
            zIndex: 1,
            width: "100%",
            boxSizing: "border-box",
            maxWidth: 1000,
            margin: "0 auto",
            padding: "0 20px 80px",
          }}
          className="sm:px-10"
        >
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
                  color: "var(--terra)",
                }}
              >
                {isEditing ? "edit values" : "end session"}
              </span>
            }
          />

          {loadingState === "loading" ? (
            <EndSessionMessage eyebrow="loading" headline="counting the table." />
          ) : null}

          {loadingState === "missing" ? (
            <EndSessionMessage
              eyebrow="not found"
              headline="no table here."
              body="Check the link and try again."
            />
          ) : null}

          {loadingState === "error" ? (
            <EndSessionMessage
              eyebrow="blocked"
              headline="couldn't load this one."
              body={submitError || "Try refreshing the page."}
            />
          ) : null}

          {loadingState === "ready" && session ? (
            <form
              id="end-session-form"
              noValidate
              onSubmit={handleSubmit}
              style={{ paddingTop: 32 }}
            >
              {/* ── Page header ── */}
              <header
                style={{
                  display: "grid",
                  gap: 24,
                  borderBottom: "1px solid var(--rule)",
                  paddingBottom: 32,
                }}
                className="lg:grid-cols-[1fr_auto] lg:items-end"
              >
                <div>
                  <Eyebrow>
                    ♦ {isEditing ? "edit values" : "final count"}
                  </Eyebrow>
                  <h1 style={{ marginTop: 14 }}>
                    <span
                      style={{
                        display: "block",
                        fontFamily: "var(--font-instrument-serif), serif",
                        fontSize: "clamp(40px, 8vw, 80px)",
                        fontWeight: 400,
                        lineHeight: 0.95,
                        letterSpacing: "-0.02em",
                        color: "var(--ink)",
                      }}
                    >
                      final
                    </span>
                    <span
                      style={{
                        display: "block",
                        fontFamily: "var(--font-instrument-serif), serif",
                        fontStyle: "italic",
                        fontSize: "clamp(40px, 8vw, 80px)",
                        fontWeight: 400,
                        lineHeight: 0.95,
                        letterSpacing: "-0.015em",
                        color: "var(--terra)",
                        marginTop: 2,
                      }}
                    >
                      count.
                    </span>
                  </h1>
                  <p
                    style={{
                      marginTop: 18,
                      fontSize: 14,
                      lineHeight: 1.55,
                      color: "var(--ink-soft)",
                      maxWidth: 480,
                    }}
                  >
                    Adjust buy-ins if the table memory was off. Then enter final
                    chips, in rupees.
                  </p>
                </div>

                {/* Stat cards */}
                <motion.div
                  variants={containerVariants(0.07, 0.2)}
                  initial="hidden"
                  animate="show"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                    gap: 10,
                  }}
                  className="lg:min-w-[440px]"
                >
                  <Stat
                    label="buy-in"
                    value={formatCurrency(session.buy_in_amount)}
                  />
                  <Stat label="buy-ins" value={String(totalBuyIns)} />
                  <Stat label="table bank" value={formatCurrency(tableBank)} />
                </motion.div>
              </header>

              {/* ── Player rows ── */}
              <motion.div
                variants={containerVariants(0.06, 0.35)}
                initial="hidden"
                animate="show"
                style={{ marginTop: 24, display: "grid", gap: 12 }}
              >
                {players.map((player) => {
                  const buyIns = Number(player.buyIns);
                  const playerInFor =
                    Number.isInteger(buyIns) && buyIns > 0
                      ? buyIns * session.buy_in_amount
                      : 0;
                  const errors = fieldErrors[player.id] || {};
                  const canDecrement = buyIns > 1;
                  const isAdjusting = pendingBuyInPlayerId === player.id;
                  const anyPending = !!pendingBuyInPlayerId;

                  return (
                    <motion.article
                      key={player.id}
                      variants={rowVariants}
                      style={{
                        minWidth: 0,
                        border: "1px solid var(--rule)",
                        background: "var(--bg-card)",
                        padding: 20,
                      }}
                    >
                      {/* On desktop: flex row (name left, controls right).
                          On mobile: flex col (name row, then controls row). */}
                      <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between lg:gap-8">

                        {/* Name + in-for */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          {/* Mobile: flex row (name | in-for). Desktop: block stack. */}
                          <div className="flex min-w-0 items-baseline justify-between gap-3 lg:block">
                            <p
                              style={{
                                fontFamily:
                                  "var(--font-instrument-serif), serif",
                                fontStyle: "italic",
                                fontSize: 24,
                                fontWeight: 400,
                                letterSpacing: "-0.01em",
                                lineHeight: 1.1,
                                color: "var(--ink)",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                flex: 1,
                                minWidth: 0,
                              }}
                            >
                              {player.name}
                            </p>
                            <div
                              style={{
                                overflow: "hidden",
                                position: "relative",
                                minWidth: 0,
                              }}
                              className="lg:mt-1 lg:shrink-0"
                            >
                              <AnimatePresence mode="popLayout" initial={false}>
                                <motion.p
                                  key={playerInFor}
                                  initial={{ opacity: 0, y: -6 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: 6 }}
                                  transition={{ duration: 0.2, ease }}
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
                                  in for {formatCurrency(playerInFor)}
                                </motion.p>
                              </AnimatePresence>
                            </div>
                          </div>
                        </div>

                        {/* Controls: BUY-INS + FINAL CHIPS — 1fr/1fr, constrained on desktop */}
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                            gap: 10,
                            minWidth: 0,
                          }}
                          className="lg:w-[320px] lg:flex-shrink-0"
                        >
                          {/* BUY-INS stepper */}
                          <div>
                            <p
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
                              buy-ins
                            </p>

                            {/* Unified three-cell stepper: [-][N][+] */}
                            <div
                              style={{
                                display: "flex",
                                alignItems: "stretch",
                                height: 40,
                                marginTop: 6,
                                border: "1px solid var(--rule-strong)",
                                background: "var(--bg-elev)",
                              }}
                            >
                              {/* Minus — host only */}
                              {isHost ? (
                                <motion.button
                                  type="button"
                                  onClick={() => adjustBuyIn(player, -1)}
                                  disabled={!canDecrement || anyPending}
                                  aria-label={`decrease buy-ins for ${player.name}`}
                                  whileTap={
                                    canDecrement && !anyPending
                                      ? { scale: 0.92 }
                                      : undefined
                                  }
                                  style={{
                                    width: 36,
                                    flexShrink: 0,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    borderRight:
                                      "1px solid var(--rule-strong)",
                                    background: "var(--bg-card)",
                                    color: !canDecrement
                                      ? "var(--ink-mute)"
                                      : "var(--ink-soft)",
                                    fontSize: 16,
                                    cursor:
                                      !canDecrement || anyPending
                                        ? "not-allowed"
                                        : "pointer",
                                    opacity: !canDecrement
                                      ? 0.35
                                      : anyPending && !isAdjusting
                                        ? 0.5
                                        : 1,
                                    transition:
                                      "opacity 0.15s ease, color 0.15s ease",
                                  }}
                                >
                                  −
                                </motion.button>
                              ) : null}

                              {/* Count */}
                              <div
                                style={{
                                  flex: 1,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  overflow: "hidden",
                                  position: "relative",
                                }}
                              >
                                <AnimatePresence
                                  mode="popLayout"
                                  initial={false}
                                >
                                  <motion.span
                                    key={player.buyIns}
                                    initial={{ opacity: 0, y: -8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 8 }}
                                    transition={{ duration: 0.2, ease }}
                                    style={{
                                      display: "block",
                                      fontFamily:
                                        "var(--font-jetbrains-mono), ui-monospace, monospace",
                                      fontSize: 16,
                                      fontWeight: 500,
                                      lineHeight: 1,
                                      color: "var(--ink)",
                                      fontVariantNumeric: "tabular-nums",
                                    }}
                                  >
                                    {player.buyIns}
                                  </motion.span>
                                </AnimatePresence>
                              </div>

                              {/* Plus — host only */}
                              {isHost ? (
                                <motion.button
                                  type="button"
                                  onClick={() => adjustBuyIn(player, 1)}
                                  disabled={anyPending}
                                  aria-label={`increase buy-ins for ${player.name}`}
                                  whileTap={
                                    !anyPending ? { scale: 0.92 } : undefined
                                  }
                                  style={{
                                    width: 36,
                                    flexShrink: 0,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    borderLeft:
                                      "1px solid var(--rule-strong)",
                                    background: "var(--bg-card)",
                                    color: "var(--ink-soft)",
                                    fontSize: 16,
                                    cursor: anyPending
                                      ? "not-allowed"
                                      : "pointer",
                                    opacity:
                                      anyPending && !isAdjusting ? 0.5 : 1,
                                    transition:
                                      "opacity 0.15s ease, color 0.15s ease",
                                  }}
                                  className="enabled:hover:text-[var(--terra)]"
                                >
                                  +
                                </motion.button>
                              ) : null}
                            </div>

                            {errors.buyIns ? (
                              <p
                                style={{
                                  marginTop: 6,
                                  fontSize: 12,
                                  color: "var(--terra)",
                                }}
                              >
                                {errors.buyIns}
                              </p>
                            ) : null}
                          </div>

                          {/* Final chips input */}
                          <div>
                            <p
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
                              final chips
                            </p>
                            <div
                              style={{
                                marginTop: 6,
                                display: "flex",
                                height: 40,
                                alignItems: "center",
                                border: "1px solid var(--rule)",
                                background: "var(--bg-elev)",
                                padding: "0 10px",
                                transition: "border-color 0.15s ease",
                              }}
                              className="focus-within:border-[var(--terra)]"
                            >
                              <span
                                style={{
                                  fontFamily:
                                    "var(--font-jetbrains-mono), ui-monospace, monospace",
                                  fontSize: 13,
                                  color: "var(--ink-mute)",
                                  marginRight: 6,
                                  flexShrink: 0,
                                }}
                              >
                                ₹
                              </span>
                              <input
                                id={`final-chips-${player.id}`}
                                inputMode="numeric"
                                min="0"
                                step="1"
                                type="number"
                                value={player.finalChips}
                                onChange={(event) =>
                                  updatePlayerField(
                                    player.id,
                                    "finalChips",
                                    event.target.value,
                                  )
                                }
                                placeholder="0"
                                style={{
                                  flex: 1,
                                  minWidth: 0,
                                  background: "transparent",
                                  border: "none",
                                  outline: "none",
                                  fontSize: 15,
                                  color: "var(--ink)",
                                }}
                                className="no-spin placeholder:text-[var(--ink-mute)]/50"
                              />
                            </div>
                            {errors.finalChips ? (
                              <p
                                style={{
                                  marginTop: 6,
                                  fontSize: 12,
                                  color: "var(--terra)",
                                }}
                              >
                                {errors.finalChips}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </motion.article>
                  );
                })}
              </motion.div>

              {submitError ? (
                <p
                  style={{
                    marginTop: 20,
                    border: "1px solid var(--terra)",
                    background: "var(--bg-card)",
                    padding: 12,
                    fontSize: 13,
                    color: "var(--terra)",
                  }}
                >
                  {submitError}
                </p>
              ) : null}

              <div
                style={{
                  marginTop: 32,
                  borderTop: "1px solid var(--rule)",
                  paddingTop: 24,
                }}
              >
                <Link
                  href={
                    isEditing
                      ? `/session/${sessionId}/summary`
                      : `/session/${sessionId}`
                  }
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    height: 40,
                    border: "1px solid var(--rule)",
                    padding: "0 20px",
                    fontFamily:
                      "var(--font-jetbrains-mono), ui-monospace, monospace",
                    fontSize: 11,
                    fontWeight: 500,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: "var(--ink-soft)",
                    textDecoration: "none",
                    transition: "border-color 0.15s ease, color 0.15s ease",
                  }}
                  className="hover:border-[var(--terra)] hover:text-[var(--ink)]"
                >
                  cancel.
                </Link>
              </div>

              {/* Spacer so the last input isn't hidden behind the sticky bar */}
              <div aria-hidden="true" style={{ height: 192 }} className="lg:h-20" />
            </form>
          ) : null}
        </div>
      </main>

      {/* Sticky delta bar — fixed to bottom, outside <main> to avoid overflow clipping.
          Hidden while any input is focused so the mobile keyboard doesn't push it into the content. */}
      {loadingState === "ready" && session && delta !== null && !isKeyboardOpen ? (
        <div
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 10,
            borderTop: "1px solid var(--rule)",
            background: "var(--bg-inset)",
            boxShadow: "0 -4px 20px rgba(0,0,0,0.35)",
            paddingBottom: "env(safe-area-inset-bottom)",
          }}
        >
          <div
            style={{ maxWidth: 1000, margin: "0 auto", padding: "0 20px" }}
            className="sm:px-10"
          >
            <div className="flex flex-col gap-3 py-3 lg:flex-row lg:items-center lg:justify-between lg:gap-6 lg:py-4">
              <div className="min-w-0 flex-1 text-center lg:text-left">
                {delta === 0 ? (
                  <p
                    style={{
                      fontFamily:
                        "var(--font-jetbrains-mono), ui-monospace, monospace",
                      fontSize: 11,
                      letterSpacing: "0.16em",
                      textTransform: "uppercase",
                      color: "var(--pos)",
                    }}
                  >
                    ✓ chip counts match
                  </p>
                ) : tableBank > 0 && Math.abs(delta) / tableBank > 0.5 ? (
                  <p
                    style={{ fontSize: 13, lineHeight: 1.5, color: "var(--terra)" }}
                  >
                    Delta is too large to divide. Recount and edit buy-ins above.
                  </p>
                ) : (
                  <>
                    <p
                      style={{ fontSize: 13, lineHeight: 1.5, color: "var(--terra)" }}
                      className="lg:hidden"
                    >
                      {delta > 0
                        ? `Over by ${formatCurrency(Math.abs(delta))} (${formatCurrency(totalFinalChips)} / ${formatCurrency(tableBank)})`
                        : `Short by ${formatCurrency(Math.abs(delta))} (${formatCurrency(totalFinalChips)} / ${formatCurrency(tableBank)})`}
                    </p>
                    <p
                      style={{ fontSize: 13, lineHeight: 1.5, color: "var(--terra)" }}
                      className="hidden lg:block"
                    >
                      {delta > 0
                        ? `Chip counts are over by ${formatCurrency(Math.abs(delta))}. Players counted ${formatCurrency(totalFinalChips)} but table bank is ${formatCurrency(tableBank)}.`
                        : `Chip counts are short by ${formatCurrency(Math.abs(delta))}. Players counted ${formatCurrency(totalFinalChips)} but table bank is ${formatCurrency(tableBank)}.`}
                    </p>
                  </>
                )}
              </div>

              {isHost ? (
                <div className="flex w-full items-center lg:w-auto lg:shrink-0">
                  {delta === 0 ? (
                    <motion.button
                      type="submit"
                      form="end-session-form"
                      disabled={isSaving}
                      whileTap={!isSaving ? { scale: 0.97 } : undefined}
                      style={{
                        flex: 1,
                        height: 44,
                        border: "1px solid var(--ink)",
                        background: "var(--ink)",
                        color: "var(--bg)",
                        fontFamily:
                          "var(--font-jetbrains-mono), ui-monospace, monospace",
                        fontSize: 11,
                        fontWeight: 500,
                        letterSpacing: "0.12em",
                        textTransform: "uppercase",
                        cursor: isSaving ? "wait" : "pointer",
                        opacity: isSaving ? 0.6 : 1,
                        transition:
                          "background 0.15s ease, border-color 0.15s ease",
                      }}
                      className="lg:h-10 lg:flex-none lg:px-5 enabled:hover:bg-[var(--terra)] enabled:hover:border-[var(--terra)]"
                    >
                      {isSaving
                        ? "saving..."
                        : isEditing
                          ? "save changes."
                          : "save & end session."}
                    </motion.button>
                  ) : tableBank > 0 && Math.abs(delta) / tableBank <= 0.5 ? (
                    <motion.button
                      type="button"
                      onClick={handleDivideEqually}
                      whileTap={{ scale: 0.97 }}
                      style={{
                        flex: 1,
                        height: 44,
                        border: "1px solid var(--rule-strong)",
                        background: "transparent",
                        color: "var(--ink-soft)",
                        fontFamily:
                          "var(--font-jetbrains-mono), ui-monospace, monospace",
                        fontSize: 11,
                        fontWeight: 500,
                        letterSpacing: "0.12em",
                        textTransform: "uppercase",
                        cursor: "pointer",
                        transition:
                          "border-color 0.15s ease, color 0.15s ease",
                      }}
                      className="lg:h-10 lg:flex-none lg:px-5 hover:border-[var(--terra)] hover:text-[var(--ink)]"
                    >
                      divide {formatCurrency(Math.abs(delta))} equally
                    </motion.button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
