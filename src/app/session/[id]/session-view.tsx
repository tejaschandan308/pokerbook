"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getStoredPin, storePin } from "@/lib/pin-auth";

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

  // PIN / host auth state
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

      if (!isMounted) {
        return;
      }

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

      if (!isMounted) {
        return;
      }

      if (playersError || !playerData) {
        setLoadingState("error");
        setErrorMessage("couldn't load the table.");
        return;
      }

      // Check whether this session requires a PIN
      const { data: hasPinData } = await supabase
        .rpc("session_has_pin", { p_session_id: sessionId });

      if (!isMounted) {
        return;
      }

      const requiresPin = !!hasPinData;
      setSessionHasPin(requiresPin);

      if (!requiresPin) {
        // Legacy session with no PIN — everyone can edit
        setIsHost(true);
      } else {
        const storedPin = getStoredPin(sessionId);
        if (storedPin) {
          setIsHost(true);
        }
      }

      setSession(sessionData);
      setPlayers(playerData);
      setLoadingState("ready");
    }

    loadSession();

    return () => {
      isMounted = false;
    };
  }, [router, sessionId]);

  async function refreshPlayers() {
    if (!supabase) {
      return;
    }

    const { data } = await supabase
      .from("players")
      .select("id,name,total_buy_ins,final_chips,created_at")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });

    if (data) {
      setPlayers(data);
    }
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

    if (error) {
      setPinError("something went wrong. try again.");
      return;
    }

    if (!isValid) {
      setPinError("wrong PIN. try again.");
      return;
    }

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
    if (isDuplicate) {
      setAddPlayerError("already in the game.");
      return;
    }

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
      // Clipboard not available — silently fail
    }
  }

  async function addBuyIn(player: Player) {
    if (!supabase || pendingPlayerId) {
      return;
    }

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
    <main className="min-h-screen overflow-x-hidden bg-background px-5 py-6 text-foreground sm:px-10 sm:py-8">
      {/* PIN modal */}
      {showPinModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-5">
          <div className="w-full max-w-sm border border-[var(--line)] bg-background p-6 shadow-xl">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--terracotta)]">
              host PIN
            </p>
            <h2 className="mt-3 text-2xl font-semibold">unlock to edit.</h2>
            <p className="mt-2 text-sm text-[var(--ink-soft)]">
              Enter the 4-digit host PIN to enable edit mode.
            </p>
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
              className="mt-4 h-14 w-full border border-[var(--line)] bg-background px-3 text-center font-mono text-3xl tracking-[0.5em] outline-none transition focus:border-[var(--terracotta)]"
            />
            {pinError ? (
              <p className="mt-2 text-sm text-[var(--terracotta)]">
                {pinError}
              </p>
            ) : null}
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={cancelPinModal}
                className="h-10 flex-1 border border-[var(--line)] font-mono text-xs uppercase tracking-[0.12em] text-[var(--ink-soft)] transition hover:border-[var(--terracotta)] hover:text-foreground"
              >
                cancel.
              </button>
              <button
                type="button"
                onClick={verifyPin}
                disabled={pinInput.length !== 4 || isVerifyingPin}
                className="h-10 flex-1 border border-foreground bg-foreground font-mono text-xs uppercase tracking-[0.12em] text-background transition enabled:hover:bg-[var(--terracotta)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isVerifyingPin ? "checking..." : "unlock."}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <section className="mx-auto w-full max-w-5xl">
        <nav className="flex items-center justify-between gap-4 border-b border-[var(--line)] pb-5 font-mono text-xs uppercase tracking-[0.18em] text-[var(--ink-soft)]">
          <Link href="/" className="transition hover:text-[var(--terracotta)]">
            pokerbook
          </Link>
          <span className="text-[var(--table-green)]">
            {loadingState !== "ready"
              ? "loading"
              : isHost
                ? "active · edit"
                : "active"}
          </span>
        </nav>

        {loadingState === "loading" ? (
          <SessionMessage eyebrow="loading" headline="finding the table." />
        ) : null}

        {loadingState === "missing" ? (
          <SessionMessage
            eyebrow="not found"
            headline="no table here."
            body="Check the link and try again."
          />
        ) : null}

        {loadingState === "error" ? (
          <SessionMessage
            eyebrow="blocked"
            headline="couldn't load this one."
            body={errorMessage || "Try refreshing the page."}
          />
        ) : null}

        {loadingState === "ready" && session ? (
          <div className="py-8 sm:py-12">
            <header className="grid gap-6 border-b border-[var(--line)] pb-8 lg:grid-cols-[1fr_auto] lg:items-end">
              <div>
                <p className="font-mono text-sm uppercase tracking-[0.18em] text-[var(--terracotta)]">
                  {"♠"} active session
                </p>
                <h1 className="mt-4 text-5xl font-semibold leading-none tracking-normal sm:text-7xl">
                  {session.name || "poker night."}
                </h1>
                <p className="mt-5 max-w-2xl text-base leading-7 text-[var(--ink-soft)] sm:text-lg">
                  Tap once when someone re-buys. Everyone starts with one
                  buy-in.
                </p>
                {isHost ? (
                  <button
                    type="button"
                    onClick={copyLink}
                    className="mt-5 inline-flex h-11 items-center gap-2 border border-[var(--table-green)] px-4 font-mono text-xs uppercase tracking-[0.12em] text-[var(--table-green)] transition hover:bg-[var(--table-green)] hover:text-background"
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
                  </button>
                ) : null}
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:min-w-[460px]">
                <Stat label="buy-in" value={formatCurrency(session.buy_in_amount)} />
                <Stat label="total buy-ins" value={String(totalBuyIns)} />
                <Stat label="table bank" value={formatCurrency(tableBank)} />
              </div>
            </header>

            {/* View-only banner */}
            {!isHost && sessionHasPin ? (
              <button
                type="button"
                onClick={() => setShowPinModal(true)}
                className="mt-5 flex w-full cursor-pointer items-center justify-between border border-[var(--line)] bg-[#fffaf0] px-4 py-3 text-left transition hover:border-[var(--terracotta)]"
              >
                <span className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--ink-soft)]">
                  view only · enter host PIN to edit
                </span>
                <span className="shrink-0 font-mono text-xs text-[var(--terracotta)]">
                  unlock →
                </span>
              </button>
            ) : null}

            {errorMessage ? (
              <p className="mt-5 border border-[var(--terracotta)] bg-[#fffaf0] p-3 text-sm text-[var(--terracotta)]">
                {errorMessage}
              </p>
            ) : null}

            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {players.map((player) => {
                const playerInFor = player.total_buy_ins * session.buy_in_amount;
                const isPending = pendingPlayerId === player.id;

                return (
                  <article
                    key={player.id}
                    className="min-w-0 border border-[var(--line)] bg-[#fffaf0] p-5 shadow-[0_18px_60px_rgba(36,25,19,0.07)]"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="truncate text-2xl font-semibold leading-tight">
                          {player.name}
                        </p>
                        <p className="mt-2 font-mono text-xs uppercase tracking-[0.16em] text-[var(--ink-soft)]">
                          in for {formatCurrency(playerInFor)}
                        </p>
                      </div>
                      <span className="shrink-0 font-serif text-3xl italic text-[var(--terracotta)]">
                        {player.total_buy_ins}
                      </span>
                    </div>

                    <div className="mt-7 flex items-end justify-between gap-4">
                      <div>
                        <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--ink-soft)]">
                          buy-ins
                        </p>
                        <p className="mt-1 text-sm text-[var(--ink-soft)]">
                          total so far
                        </p>
                      </div>
                      {isHost ? (
                        <button
                          type="button"
                          onClick={() => addBuyIn(player)}
                          disabled={Boolean(pendingPlayerId)}
                          className="h-11 border border-[var(--table-green)] px-4 font-mono text-xs uppercase tracking-[0.12em] text-[var(--table-green)] transition enabled:hover:bg-[var(--table-green)] enabled:hover:text-background disabled:cursor-wait disabled:opacity-50"
                        >
                          {isPending ? "adding..." : "+1 buy-in."}
                        </button>
                      ) : null}
                    </div>
                  </article>
                );
              })}

              {/* Ghost tile — add player */}
              {isHost ? (
                players.length >= MAX_PLAYERS ? (
                  <article className="flex min-h-[160px] min-w-0 flex-col items-center justify-center border border-dashed border-[var(--line)] p-5 opacity-50">
                    <p className="font-mono text-xs uppercase tracking-[0.14em] text-[var(--ink-soft)]">
                      session full.
                    </p>
                  </article>
                ) : ghostState === "idle" ? (
                  <article
                    onClick={() => setGhostState("form")}
                    className="flex min-h-[160px] min-w-0 cursor-pointer flex-col items-center justify-center border border-dashed border-[var(--line)] p-5 transition hover:border-[var(--ink-soft)] hover:bg-[#fffaf0]"
                  >
                    <span className="text-3xl font-light text-[var(--ink-soft)]">
                      +
                    </span>
                    <p className="mt-2 font-mono text-xs uppercase tracking-[0.14em] text-[var(--ink-soft)]">
                      add player.
                    </p>
                  </article>
                ) : (
                  <article className="min-w-0 border border-[var(--line)] bg-[#fffaf0] p-5 shadow-[0_18px_60px_rgba(36,25,19,0.07)]">
                    <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--ink-soft)]">
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
                      className="mt-2 h-11 w-full border border-[var(--line)] bg-background px-3 text-base outline-none transition focus:border-[var(--terracotta)]"
                    />
                    {addPlayerError ? (
                      <p className="mt-1 text-xs text-[var(--terracotta)]">
                        {addPlayerError}
                      </p>
                    ) : null}
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={cancelAddPlayer}
                        className="h-9 flex-1 border border-[var(--line)] font-mono text-xs uppercase tracking-[0.12em] text-[var(--ink-soft)] transition hover:border-[var(--terracotta)] hover:text-foreground"
                      >
                        cancel.
                      </button>
                      <button
                        type="button"
                        onClick={addPlayer}
                        disabled={!newPlayerName.trim() || isAddingPlayer}
                        className="h-9 flex-1 border border-[var(--table-green)] font-mono text-xs uppercase tracking-[0.12em] text-[var(--table-green)] transition enabled:hover:bg-[var(--table-green)] enabled:hover:text-background disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {isAddingPlayer ? "adding..." : "add."}
                      </button>
                    </div>
                  </article>
                )
              ) : null}
            </div>

            {isHost ? (
              <div className="mt-8 border-t border-[var(--line)] pt-6">
                <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
                  <p className="max-w-xl text-sm leading-6 text-[var(--ink-soft)]">
                    Done with the last hand? Enter final chips before closing
                    the table.
                  </p>
                  <Link
                    href={`/session/${sessionId}/end`}
                    className="inline-flex h-12 items-center justify-center border border-[var(--terracotta)] px-5 font-mono text-xs uppercase tracking-[0.12em] text-[var(--terracotta)] transition hover:bg-[var(--terracotta)] hover:text-background"
                  >
                    end session.
                  </Link>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>
    </main>
  );
}

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
