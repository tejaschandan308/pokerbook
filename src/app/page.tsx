"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { AppHeader } from "@/components/ui/app-header";
import { Eyebrow } from "@/components/ui/eyebrow";
import { SuitRow } from "@/components/ui/suit-row";

/* ─── Animation variants ─────────────────────────────────────────────────── */

const ease = [0.2, 0.7, 0.2, 1] as const;

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease },
  },
};

const heroContainer = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.09, delayChildren: 0.08 },
  },
};

const statFade = {
  hidden: { opacity: 0, x: 16 },
  show: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.5, ease },
  },
};

const statsContainer = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.1, delayChildren: 0.35 },
  },
};

/* ─── Sub-components ─────────────────────────────────────────────────────── */

function HomeStat({ label, value }: { label: string; value: string }) {
  return (
    <motion.div
      variants={statFade}
      style={{
        borderTop: "1px solid var(--rule)",
        paddingTop: 14,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
      }}
    >
      <div
        style={{
          fontFamily:
            "var(--font-jetbrains-mono), ui-monospace, monospace",
          fontSize: 10,
          fontWeight: 500,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "var(--ink-mute)",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "var(--font-instrument-serif), serif",
          fontSize: 44,
          lineHeight: 1,
          color: "var(--ink)",
          fontWeight: 400,
        }}
      >
        {value}
      </div>
    </motion.div>
  );
}

/* ─── Page ───────────────────────────────────────────────────────────────── */

export default function Home() {
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
          padding: "0 24px 64px",
        }}
        className="sm:px-10 lg:px-12"
      >
        <AppHeader />

        {/* Hero — 1-col mobile, 2-col desktop */}
        <div className="home-hero">
          {/* ── Left: copy ── */}
          <motion.div
            variants={heroContainer}
            initial="hidden"
            animate="show"
            style={{ display: "flex", flexDirection: "column" }}
          >
            <motion.div variants={fadeUp}>
              <Eyebrow>Home Poker Ledger</Eyebrow>
            </motion.div>

            <motion.h1
              variants={fadeUp}
              style={{
                fontFamily: "var(--font-instrument-serif), serif",
                fontSize: "clamp(64px, 13vw, 168px)",
                lineHeight: 0.9,
                margin: "20px 0 4px",
                letterSpacing: "-0.03em",
                fontWeight: 400,
                color: "var(--ink)",
              }}
            >
              pokerbook
              <span style={{ color: "var(--terra)" }}>.</span>
            </motion.h1>

            <motion.div
              variants={fadeUp}
              style={{
                fontFamily: "var(--font-instrument-serif), serif",
                fontSize: "clamp(30px, 5.5vw, 72px)",
                lineHeight: 1.0,
                margin: "24px 0 0",
                color: "var(--ink)",
              }}
            >
              <span style={{ fontStyle: "italic", color: "var(--terra)" }}>
                settle the night,
              </span>
              <br />
              <span>not the math.</span>
            </motion.div>

            <motion.p
              variants={fadeUp}
              style={{
                fontFamily:
                  "var(--font-geist-sans), system-ui, sans-serif",
                fontSize: 18,
                lineHeight: 1.55,
                color: "var(--ink-soft)",
                margin: "36px 0 36px",
                maxWidth: 460,
              }}
            >
              Track who bought in. Keep the table honest. Leave the
              calculator out of it.
            </motion.p>

            <motion.div variants={fadeUp}>
              <Link href="/new" className="btn-primary">
                New Session
                <span style={{ opacity: 0.5 }}>.</span>
              </Link>
            </motion.div>
          </motion.div>

          {/* ── Right: stats ── */}
          <motion.div
            variants={statsContainer}
            initial="hidden"
            animate="show"
            style={{ display: "flex", flexDirection: "column", gap: 18 }}
          >
            <HomeStat label="Rounds till sunrise" value="∞" />
            <HomeStat label="Awkward math fights" value="0" />
            <HomeStat label="Apps you need installed" value="0" />

            <motion.div
              variants={statFade}
              style={{ marginTop: 12 }}
            >
              <SuitRow size={28} gap={18} />
            </motion.div>
          </motion.div>
        </div>
      </div>
    </main>
  );
}
