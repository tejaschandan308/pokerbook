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

    const { error } = await supabase.from("players").insert({
      session_id: sessionId,
      name: trimmed,
      total_buy_ins: 1,
    });

    if (error) {
      setAddPlayerError("couldn't add the player.");
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

    const nextBuyIns = player.total_buy_ins + 1;
    const { data, error } = await supabase
      .from("players")
      .update({ total_buy_ins: nextBuyIns })
      .eq("id", player.id)
      .eq("total_buy_ins", player.total_buy_ins)
      .select("id,name,total_buy_ins,final_chips,created_at")
      .single();

    if (error || !data) {
      await refreshPlayers();
      setErrorMessage("buy-in changed. try once more.");
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
      <section className="mx-auto w-full max-w-5xl">
        <nav className="flex items-center justify-between gap-4 border-b border-[var(--line)] pb-5 font-mono text-xs uppercase tracking-[0.18em] text-[var(--ink-soft)]">
          <Link href="/" className="transition hover:text-[var(--terracotta)]">
            pokerbook
          </Link>
          <span className="text-[var(--table-green)]">
            {loadingState === "ready" ? "active" : "loading"}
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
                  {"\u2660"} active session
                </p>
                <h1 className="mt-4 text-5xl font-semibold leading-none tracking-normal sm:text-7xl">
                  {session.name || "poker night."}
                </h1>
                <p className="mt-5 max-w-2xl text-base leading-7 text-[var(--ink-soft)] sm:text-lg">
                  Tap once when someone re-buys. Everyone starts with one
                  buy-in.
                </p>
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
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:min-w-[460px]">
                <Stat label="buy-in" value={formatCurrency(session.buy_in_amount)} />
                <Stat label="total buy-ins" value={String(totalBuyIns)} />
                <Stat label="table bank" value={formatCurrency(tableBank)} />
              </div>
            </header>

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
                      <button
                        type="button"
                        onClick={() => addBuyIn(player)}
                        disabled={Boolean(pendingPlayerId)}
                        className="h-11 border border-[var(--table-green)] px-4 font-mono text-xs uppercase tracking-[0.12em] text-[var(--table-green)] transition enabled:hover:bg-[var(--table-green)] enabled:hover:text-background disabled:cursor-wait disabled:opacity-50"
                      >
                        {isPending ? "adding..." : "+1 buy-in."}
                      </button>
                    </div>
                  </article>
                );
              })}
              {/* Ghost tile — add player */}
              {players.length >= MAX_PLAYERS ? (
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
              )}
            </div>

            <div className="mt-8 border-t border-[var(--line)] pt-6">
              <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
                <p className="max-w-xl text-sm leading-6 text-[var(--ink-soft)]">
                  Done with the last hand? Enter final chips before closing the
                  table.
                </p>
                <Link
                  href={`/session/${sessionId}/end`}
                  className="inline-flex h-12 items-center justify-center border border-[var(--terracotta)] px-5 font-mono text-xs uppercase tracking-[0.12em] text-[var(--terracotta)] transition hover:bg-[var(--terracotta)] hover:text-background"
                >
                  end session.
                </Link>
              </div>
            </div>
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
