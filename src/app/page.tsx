import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-background px-6 py-8 text-foreground sm:px-10">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-5xl flex-col justify-between">
        <nav className="flex items-center justify-between border-b border-[var(--line)] pb-5 font-mono text-xs uppercase tracking-[0.18em] text-[var(--ink-soft)]">
          <span>pokerbook</span>
          <span className="text-[var(--table-green)]">session tools</span>
        </nav>

        <div className="max-w-3xl py-20">
          <p className="font-mono text-sm uppercase tracking-[0.18em] text-[var(--terracotta)]">
            home poker math
          </p>
          <h1 className="mt-5 text-5xl font-semibold leading-[0.98] tracking-normal sm:text-7xl">
            buy-ins tracked.{" "}
            <span className="font-serif italic text-[var(--terracotta)]">
              settle up clean.
            </span>
          </h1>
          <p className="mt-7 max-w-2xl text-lg leading-8 text-[var(--ink-soft)]">
            A small cash-game ledger for nights where the chips move faster than
            the notes app.
          </p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/new"
              className="inline-flex h-12 items-center justify-center border border-foreground bg-foreground px-6 font-mono text-sm uppercase tracking-[0.12em] text-background transition hover:bg-[var(--terracotta)]"
            >
              new session
            </Link>
            <Link
              href="/session/demo"
              className="inline-flex h-12 items-center justify-center border border-[var(--line)] px-6 font-mono text-sm uppercase tracking-[0.12em] text-foreground transition hover:border-[var(--terracotta)]"
            >
              route preview
            </Link>
          </div>
        </div>

        <footer className="grid gap-3 border-t border-[var(--line)] pt-5 font-mono text-xs uppercase tracking-[0.18em] text-[var(--ink-soft)] sm:grid-cols-3">
          <span>no accounts</span>
          <span>cash games only</span>
          <span>v1 scaffold</span>
        </footer>
      </section>
    </main>
  );
}
