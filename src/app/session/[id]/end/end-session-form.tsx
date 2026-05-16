"use client";

import type { FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getStoredPin } from "@/lib/pin-auth";

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

      if (!isMounted) {
        return;
      }

      if (sessionError || !sessionData) {
        setLoadingState("missing");
        return;
      }

      // Check PIN requirement and redirect if not authenticated
      const { data: hasPinData } = await supabase.rpc("session_has_pin", {
        p_session_id: sessionId,
      });

      if (!isMounted) {
        return;
      }

      if (hasPinData) {
        const storedPin = getStoredPin(sessionId);
        if (!storedPin) {
          // Not authenticated — redirect to the right place
          if (sessionData.status === "ended") {
            router.replace(`/session/${sessionId}/summary`);
          } else {
            router.replace(`/session/${sessionId}`);
          }
          return;
        }
      }

      // Everyone who reaches here has edit access (PIN verified or no PIN required)
      if (isMounted) setIsHost(true);

      if (sessionData.status === "ended") {
        setIsEditing(true);
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
    // visualViewport unsupported (old browsers) → leave isKeyboardOpen false so the bar is always visible.
    if (typeof window === "undefined" || !window.visualViewport) return;

    const viewport = window.visualViewport;
    const initialHeight = viewport.height;

    function handleResize() {
      // A shrink of >150px reliably signals a virtual keyboard; browser toolbars are <100px.
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase || isSaving) {
      return;
    }

    setSubmitError("");

    if (!validatePlayers()) {
      return;
    }

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
      <main className="min-h-screen overflow-x-hidden bg-background px-5 py-6 text-foreground sm:px-10 sm:py-8">
        <section className="mx-auto w-full max-w-5xl">
          <nav className="flex items-center justify-between gap-4 border-b border-[var(--line)] pb-5 font-mono text-xs uppercase tracking-[0.18em] text-[var(--ink-soft)]">
            <Link href="/" className="transition hover:text-[var(--terracotta)]">
              pokerbook
            </Link>
            <span className="text-[var(--terracotta)]">
              {isEditing ? "edit values" : "end session"}
            </span>
          </nav>

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
              className="py-8 sm:py-12"
            >
              <header className="grid gap-6 border-b border-[var(--line)] pb-8 lg:grid-cols-[1fr_auto] lg:items-end">
                <div>
                  <p className="font-mono text-sm uppercase tracking-[0.18em] text-[var(--terracotta)]">
                    {"♦"} {isEditing ? "edit values" : "final count"}
                  </p>
                  <h1 className="mt-4 text-5xl font-semibold leading-none tracking-normal sm:text-7xl">
                    {session.name || "poker night."}
                  </h1>
                  <p className="mt-5 max-w-2xl text-base leading-7 text-[var(--ink-soft)] sm:text-lg">
                    Adjust buy-ins if the table memory was off. Then enter final
                    chips in rupees.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:min-w-[460px]">
                  <Stat label="buy-in" value={formatCurrency(session.buy_in_amount)} />
                  <Stat label="buy-ins" value={String(totalBuyIns)} />
                  <Stat label="table bank" value={formatCurrency(tableBank)} />
                </div>
              </header>

              <div className="mt-6 space-y-4">
                {players.map((player) => {
                  const buyIns = Number(player.buyIns);
                  const playerInFor =
                    Number.isInteger(buyIns) && buyIns > 0
                      ? buyIns * session.buy_in_amount
                      : 0;
                  const errors = fieldErrors[player.id] || {};

                  return (
                    <article
                      key={player.id}
                      className="border border-[var(--line)] bg-[#fffaf0] p-5 shadow-[0_18px_60px_rgba(36,25,19,0.07)]"
                    >
                      <div className="grid gap-4 lg:grid-cols-[1fr_160px_220px] lg:items-start">
                        <div className="min-w-0">
                          <h2 className="truncate text-2xl font-semibold leading-tight">
                            {player.name}
                          </h2>
                          <p className="mt-2 font-mono text-xs uppercase tracking-[0.16em] text-[var(--ink-soft)]">
                            in for {formatCurrency(playerInFor)}
                          </p>
                        </div>

                        <div>
                          <label
                            htmlFor={`buy-ins-${player.id}`}
                            className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--ink-soft)]"
                          >
                            buy-ins.
                          </label>
                          <input
                            id={`buy-ins-${player.id}`}
                            inputMode="numeric"
                            min="1"
                            step="1"
                            type="number"
                            value={player.buyIns}
                            onChange={(event) =>
                              updatePlayerField(
                                player.id,
                                "buyIns",
                                event.target.value,
                              )
                            }
                            className="mt-2 h-12 w-full border border-[var(--line)] bg-background px-3 text-base outline-none transition focus:border-[var(--terracotta)]"
                          />
                          {errors.buyIns ? (
                            <p className="mt-2 text-sm text-[var(--terracotta)]">
                              {errors.buyIns}
                            </p>
                          ) : null}
                        </div>

                        <div>
                          <label
                            htmlFor={`final-chips-${player.id}`}
                            className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--ink-soft)]"
                          >
                            final chips.
                          </label>
                          <div className="mt-2 flex h-12 items-center border border-[var(--line)] bg-background px-3 focus-within:border-[var(--terracotta)]">
                            <span className="pr-2 font-mono text-sm text-[var(--ink-soft)]">
                              {"₹"}
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
                              className="h-full w-full min-w-0 bg-transparent text-base outline-none"
                            />
                          </div>
                          {errors.finalChips ? (
                            <p className="mt-2 text-sm text-[var(--terracotta)]">
                              {errors.finalChips}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>

              {submitError ? (
                <p className="mt-5 border border-[var(--terracotta)] bg-[#fffaf0] p-3 text-sm text-[var(--terracotta)]">
                  {submitError}
                </p>
              ) : null}

              <div className="mt-8 border-t border-[var(--line)] pt-6">
                <Link
                  href={
                    isEditing
                      ? `/session/${sessionId}/summary`
                      : `/session/${sessionId}`
                  }
                  className="inline-flex h-10 items-center border border-[var(--line)] px-5 font-mono text-xs uppercase tracking-[0.12em] text-[var(--ink-soft)] transition hover:border-[var(--terracotta)] hover:text-foreground"
                >
                  cancel
                </Link>
              </div>

              {/* Spacer so the last input isn't hidden behind the sticky bar */}
              <div aria-hidden="true" className="h-48 lg:h-20" />
            </form>
          ) : null}
        </section>
      </main>

      {/* Sticky delta bar — fixed to bottom, outside <main> to avoid overflow clipping.
          Hidden while any input is focused so the mobile keyboard doesn't push it into the content. */}
      {loadingState === "ready" && session && delta !== null && !isKeyboardOpen ? (
        <div className="fixed bottom-0 left-0 right-0 z-10 border-t border-[var(--line)] bg-[#fffaf0] shadow-[0_-4px_20px_rgba(36,25,19,0.08)]">
          <div className="mx-auto max-w-5xl px-5 sm:px-10">
            <div className="flex flex-col gap-3 py-3 lg:flex-row lg:items-center lg:justify-between lg:gap-6 lg:py-4">
              <div className="min-w-0 flex-1 text-center lg:text-left">
                {delta === 0 ? (
                  <p className="font-mono text-xs uppercase tracking-[0.16em] text-green-700">
                    ✓ chip counts match
                  </p>
                ) : tableBank > 0 && Math.abs(delta) / tableBank > 0.5 ? (
                  <p className="text-sm leading-5 text-[var(--terracotta)]">
                    Delta is too large to divide. Recount and edit buy-ins above.
                  </p>
                ) : (
                  <>
                    {/* Condensed on mobile */}
                    <p className="text-sm leading-5 text-[var(--terracotta)] lg:hidden">
                      {delta > 0
                        ? `Over by ${formatCurrency(Math.abs(delta))} (${formatCurrency(totalFinalChips)} / ${formatCurrency(tableBank)})`
                        : `Short by ${formatCurrency(Math.abs(delta))} (${formatCurrency(totalFinalChips)} / ${formatCurrency(tableBank)})`}
                    </p>
                    {/* Full on desktop */}
                    <p className="hidden text-sm leading-5 text-[var(--terracotta)] lg:block">
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
                    <button
                      type="submit"
                      form="end-session-form"
                      disabled={isSaving}
                      className="h-11 w-full border border-foreground bg-foreground px-4 font-mono text-xs uppercase tracking-[0.12em] text-background transition enabled:hover:bg-[var(--terracotta)] disabled:cursor-wait disabled:opacity-60 lg:h-10 lg:w-auto"
                    >
                      {isSaving
                        ? "saving..."
                        : isEditing
                          ? "save changes."
                          : "save & end session."}
                    </button>
                  ) : tableBank > 0 && Math.abs(delta) / tableBank <= 0.5 ? (
                    <button
                      type="button"
                      onClick={handleDivideEqually}
                      className="h-11 w-full border border-[var(--line)] px-4 font-mono text-xs uppercase tracking-[0.12em] text-[var(--ink-soft)] transition hover:border-[var(--terracotta)] hover:text-foreground lg:h-10 lg:w-auto"
                    >
                      divide {formatCurrency(Math.abs(delta))} equally
                    </button>
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
