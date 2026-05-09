import Link from "next/link";

type SessionPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function SessionPage({ params }: SessionPageProps) {
  const { id } = await params;

  return (
    <main className="min-h-screen bg-background px-6 py-8 text-foreground sm:px-10">
      <section className="mx-auto w-full max-w-4xl">
        <Link
          href="/"
          className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--ink-soft)] transition hover:text-[var(--terracotta)]"
        >
          pokerbook
        </Link>

        <div className="mt-16 grid gap-8 border-y border-[var(--line)] py-10 sm:grid-cols-[1.2fr_0.8fr]">
          <div>
            <p className="font-mono text-sm uppercase tracking-[0.18em] text-[var(--table-green)]">
              session route
            </p>
            <h1 className="mt-5 text-5xl font-semibold tracking-normal sm:text-6xl">
              table is waiting.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-[var(--ink-soft)]">
              Player tiles, buy-in tracking, and settlement math arrive after
              the Phase 1 review.
            </p>
          </div>

          <div className="border border-[var(--line)] bg-[#fffaf0] p-5">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--ink-soft)]">
              session id
            </p>
            <p className="mt-4 break-all font-mono text-sm text-foreground">
              {id}
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
