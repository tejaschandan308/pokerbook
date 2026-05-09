import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-background px-6 py-8 text-foreground sm:px-10">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-5xl flex-col justify-between">
        <nav className="flex items-center justify-between border-b border-[var(--line)] pb-5 font-mono text-xs uppercase tracking-[0.18em] text-[var(--ink-soft)]">
          <span>pokerbook</span>
          <span className="text-[var(--table-green)]">
            {"\u2660 \u2665 \u2666 \u2663"}
          </span>
        </nav>

        <div className="max-w-3xl py-16 sm:py-24">
          <p className="font-mono text-sm uppercase tracking-[0.18em] text-[var(--terracotta)]">
            home poker ledger
          </p>
          <h1 className="mt-5 text-6xl font-semibold leading-[0.95] tracking-normal sm:text-8xl">
            pokerbook.
          </h1>
          <p className="mt-6 max-w-2xl text-3xl leading-tight text-foreground sm:text-5xl">
            <span className="font-serif italic text-[var(--terracotta)]">
              settle the night,
            </span>
            <br />
            not the math.
          </p>
          <p className="mt-7 max-w-xl text-lg leading-8 text-[var(--ink-soft)]">
            Track who bought in. Keep the table honest. Leave the calculator
            out of it.
          </p>
          <div className="mt-10">
            <Link
              href="/new"
              className="inline-flex h-12 w-full items-center justify-center border border-foreground bg-foreground px-6 font-mono text-sm uppercase tracking-[0.12em] text-background transition hover:bg-[var(--terracotta)] sm:w-auto"
            >
              new session.
            </Link>
          </div>
        </div>

        <footer className="grid gap-3 border-t border-[var(--line)] pt-5 font-mono text-xs uppercase tracking-[0.18em] text-[var(--ink-soft)] sm:grid-cols-3">
          <span>no accounts</span>
          <span className="text-[var(--table-green)]">cash games only</span>
          <span>minimum drama</span>
        </footer>
      </section>
    </main>
  );
}
