import Link from "next/link";
import { SuitRow } from "@/components/ui/suit-row";
import { NewSessionForm } from "./new-session-form";

export default function NewSessionPage() {
  return (
    <main
      style={{
        background: "var(--bg)",
        color: "var(--ink)",
        minHeight: "100vh",
        position: "relative",
      }}
    >
      {/* felt table ambient gradient */}
      <div className="felt-motif" />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          maxWidth: 1000,
          margin: "0 auto",
          padding: "0 24px 80px",
        }}
        className="sm:px-10 lg:px-12"
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
                fontFamily:
                  "var(--font-jetbrains-mono), ui-monospace, monospace",
                fontSize: 12,
                fontWeight: 500,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
              }}
            >
              pokerbook
            </Link>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <span
                style={{
                  fontFamily:
                    "var(--font-jetbrains-mono), ui-monospace, monospace",
                  fontSize: 11,
                  fontWeight: 500,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  color: "var(--felt)",
                }}
              >
                New Session
              </span>
              <SuitRow size={11} />
            </div>
          </div>
          <div
            style={{ borderTop: "1px solid var(--rule)", marginTop: 12 }}
          />
        </div>

        {/* ── Two-column grid ── */}
        <div className="grid gap-8 py-8 sm:py-12 lg:grid-cols-[0.85fr_1.15fr]">
          {/* Left: page header copy */}
          <header>
            <div
              style={{
                fontFamily:
                  "var(--font-jetbrains-mono), ui-monospace, monospace",
                fontSize: 11,
                fontWeight: 500,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: "var(--terra)",
              }}
            >
              ♣ table setup
            </div>

            <div style={{ marginTop: 14 }}>
              <div
                style={{
                  fontFamily: "var(--font-instrument-serif), serif",
                  fontSize: "clamp(48px, 8vw, 96px)",
                  lineHeight: 0.95,
                  letterSpacing: "-0.02em",
                  fontWeight: 400,
                  color: "var(--ink)",
                }}
              >
                new
              </div>
              <div
                style={{
                  fontFamily: "var(--font-instrument-serif), serif",
                  fontStyle: "italic",
                  fontSize: "clamp(48px, 8vw, 96px)",
                  lineHeight: 0.95,
                  letterSpacing: "-0.02em",
                  fontWeight: 400,
                  color: "var(--terra)",
                }}
              >
                session.
              </div>
            </div>

            <p
              style={{
                fontSize: 15,
                lineHeight: 1.6,
                color: "var(--ink-soft)",
                marginTop: 24,
                maxWidth: 340,
              }}
            >
              Set the buy-in, add the names, and get everyone into the same
              ledger before the first hand.
            </p>
          </header>

          {/* Right: form — left border on desktop */}
          <div className="lg:border-l lg:border-[var(--rule)] lg:pl-12">
            <NewSessionForm />
          </div>
        </div>
      </div>
    </main>
  );
}
