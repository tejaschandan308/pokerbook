"use client";

import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { storePin } from "@/lib/pin-auth";
import { generateSessionCode } from "@/lib/session-links";

const MIN_PLAYERS = 2;
const MAX_PLAYERS = 10;
const SESSION_CODE_ATTEMPTS = 5;

type FormErrors = {
  buyInAmount?: string;
  pin?: string;
  players?: string;
  submit?: string;
};

type CreatedSession = {
  id: string;
  pin: string;
};

/* ─── Shared style constants ─────────────────────────────────────────────── */

const labelStyle =
  "font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--ink-mute)]";

const inputStyle =
  "h-12 w-full border border-[var(--rule)] bg-[var(--bg-elev)] px-3 text-base text-[var(--ink)] outline-none transition placeholder:text-[var(--ink-mute)]/60 focus:border-[var(--ink)]";

const errorStyle = "mt-2 text-sm text-[var(--terra)]";

/* ─── Component ──────────────────────────────────────────────────────────── */

export function NewSessionForm() {
  const router = useRouter();
  const [buyInAmount, setBuyInAmount] = useState("500");
  const [sessionName, setSessionName] = useState("");
  const [pin, setPin] = useState("");
  const [players, setPlayers] = useState(["", ""]);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdSession, setCreatedSession] = useState<CreatedSession | null>(
    null,
  );

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

  function updatePin(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 4);
    setPin(digits);
    if (errors.pin) {
      setErrors((e) => ({ ...e, pin: undefined }));
    }
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

    if (pin.length !== 4) {
      nextErrors.pin = "PIN must be exactly 4 digits.";
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

    let session: { id: string } | null = null;
    let sessionError: { code?: string } | null = null;

    for (let attempt = 0; attempt < SESSION_CODE_ATTEMPTS; attempt += 1) {
      const { data, error } = await supabase!
        .from("sessions")
        .insert({
          name: sessionName.trim() || null,
          buy_in_amount: parsedBuyIn,
          host_pin: pin,
          short_code: generateSessionCode(),
        })
        .select("id")
        .single();

      if (!error && data) {
        session = data;
        sessionError = null;
        break;
      }

      sessionError = error;

      if (error?.code !== "23505") {
        break;
      }
    }

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

    setCreatedSession({ id: session.id, pin });
  }

  /* ── Session created — PIN reveal ── */
  if (createdSession) {
    return (
      <div className="min-w-0">
        <p className={labelStyle} style={{ color: "var(--felt)" }}>
          session created.
        </p>

        <h2
          style={{
            fontFamily: "var(--font-instrument-serif), serif",
            fontSize: 28,
            fontWeight: 400,
            color: "var(--ink)",
            marginTop: 16,
            letterSpacing: "-0.01em",
          }}
        >
          your host PIN.
        </h2>

        <div
          className="mt-5 flex items-center justify-center border border-[var(--rule)] bg-[var(--bg-card)] py-7"
        >
          <span
            className="tnum"
            style={{
              fontFamily:
                "var(--font-jetbrains-mono), ui-monospace, monospace",
              fontSize: 48,
              fontWeight: 500,
              letterSpacing: "0.4em",
              color: "var(--ink)",
            }}
          >
            {createdSession.pin}
          </span>
        </div>

        <p
          className="mt-4 text-sm leading-6"
          style={{ color: "var(--ink-soft)" }}
        >
          Share this PIN with anyone you want to give edit access. Anyone
          without the PIN can view but not edit.
        </p>

        <button
          type="button"
          onClick={() => {
            storePin(createdSession.id, createdSession.pin);
            router.push(`/session/${createdSession.id}`);
          }}
          className="btn-primary mt-6 w-full justify-center"
        >
          open session.
        </button>
      </div>
    );
  }

  /* ── New session form ── */
  return (
    <form onSubmit={handleSubmit} className="min-w-0">
      <div className="space-y-5">

        {/* Buy-in amount */}
        <div>
          <label htmlFor="buy-in-amount" className={labelStyle}>
            buy-in amount
          </label>
          <div
            className="mt-2 flex h-12 items-center border border-[var(--rule)] bg-[var(--bg-elev)] px-3 focus-within:border-[var(--ink)] transition"
          >
            <span
              className="pr-2 font-mono text-sm"
              style={{ color: "var(--ink-mute)" }}
            >
              {"₹"}
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
              className="h-full w-full bg-transparent text-base text-[var(--ink)] outline-none placeholder:text-[var(--ink-mute)]/60"
            />
          </div>
          {errors.buyInAmount ? (
            <p className={errorStyle}>{errors.buyInAmount}</p>
          ) : null}
        </div>

        {/* Session name */}
        <div>
          <label htmlFor="session-name" className={labelStyle}>
            session name (optional)
          </label>
          <input
            id="session-name"
            name="session-name"
            type="text"
            value={sessionName}
            onChange={(event) => setSessionName(event.target.value)}
            placeholder="Saturday at Aman's"
            className={`mt-2 ${inputStyle}`}
          />
        </div>

        {/* Host PIN */}
        <div>
          <label htmlFor="host-pin" className={labelStyle}>
            host PIN
          </label>
          <input
            id="host-pin"
            name="host-pin"
            type="text"
            inputMode="numeric"
            maxLength={4}
            pattern="[0-9]*"
            value={pin}
            onChange={(event) => updatePin(event.target.value)}
            placeholder="4-digit PIN"
            className={`mt-2 tracking-[0.2em] placeholder:tracking-normal ${inputStyle}`}
          />
          <p className={`mt-1 ${labelStyle}`}>
            share this with players you want to give edit access
          </p>
          {errors.pin ? <p className={errorStyle}>{errors.pin}</p> : null}
        </div>

        {/* Players */}
        <div>
          <div className="flex items-center justify-between gap-3">
            <label className={labelStyle}>players</label>
            <span className={`${labelStyle} tnum`}>
              {filledPlayerCount}/{players.length} named
            </span>
          </div>

          <div className="mt-3 space-y-3">
            {players.map((player, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  aria-label={`player ${index + 1} name`}
                  type="text"
                  value={player}
                  onChange={(event) =>
                    updatePlayerName(index, event.target.value)
                  }
                  placeholder={`player ${index + 1}`}
                  className={`min-w-0 flex-1 ${inputStyle}`}
                />
                <button
                  type="button"
                  onClick={() => removePlayer(index)}
                  disabled={players.length <= MIN_PLAYERS}
                  aria-label="remove player"
                  className="flex h-12 w-11 shrink-0 items-center justify-center text-[var(--ink-mute)] transition enabled:hover:text-[var(--terra)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 10 10"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    aria-hidden="true"
                  >
                    <path d="M1 1L9 9M9 1L1 9" />
                  </svg>
                </button>
              </div>
            ))}
          </div>

          {errors.players ? (
            <p className={errorStyle}>{errors.players}</p>
          ) : null}

          <button
            type="button"
            onClick={addPlayer}
            disabled={!canAddPlayer}
            className="mt-4 h-11 w-full border border-[var(--felt)] px-4 font-mono text-xs uppercase tracking-[0.12em] text-[var(--felt)] transition enabled:hover:bg-[var(--felt)] enabled:hover:text-[var(--bg)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            add player.
          </button>
        </div>
      </div>

      {errors.submit ? (
        <p className={errorStyle} style={{ marginTop: 20 }}>
          {errors.submit}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="btn-primary mt-6 w-full justify-center disabled:cursor-wait disabled:opacity-60"
      >
        {isSubmitting ? "starting..." : "start session."}
      </button>
    </form>
  );
}
