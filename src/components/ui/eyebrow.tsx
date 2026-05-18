import type { CSSProperties, ReactNode } from "react";

interface EyebrowProps {
  children: ReactNode;
  soft?: boolean;
  style?: CSSProperties;
}

export function Eyebrow({ children, soft = false, style }: EyebrowProps) {
  return (
    <div
      style={{
        fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace",
        fontSize: soft ? 10 : 11,
        fontWeight: 500,
        letterSpacing: soft ? "0.18em" : "0.16em",
        textTransform: "uppercase",
        color: soft ? "var(--ink-mute)" : "var(--terra)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
