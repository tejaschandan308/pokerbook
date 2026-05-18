const SUITS = ["♠", "♥", "♦", "♣"] as const;
const SUIT_COLORS = [
  "var(--ink)",
  "var(--red)",
  "var(--red)",
  "var(--ink)",
] as const;

interface SuitRowProps {
  size?: number;
  gap?: number;
  muted?: boolean;
}

export function SuitRow({ size = 11, gap = 6, muted = false }: SuitRowProps) {
  return (
    <span
      style={{
        display: "inline-flex",
        gap,
        alignItems: "center",
        opacity: muted ? 0.55 : 1,
      }}
    >
      {SUITS.map((s, i) => (
        <span
          key={s}
          style={{
            fontFamily: "var(--font-instrument-serif), serif",
            fontSize: size,
            lineHeight: 1,
            color: SUIT_COLORS[i],
          }}
        >
          {s}
        </span>
      ))}
    </span>
  );
}
