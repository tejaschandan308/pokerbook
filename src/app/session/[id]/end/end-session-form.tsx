"use client";

import type { FormEvent } from "react";
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

  const totalBuyIns = useMemo(
    () =>
      players.reduce((sum, player) => {
        const parsedBuyIns = Number(player.buyIns);
        return Number.isInteger(parsedBuyIns) ? sum + parsedBuyIns : sum;
      }, 0),
    [players],
  );

  const tableBank = session ? totalBuyIns * session.buy_in_amount : 0;

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

    for (const player of players) {
      const { error } = await supabase
        .from("players")
        .update({
          final_chips: Number(player.finalChips),
          total_buy_ins: Number(player.buyIns),
        })
        .eq("id", player.id)
        .eq("session_id", sessionId);

      if (error) {
        setSubmitError("couldn't save the chip counts.");
        setIsSaving(false);
        return;
      }
    }

    const { error: sessionError } = await supabase
      .from("sessions")
      .update({ status: "ended" })
      .eq("id", sessionId);

    if (sessionError) {
      setSubmitError("couldn't end the session.");
      setIsSaving(false);
      return;
    }

    router.push(`/session/${sessionId}/summary`);
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-background px-5 py-6 text-foreground sm:px-10 sm:py-8">
      <section className="mx-auto w-full max-w-5xl">
        <nav className="flex items-center justify-between gap-4 border-b border-[var(--line)] pb-5 font-mono text-xs uppercase tracking-[0.18em] text-[var(--ink-soft)]">
          <Link href="/" className="transition hover:text-[var(--terracotta)]">
            pokerbook
          </Link>
          <span className="text-[var(--terracotta)]">end session</span>
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
          <form noValidate onSubmit={handleSubmit} className="py-8 sm:py-12">
            <header className="grid gap-6 border-b border-[var(--line)] pb-8 lg:grid-cols-[1fr_auto] lg:items-end">
              <div>
                <p className="font-mono text-sm uppercase tracking-[0.18em] text-[var(--terracotta)]">
                  {"\u2666"} final count
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
                            {"\u20B9"}
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

            <div className="mt-8 grid gap-3 border-t border-[var(--line)] pt-6 sm:grid-cols-[1fr_auto] sm:items-center">
              <Link
                href={`/session/${sessionId}`}
                className="inline-flex h-12 items-center justify-center border border-[var(--line)] px-5 font-mono text-xs uppercase tracking-[0.12em] text-[var(--ink-soft)] transition hover:border-[var(--terracotta)] hover:text-foreground"
              >
                cancel
              </Link>
              <button
                type="submit"
                disabled={isSaving}
                className="h-12 border border-foreground bg-foreground px-5 font-mono text-xs uppercase tracking-[0.12em] text-background transition enabled:hover:bg-[var(--terracotta)] disabled:cursor-wait disabled:opacity-60"
              >
                {isSaving ? "saving..." : "save & end session."}
              </button>
            </div>
          </form>
        ) : null}
      </section>
    </main>
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
