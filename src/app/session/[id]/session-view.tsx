"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { getStoredPin, storePin } from "@/lib/pin-auth";
import { SuitRow } from "@/components/ui/suit-row";

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

type SessionViewProps = {
  sessionId: string;
};

const MAX_PLAYERS = 10;

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

const cardVariants = {
  hidden: { opacity: 0, y: 16, scale: 0.97 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.4, ease } },
  exit: { opacity: 0, scale: 0.93, transition: { duration: 0.2 } },
};

const statVariants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease } },
};

function containerVariants(stagger = 0.07, delay = 0.1) {
  return {
    hidden: {},
    show: { transition: { staggerChildren: stagger, delayChildren: delay } },
  };
}

/* ─── Chip dots ──────────────────────────────────────────────────────────── */

const CHIP_COLORS = [
  "var(--chip-a)",
  "var(--chip-b)",
  "var(--chip-d)",
  "var(--chip-a)",
  "var(--chip-b)",
  "var(--chip-d)",
  "var(--chip-a)",
  "var(--chip-b)",
  "var(--chip-d)",
  "var(--chip-a)",
];

function ChipDots({ count }: { count: number }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
      <AnimatePresence initial={false}>
        {Array.from({ length: count }).map((_, i) => (
          <motion.div
            key={i}
            initial={i === count - 1 ? { opacity: 0, scale: 0 } : false}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0 }}
            transition={{ duration: 0.25, ease: [0.34, 1.56, 0.64, 1] }}
            style={{
              width: 9,
              height: 9,
              borderRadius: "50%",
              background: CHIP_COLORS[i % CHIP_COLORS.length],
              flexShrink: 0,
            }}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

/* ─── Stat card ──────────────────────────────────────────────────────────── */

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <motion.div
      variants={statVariants}
      style={{
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
              fontSize: 24,
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

/* ─── Session message ────────────────────────────────────────────────────── */

function SessionMessage({
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

/* ─── Modal shell ────────────────────────────────────────────────────────── */

function ModalShell({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.65)",
        backdropFilter: "blur(4px)",
        padding: 20,
      }}
    >
      <motion.div
        initial={{ scale: 0.96, y: 8 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.96, y: 8 }}
        transition={{ duration: 0.2, ease }}
        style={{
          width: "100%",
          maxWidth: 360,
          background: "var(--bg-card)",
          border: "1px solid var(--rule-strong)",
          padding: 24,
        }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

const modalEyebrow: React.CSSProperties = {
  fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace",
  fontSize: 10,
  fontWeight: 500,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: "var(--terra)",
};

const modalHeading: React.CSSProperties = {
  fontFamily: "var(--font-instrument-serif), serif",
  fontSize: 26,
  fontWeight: 400,
  letterSpacing: "-0.01em",
  color: "var(--ink)",
  marginTop: 12,
};

const modalBody: React.CSSProperties = {
  fontSize: 14,
  lineHeight: 1.5,
  color: "var(--ink-soft)",
  marginTop: 8,
};

const modalBtnRow: React.CSSProperties = {
  marginTop: 16,
  display: "flex",
  gap: 10,
};

const monoBtn: React.CSSProperties = {
  flex: 1,
  height: 40,
  background: "transparent",
  fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace",
  fontSize: 11,
  fontWeight: 500,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  cursor: "pointer",
  transition: "background 0.15s ease, color 0.15s ease, border-color 0.15s ease",
};

/* ─── Main component ─────────────────────────────────────────────────────── */

export function SessionView({ sessionId }: SessionViewProps) {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loadingState, setLoadingState] = useState<
    "loading" | "ready" | "missing" | "error"
  >("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [pendingPlayerId, setPendingPlayerId] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");
  const [ghostState, setGhostState] = useState<"idle" | "form">("idle");
  const [newPlayerName, setNewPlayerName] = useState("");
  const [addPlayerError, setAddPlayerError] = useState("");
  const [isAddingPlayer, setIsAddingPlayer] = useState(false);

  const [deletePlayerId, setDeletePlayerId] = useState<string | null>(null);
  const [isDeletingPlayer, setIsDeletingPlayer] = useState(false);

  const [sessionHasPin, setSessionHasPin] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");
  const [isVerifyingPin, setIsVerifyingPin] = useState(false);

  const totalBuyIns = useMemo(
    () => players.reduce((sum, player) => sum + player.total_buy_ins, 0),
    [players],
  );

  const tableBank = session ? totalBuyIns * session.buy_in_amount : 0;

  useEffect(() => {
    let isMounted = true;

    async function loadSession() {
      if (!supabase) {
        setLoadingState("error");
        setErrorMessage("supabase keys are missing.");
        return;
      }

      setLoadingState("loading");
      setErrorMessage("");

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

      if (sessionData.status === "ended") {
        router.replace(`/session/${sessionId}/summary`);
        return;
      }

      const { data: playerData, error: playersError } = await supabase
        .from("players")
        .select("id,name,total_buy_ins,final_chips,created_at")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true });

      if (!isMounted) return;

      if (playersError || !playerData) {
        setLoadingState("error");
        setErrorMessage("couldn't load the table.");
        return;
      }

      const { data: hasPinData } = await supabase.rpc("session_has_pin", {
        p_session_id: sessionId,
      });

      if (!isMounted) return;

      const requiresPin = !!hasPinData;
      setSessionHasPin(requiresPin);

      if (!requiresPin) {
        setIsHost(true);
      } else {
        const storedPin = getStoredPin(sessionId);
        if (storedPin) setIsHost(true);
      }

      setSession(sessionData);
      setPlayers(playerData);
      setLoadingState("ready");
    }

    loadSession();
    return () => { isMounted = false; };
  }, [router, sessionId]);

  useEffect(() => {
    if (!supabase) return;

    const channel = supabase
      .channel(`session-players-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "players",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const deletedId = (payload.old as { id: string }).id;
          if (deletedId) {
            setPlayers((current) => current.filter((p) => p.id !== deletedId));
          }
        },
      )
      .subscribe();

    return () => { supabase?.removeChannel(channel); };
  }, [sessionId]);

  async function refreshPlayers() {
    if (!supabase) return;
    const { data } = await supabase
      .from("players")
      .select("id,name,total_buy_ins,final_chips,created_at")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });
    if (data) setPlayers(data);
  }

  async function verifyPin() {
    if (!supabase || isVerifyingPin || pinInput.length !== 4) return;
    setIsVerifyingPin(true);
    setPinError("");

    const { data: isValid, error } = await supabase.rpc("verify_session_pin", {
      p_session_id: sessionId,
      p_pin: pinInput,
    });

    setIsVerifyingPin(false);

    if (error) { setPinError("something went wrong. try again."); return; }
    if (!isValid) { setPinError("wrong PIN. try again."); return; }

    storePin(sessionId, pinInput);
    setIsHost(true);
    setShowPinModal(false);
    setPinInput("");
  }

  function cancelPinModal() {
    setShowPinModal(false);
    setPinInput("");
    setPinError("");
  }

  function cancelAddPlayer() {
    setGhostState("idle");
    setNewPlayerName("");
    setAddPlayerError("");
  }

  async function addPlayer() {
    if (!supabase || isAddingPlayer) return;
    const trimmed = newPlayerName.trim();
    if (!trimmed) return;

    const isDuplicate = players.some(
      (p) => p.name.toLowerCase() === trimmed.toLowerCase(),
    );
    if (isDuplicate) { setAddPlayerError("already in the game."); return; }

    setIsAddingPlayer(true);
    setAddPlayerError("");

    const storedPin = getStoredPin(sessionId);
    const { error } = await supabase.rpc("add_player_with_pin", {
      p_session_id: sessionId,
      p_pin: storedPin,
      p_name: trimmed,
    });

    if (error) {
      setAddPlayerError(
        error.message === "invalid pin"
          ? "host PIN required."
          : "couldn't add the player.",
      );
      setIsAddingPlayer(false);
      return;
    }

    await refreshPlayers();
    setNewPlayerName("");
    setGhostState("idle");
    setIsAddingPlayer(false);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopyState("copied");
      setTimeout(() => setCopyState("idle"), 2000);
    } catch {
      // Clipboard not available
    }
  }

  async function deletePlayer() {
    if (!supabase || !deletePlayerId || isDeletingPlayer) return;
    setIsDeletingPlayer(true);
    setErrorMessage("");

    const storedPin = getStoredPin(sessionId);
    const { error } = await supabase.rpc("delete_player_with_pin", {
      p_player_id: deletePlayerId,
      p_session_id: sessionId,
      p_pin: storedPin,
    });

    if (error) {
      setErrorMessage("couldn't remove the player. please try again.");
      setIsDeletingPlayer(false);
      setDeletePlayerId(null);
      return;
    }

    setPlayers((current) => current.filter((p) => p.id !== deletePlayerId));
    setDeletePlayerId(null);
    setIsDeletingPlayer(false);
  }

  async function addBuyIn(player: Player) {
    if (!supabase || pendingPlayerId) return;
    setPendingPlayerId(player.id);
    setErrorMessage("");

    const storedPin = getStoredPin(sessionId);
    const { data, error } = await supabase
      .rpc("increment_player_buy_in", {
        player_id: player.id,
        p_pin: storedPin,
      })
      .single<Player>();

    if (error || !data) {
      await refreshPlayers();
      setErrorMessage("something went wrong. please try again.");
      setPendingPlayerId(null);
      return;
    }

    setPlayers((currentPlayers) =>
      currentPlayers.map((currentPlayer) =>
        currentPlayer.id === data.id ? data : currentPlayer,
      ),
    );
    setPendingPlayerId(null);
  }

  return (
    <main
      style={{
        background: "var(--bg)",
        color: "var(--ink)",
        minHeight: "100vh",
        position: "relative",
        overflowX: "hidden",
      }}
    >
      <div className="felt-motif" />

      {/* ── PIN modal ── */}
      <AnimatePresence>
        {showPinModal ? (
          <ModalShell>
            <p style={modalEyebrow}>host PIN</p>
            <h2 style={modalHeading}>unlock to edit.</h2>
            <p style={modalBody}>Enter the 4-digit host PIN to enable edit mode.</p>
            <input
              autoFocus
              type="text"
              inputMode="numeric"
              maxLength={4}
              pattern="[0-9]*"
              value={pinInput}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, "").slice(0, 4);
                setPinInput(val);
                setPinError("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && pinInput.length === 4) verifyPin();
                if (e.key === "Escape") cancelPinModal();
              }}
              placeholder="----"
              style={{
                marginTop: 16,
                height: 56,
                width: "100%",
                border: "1px solid var(--rule)",
                background: "var(--bg-elev)",
                padding: "0 12px",
                textAlign: "center",
                fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace",
                fontSize: 28,
                letterSpacing: "0.5em",
                color: "var(--ink)",
                outline: "none",
                transition: "border-color 0.15s ease",
              }}
              className="focus:border-[var(--terra)]"
            />
            {pinError ? (
              <p style={{ marginTop: 8, fontSize: 13, color: "var(--terra)" }}>
                {pinError}
              </p>
            ) : null}
            <div style={modalBtnRow}>
              <motion.button
                type="button"
                onClick={cancelPinModal}
                whileTap={{ scale: 0.97 }}
                style={{
                  ...monoBtn,
                  border: "1px solid var(--rule)",
                  color: "var(--ink-soft)",
                }}
                className="hover:border-[var(--terra)] hover:text-[var(--ink)]"
              >
                cancel.
              </motion.button>
              <motion.button
                type="button"
                onClick={verifyPin}
                disabled={pinInput.length !== 4 || isVerifyingPin}
                whileTap={{ scale: 0.97 }}
                style={{
                  ...monoBtn,
                  border: "1px solid var(--ink)",
                  background: "var(--ink)",
                  color: "var(--bg)",
                }}
                className="enabled:hover:bg-[var(--terra)] enabled:hover:border-[var(--terra)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isVerifyingPin ? "checking..." : "unlock."}
              </motion.button>
            </div>
          </ModalShell>
        ) : null}
      </AnimatePresence>

      {/* ── Delete confirmation modal ── */}
      <AnimatePresence>
        {deletePlayerId ? (
          <ModalShell>
            <p style={modalEyebrow}>confirm</p>
            <h2 style={modalHeading}>
              Remove {players.find((p) => p.id === deletePlayerId)?.name}?
            </h2>
            <p style={modalBody}>
              This will remove the player AND their buy-ins from the table bank.
            </p>
            <div style={modalBtnRow}>
              <motion.button
                type="button"
                onClick={() => setDeletePlayerId(null)}
                disabled={isDeletingPlayer}
                whileTap={{ scale: 0.97 }}
                style={{
                  ...monoBtn,
                  border: "1px solid var(--rule)",
                  color: "var(--ink-soft)",
                }}
                className="hover:border-[var(--terra)] hover:text-[var(--ink)] disabled:opacity-50"
              >
                cancel.
              </motion.button>
              <motion.button
                type="button"
                onClick={deletePlayer}
                disabled={isDeletingPlayer}
                whileTap={{ scale: 0.97 }}
                style={{
                  ...monoBtn,
                  border: "1px solid var(--terra)",
                  background: "var(--terra)",
                  color: "var(--bg)",
                }}
                className="enabled:hover:bg-transparent enabled:hover:text-[var(--terra)] disabled:cursor-wait disabled:opacity-50"
              >
                {isDeletingPlayer ? "removing..." : "delete."}
              </motion.button>
            </div>
          </ModalShell>
        ) : null}
      </AnimatePresence>

      <div
        style={{
          position: "relative",
          zIndex: 1,
          maxWidth: 1000,
          margin: "0 auto",
          padding: "0 20px 80px",
        }}
        className="sm:px-10"
      >
        {/* ── Header bar ── */}
        <div style={{ paddingTop: 14, paddingBottom: 16 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Link
              href="/"
              className="wordmark-link"
              style={{
                fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace",
                fontSize: 12,
                fontWeight: 500,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
              }}
            >
              pokerbook
            </Link>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              {loadingState === "ready" ? (
                <span
                  style={{
                    fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace",
                    fontSize: 11,
                    fontWeight: 500,
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                    color: "var(--felt)",
                  }}
                >
                  {isHost ? "live · edit" : "live now"}
                </span>
              ) : null}
              <SuitRow size={11} />
            </div>
          </div>
          <div style={{ borderTop: "1px solid var(--rule)", marginTop: 12 }} />
        </div>

        {loadingState === "loading" && (
          <SessionMessage eyebrow="loading" headline="finding the table." />
        )}
        {loadingState === "missing" && (
          <SessionMessage
            eyebrow="not found"
            headline="no table here."
            body="Check the link and try again."
          />
        )}
        {loadingState === "error" && (
          <SessionMessage
            eyebrow="blocked"
            headline="couldn't load this one."
            body={errorMessage || "Try refreshing the page."}
          />
        )}

        {loadingState === "ready" && session ? (
          <div style={{ paddingTop: 32 }}>
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
                  ♠ active session
                </p>

                <h1
                  style={{
                    fontFamily: "var(--font-instrument-serif), serif",
                    fontSize: "clamp(40px, 8vw, 80px)",
                    fontWeight: 400,
                    lineHeight: 0.95,
                    letterSpacing: "-0.02em",
                    color: "var(--ink)",
                    marginTop: 14,
                  }}
                >
                  {session.name || "poker night"}
                  <span style={{ color: "var(--terra)", fontStyle: "italic" }}>.</span>
                </h1>

                <p
                  style={{
                    fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace",
                    fontSize: 11,
                    fontWeight: 500,
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    color: "var(--felt)",
                    marginTop: 14,
                  }}
                >
                  live now · {players.length} at the table
                </p>

                {isHost ? (
                  <motion.button
                    type="button"
                    onClick={copyLink}
                    whileTap={{ scale: 0.97 }}
                    style={{
                      marginTop: 20,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      height: 40,
                      border: "1px solid var(--felt)",
                      padding: "0 16px",
                      fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace",
                      fontSize: 11,
                      fontWeight: 500,
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      color: "var(--felt)",
                      background: "transparent",
                      cursor: "pointer",
                      transition: "background 0.15s ease, color 0.15s ease",
                    }}
                    className="hover:bg-[var(--felt)] hover:text-[var(--bg)]"
                  >
                    {copyState === "copied" ? (
                      "copied."
                    ) : (
                      <>
                        <svg
                          width="13"
                          height="13"
                          viewBox="0 0 13 13"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M4.5 1H2a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V8.5" />
                          <path d="M7.5 1H12v4.5" />
                          <path d="M12 1L6 7" />
                        </svg>
                        copy link.
                      </>
                    )}
                  </motion.button>
                ) : null}
              </div>

              {/* Stat cards */}
              <motion.div
                variants={containerVariants(0.07, 0.2)}
                initial="hidden"
                animate="show"
                style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}
                className="lg:min-w-[440px]"
              >
                <Stat label="buy-in" value={formatCurrency(session.buy_in_amount)} />
                <Stat label="total buy-ins" value={String(totalBuyIns)} />
                <Stat label="table bank" value={formatCurrency(tableBank)} />
              </motion.div>
            </header>

            {/* View-only banner */}
            {!isHost && sessionHasPin ? (
              <motion.button
                type="button"
                onClick={() => setShowPinModal(true)}
                whileTap={{ scale: 0.99 }}
                style={{
                  marginTop: 20,
                  display: "flex",
                  width: "100%",
                  cursor: "pointer",
                  alignItems: "center",
                  justifyContent: "space-between",
                  border: "1px solid var(--rule)",
                  background: "var(--bg-card)",
                  padding: "12px 16px",
                  textAlign: "left",
                  transition: "border-color 0.15s ease",
                }}
                className="hover:border-[var(--terra)]"
              >
                <span
                  style={{
                    fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace",
                    fontSize: 11,
                    fontWeight: 500,
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                    color: "var(--ink-soft)",
                  }}
                >
                  view only · enter host PIN to edit
                </span>
                <span
                  style={{
                    flexShrink: 0,
                    fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace",
                    fontSize: 11,
                    color: "var(--terra)",
                  }}
                >
                  unlock →
                </span>
              </motion.button>
            ) : null}

            {errorMessage ? (
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
                {errorMessage}
              </p>
            ) : null}

            {/* Player cards */}
            <motion.div
              variants={containerVariants(0.06, 0.35)}
              initial="hidden"
              animate="show"
              style={{ marginTop: 24, display: "grid", gap: 14 }}
              className="sm:grid-cols-2 lg:grid-cols-3"
            >
              <AnimatePresence mode="popLayout">
                {players.map((player) => {
                  const playerInFor = player.total_buy_ins * session.buy_in_amount;
                  const isPending = pendingPlayerId === player.id;

                  return (
                    <motion.article
                      key={player.id}
                      layout
                      variants={cardVariants}
                      exit="exit"
                      style={{
                        minWidth: 0,
                        border: "1px solid var(--rule)",
                        background: "var(--bg-card)",
                        padding: 20,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          justifyContent: "space-between",
                          gap: 12,
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <p
                            style={{
                              fontFamily: "var(--font-instrument-serif), serif",
                              fontStyle: "italic",
                              fontSize: 24,
                              fontWeight: 400,
                              letterSpacing: "-0.01em",
                              lineHeight: 1.1,
                              color: "var(--ink)",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {player.name}
                          </p>
                          <p
                            style={{
                              marginTop: 6,
                              fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace",
                              fontSize: 10,
                              fontWeight: 500,
                              letterSpacing: "0.16em",
                              textTransform: "uppercase",
                              color: "var(--ink-mute)",
                            }}
                          >
                            in for {formatCurrency(playerInFor)}
                          </p>
                        </div>

                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "flex-end",
                            gap: 2,
                            flexShrink: 0,
                          }}
                        >
                          {isHost ? (
                            <motion.button
                              type="button"
                              onClick={() => setDeletePlayerId(player.id)}
                              disabled={Boolean(pendingPlayerId)}
                              aria-label={`Remove ${player.name}`}
                              whileTap={{ scale: 0.9 }}
                              style={{
                                display: "flex",
                                height: 28,
                                width: 28,
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: 18,
                                color: "var(--ink-mute)",
                                background: "transparent",
                                border: "none",
                                cursor: "pointer",
                                transition: "color 0.15s ease",
                              }}
                              className="hover:text-[var(--terra)] disabled:opacity-40"
                            >
                              ×
                            </motion.button>
                          ) : null}
                          <div
                            style={{
                              overflow: "hidden",
                              minWidth: 28,
                              textAlign: "right",
                            }}
                          >
                            <AnimatePresence mode="popLayout" initial={false}>
                              <motion.span
                                key={player.total_buy_ins}
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 10 }}
                                transition={{ duration: 0.2, ease }}
                                style={{
                                  display: "block",
                                  fontFamily: "var(--font-instrument-serif), serif",
                                  fontStyle: "italic",
                                  fontSize: 32,
                                  fontWeight: 400,
                                  lineHeight: 1,
                                  color: "var(--terra)",
                                }}
                              >
                                {player.total_buy_ins}
                              </motion.span>
                            </AnimatePresence>
                          </div>
                        </div>
                      </div>

                      <div style={{ marginTop: 16 }}>
                        <ChipDots count={player.total_buy_ins} />
                      </div>

                      <div
                        style={{
                          marginTop: 16,
                          display: "flex",
                          alignItems: "flex-end",
                          justifyContent: "space-between",
                          gap: 12,
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
                          buy-ins
                        </p>
                        {isHost ? (
                          <motion.button
                            type="button"
                            onClick={() => addBuyIn(player)}
                            disabled={Boolean(pendingPlayerId)}
                            whileTap={{ scale: 0.96 }}
                            style={{
                              height: 40,
                              border: "1px solid var(--terra)",
                              padding: "0 16px",
                              fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace",
                              fontSize: 11,
                              fontWeight: 500,
                              letterSpacing: "0.12em",
                              textTransform: "uppercase",
                              color: "var(--terra)",
                              background: "transparent",
                              cursor: "pointer",
                              transition: "background 0.15s ease, color 0.15s ease",
                            }}
                            className="enabled:hover:bg-[var(--terra)] enabled:hover:text-[var(--bg)] disabled:cursor-wait disabled:opacity-50"
                          >
                            {isPending ? "adding..." : "+1 buy-in."}
                          </motion.button>
                        ) : null}
                      </div>
                    </motion.article>
                  );
                })}

                {/* Ghost tile: add player */}
                {isHost && players.length >= MAX_PLAYERS && (
                  <motion.article
                    key="ghost-full"
                    variants={cardVariants}
                    style={{
                      display: "flex",
                      minHeight: 160,
                      minWidth: 0,
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      border: "1px dashed var(--rule)",
                      padding: 20,
                      opacity: 0.5,
                    }}
                  >
                    <p
                      style={{
                        fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace",
                        fontSize: 10,
                        fontWeight: 500,
                        letterSpacing: "0.14em",
                        textTransform: "uppercase",
                        color: "var(--ink-mute)",
                      }}
                    >
                      session full.
                    </p>
                  </motion.article>
                )}

                {isHost && players.length < MAX_PLAYERS && ghostState === "idle" && (
                  <motion.article
                    key="ghost-add"
                    variants={cardVariants}
                    onClick={() => setGhostState("form")}
                    whileTap={{ scale: 0.98 }}
                    style={{
                      display: "flex",
                      minHeight: 160,
                      minWidth: 0,
                      cursor: "pointer",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      border: "1px dashed var(--rule)",
                      padding: 20,
                      transition: "border-color 0.15s ease, background 0.15s ease",
                    }}
                    className="hover:border-[var(--ink-mute)] hover:bg-[var(--bg-elev)]"
                  >
                    <span
                      style={{ fontSize: 28, fontWeight: 300, color: "var(--ink-mute)" }}
                    >
                      +
                    </span>
                    <p
                      style={{
                        marginTop: 8,
                        fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace",
                        fontSize: 10,
                        fontWeight: 500,
                        letterSpacing: "0.14em",
                        textTransform: "uppercase",
                        color: "var(--ink-mute)",
                      }}
                    >
                      add player.
                    </p>
                  </motion.article>
                )}

                {isHost && players.length < MAX_PLAYERS && ghostState === "form" && (
                  <motion.article
                    key="ghost-form"
                    variants={cardVariants}
                    style={{
                      minWidth: 0,
                      border: "1px solid var(--rule)",
                      background: "var(--bg-card)",
                      padding: 20,
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
                      new player.
                    </p>
                    <input
                      autoFocus
                      type="text"
                      placeholder="name"
                      value={newPlayerName}
                      onChange={(e) => {
                        setNewPlayerName(e.target.value);
                        setAddPlayerError("");
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") addPlayer();
                        if (e.key === "Escape") cancelAddPlayer();
                      }}
                      style={{
                        marginTop: 10,
                        height: 44,
                        width: "100%",
                        border: "1px solid var(--rule)",
                        background: "var(--bg-elev)",
                        padding: "0 12px",
                        fontSize: 15,
                        color: "var(--ink)",
                        outline: "none",
                        transition: "border-color 0.15s ease",
                      }}
                      className="placeholder:text-[var(--ink-mute)]/60 focus:border-[var(--ink)]"
                    />
                    {addPlayerError ? (
                      <p style={{ marginTop: 6, fontSize: 12, color: "var(--terra)" }}>
                        {addPlayerError}
                      </p>
                    ) : null}
                    <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
                      <motion.button
                        type="button"
                        onClick={cancelAddPlayer}
                        whileTap={{ scale: 0.97 }}
                        style={{
                          ...monoBtn,
                          border: "1px solid var(--rule)",
                          color: "var(--ink-soft)",
                        }}
                        className="hover:border-[var(--terra)] hover:text-[var(--ink)]"
                      >
                        cancel.
                      </motion.button>
                      <motion.button
                        type="button"
                        onClick={addPlayer}
                        disabled={!newPlayerName.trim() || isAddingPlayer}
                        whileTap={{ scale: 0.97 }}
                        style={{
                          ...monoBtn,
                          border: "1px solid var(--felt)",
                          color: "var(--felt)",
                        }}
                        className="enabled:hover:bg-[var(--felt)] enabled:hover:text-[var(--bg)] disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {isAddingPlayer ? "adding..." : "add."}
                      </motion.button>
                    </div>
                  </motion.article>
                )}
              </AnimatePresence>
            </motion.div>

            {/* End session footer */}
            {isHost ? (
              <div
                style={{
                  marginTop: 32,
                  borderTop: "1px solid var(--rule)",
                  paddingTop: 24,
                }}
              >
                <div
                  style={{ display: "grid", gap: 16 }}
                  className="sm:grid-cols-[1fr_auto] sm:items-center"
                >
                  <p
                    style={{
                      fontSize: 14,
                      lineHeight: 1.6,
                      color: "var(--ink-soft)",
                      maxWidth: 480,
                    }}
                  >
                    Done with the last hand? Enter final chips before closing
                    the table.
                  </p>
                  <Link
                    href={`/session/${sessionId}/end`}
                    className="btn-terra"
                  >
                    end session.
                  </Link>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </main>
  );
}
