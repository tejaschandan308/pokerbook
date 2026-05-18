import type { ReactNode } from "react";
import { SuitRow } from "./suit-row";

interface AppHeaderProps {
  right?: ReactNode;
}

export function AppHeader({ right }: AppHeaderProps) {
  return (
    <div style={{ paddingTop: 14, paddingBottom: 16 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div
          style={{
            fontFamily:
              "var(--font-jetbrains-mono), ui-monospace, monospace",
            fontSize: 12,
            fontWeight: 500,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: "var(--ink)",
          }}
        >
          pokerbook
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {right}
          <SuitRow size={11} />
        </div>
      </div>
      <div
        style={{ borderTop: "1px solid var(--rule)", marginTop: 12 }}
      />
    </div>
  );
}
