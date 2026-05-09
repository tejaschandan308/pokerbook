import Link from "next/link";

export default function NewSessionPage() {
  return (
    <main className="min-h-screen bg-background px-6 py-8 text-foreground sm:px-10">
      <section className="mx-auto w-full max-w-3xl">
        <Link
          href="/"
          className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--ink-soft)] transition hover:text-[var(--terracotta)]"
        >
          pokerbook
        </Link>

        <div className="mt-20 border-y border-[var(--line)] py-12">
          <p className="font-mono text-sm uppercase tracking-[0.18em] text-[var(--terracotta)]">
            phase 1 route
          </p>
          <h1 className="mt-5 text-5xl font-semibold tracking-normal sm:text-6xl">
            new session.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-[var(--ink-soft)]">
            The create-session form lands here in Phase 2. For now, this route
            confirms the app shell is wired.
          </p>
        </div>
      </section>
    </main>
  );
}
