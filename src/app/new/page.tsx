import Link from "next/link";
import { NewSessionForm } from "./new-session-form";

export default function NewSessionPage() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-background px-5 py-6 text-foreground sm:px-10 sm:py-8">
      <section className="mx-auto w-full min-w-0 max-w-4xl">
        <nav className="flex items-center justify-between gap-4 border-b border-[var(--line)] pb-5 font-mono text-xs uppercase tracking-[0.18em] text-[var(--ink-soft)]">
          <Link href="/" className="transition hover:text-[var(--terracotta)]">
            pokerbook
          </Link>
          <span className="text-[var(--table-green)]">new session</span>
        </nav>

        <div className="grid min-w-0 gap-8 py-10 sm:py-14 lg:grid-cols-[0.85fr_1.15fr]">
          <header className="min-w-0">
            <p className="font-mono text-sm uppercase tracking-[0.18em] text-[var(--terracotta)]">
              {"\u2663"} table setup
            </p>
            <h1 className="mt-5 text-5xl font-semibold leading-none tracking-normal sm:text-6xl">
              new{" "}
              <span className="font-serif italic text-[var(--terracotta)]">
                session.
              </span>
            </h1>
            <p className="mt-6 max-w-md text-base leading-7 text-[var(--ink-soft)] sm:text-lg">
              Set the buy-in, add the names, and get everyone into the same
              ledger before the first hand.
            </p>
          </header>

          <NewSessionForm />
        </div>
      </section>
    </main>
  );
}
