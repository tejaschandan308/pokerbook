"use client";

import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const MIN_PLAYERS = 2;
const MAX_PLAYERS = 10;

type FormErrors = {
  buyInAmount?: string;
  players?: string;
  submit?: string;
};

export function NewSessionForm() {
  const router = useRouter();
  const [buyInAmount, setBuyInAmount] = useState("500");
  const [sessionName, setSessionName] = useState("");
  const [players, setPlayers] = useState(["", ""]);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canAddPlayer = players.length < MAX_PLAYERS;

  const filledPlayerCount = useMemo(
    () => players.filter((player) => player.trim()).length,
    [players],
  );

  function updatePlayerName(index: number, value: string) {
    setPlayers((currentPlayers) =>
      currentPlayers.map((player, playerIndex) =>
        playerIndex === index ? value : player,
      ),
    );
  }

  function addPlayer() {
    if (!canAddPlayer) {
      return;
    }

    setPlayers((currentPlayers) => [...currentPlayers, ""]);
  }

  function removePlayer(index: number) {
    if (players.length <= MIN_PLAYERS) {
      return;
    }

    setPlayers((currentPlayers) =>
      currentPlayers.filter((_, playerIndex) => playerIndex !== index),
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setErrors({});

    const parsedBuyIn = Number(buyInAmount);
    const trimmedPlayers = players.map((player) => player.trim());
    const nextErrors: FormErrors = {};

    if (!Number.isInteger(parsedBuyIn) || parsedBuyIn <= 0) {
      nextErrors.buyInAmount = "buy-in has to be positive.";
    }

    if (trimmedPlayers.length < MIN_PLAYERS) {
      nextErrors.players = "needs at least 2 players.";
    } else if (trimmedPlayers.some((player) => player.length === 0)) {
      nextErrors.players = "every player needs a name.";
    }

    if (!supabase) {
      nextErrors.submit = "supabase keys are missing.";
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setIsSubmitting(true);

    const { data: session, error: sessionError } = await supabase!
      .from("sessions")
      .insert({
        name: sessionName.trim() || null,
        buy_in_amount: parsedBuyIn,
      })
      .select("id")
      .single();

    if (sessionError || !session) {
      setErrors({ submit: "couldn't create the session." });
      setIsSubmitting(false);
      return;
    }

    const { error: playersError } = await supabase!.from("players").insert(
      trimmedPlayers.map((name) => ({
        session_id: session.id,
        name,
        total_buy_ins: 1,
      })),
    );

    if (playersError) {
      await supabase!.from("sessions").delete().eq("id", session.id);
      setErrors({ submit: "couldn't add the players." });
      setIsSubmitting(false);
      return;
    }

    router.push(`/session/${session.id}`);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="min-w-0 border border-[var(--line)] bg-[#fffaf0] p-5 shadow-[0_18px_60px_rgba(36,25,19,0.08)] sm:p-7"
    >
      <div className="space-y-5">
        <div>
          <label
            htmlFor="buy-in-amount"
            className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--ink-soft)]"
          >
            buy-in amount
          </label>
          <div className="mt-2 flex h-12 items-center border border-[var(--line)] bg-background px-3 focus-within:border-[var(--terracotta)]">
            <span className="pr-2 font-mono text-sm text-[var(--ink-soft)]">
              {"\u20B9"}
            </span>
            <input
              id="buy-in-amount"
              name="buy-in-amount"
              inputMode="numeric"
              min="1"
              step="1"
              type="number"
              value={buyInAmount}
              onChange={(event) => setBuyInAmount(event.target.value)}
              className="h-full w-full bg-transparent text-base outline-none"
            />
          </div>
          {errors.buyInAmount ? (
            <p className="mt-2 text-sm text-[var(--terracotta)]">
              {errors.buyInAmount}
            </p>
          ) : null}
        </div>

        <div>
          <label
            htmlFor="session-name"
            className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--ink-soft)]"
          >
            session name (optional)
          </label>
          <input
            id="session-name"
            name="session-name"
            type="text"
            value={sessionName}
            onChange={(event) => setSessionName(event.target.value)}
            placeholder="Saturday at Aman's"
            className="mt-2 h-12 w-full border border-[var(--line)] bg-background px-3 text-base outline-none transition placeholder:text-[var(--ink-soft)]/55 focus:border-[var(--terracotta)]"
          />
        </div>

        <div>
          <div className="flex items-center justify-between gap-3">
            <label className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--ink-soft)]">
              players
            </label>
            <span className="font-mono text-xs text-[var(--ink-soft)]">
              {filledPlayerCount}/{players.length} named
            </span>
          </div>

          <div className="mt-3 space-y-3">
            {players.map((player, index) => (
              <div
                key={index}
                className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-[1fr_104px]"
              >
                <input
                  aria-label={`player ${index + 1} name`}
                  type="text"
                  value={player}
                  onChange={(event) =>
                    updatePlayerName(index, event.target.value)
                  }
                  placeholder={`player ${index + 1}`}
                  className="h-12 min-w-0 border border-[var(--line)] bg-background px-3 text-base outline-none transition placeholder:text-[var(--ink-soft)]/55 focus:border-[var(--terracotta)]"
                />
                <button
                  type="button"
                  onClick={() => removePlayer(index)}
                  disabled={players.length <= MIN_PLAYERS}
                  className="h-12 w-full border border-[var(--line)] px-3 font-mono text-xs uppercase tracking-[0.12em] text-[var(--ink-soft)] transition enabled:hover:border-[var(--terracotta)] enabled:hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                >
                  remove
                </button>
              </div>
            ))}
          </div>

          {errors.players ? (
            <p className="mt-2 text-sm text-[var(--terracotta)]">
              {errors.players}
            </p>
          ) : null}

          <button
            type="button"
            onClick={addPlayer}
            disabled={!canAddPlayer}
            className="mt-4 h-11 w-full border border-[var(--table-green)] px-4 font-mono text-xs uppercase tracking-[0.12em] text-[var(--table-green)] transition enabled:hover:bg-[var(--table-green)] enabled:hover:text-background disabled:cursor-not-allowed disabled:opacity-40"
          >
            add player.
          </button>
        </div>
      </div>

      {errors.submit ? (
        <p className="mt-5 text-sm text-[var(--terracotta)]">
          {errors.submit}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-6 h-12 w-full border border-foreground bg-foreground px-5 font-mono text-sm uppercase tracking-[0.12em] text-background transition enabled:hover:bg-[var(--terracotta)] disabled:cursor-wait disabled:opacity-60"
      >
        {isSubmitting ? "starting..." : "start session."}
      </button>
    </form>
  );
}
