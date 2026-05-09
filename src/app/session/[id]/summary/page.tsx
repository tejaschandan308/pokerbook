import Link from "next/link";

type SummaryPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function SummaryPage({ params }: SummaryPageProps) {
  const { id } = await params;

  return (
    <main className="min-h-screen bg-background px-6 py-8 text-foreground sm:px-10">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-3xl flex-col justify-between">
        <nav className="flex items-center justify-between border-b border-[var(--line)] pb-5 font-mono text-xs uppercase tracking-[0.18em] text-[var(--ink-soft)]">
          <Link href="/" className="transition hover:text-[var(--terracotta)]">
            pokerbook
          </Link>
          <span className="text-[var(--table-green)]">ended</span>
        </nav>

        <div className="py-20">
          <p className="font-mono text-sm uppercase tracking-[0.18em] text-[var(--terracotta)]">
            session ended
          </p>
          <h1 className="mt-5 text-5xl font-semibold leading-none tracking-normal sm:text-6xl">
            summary coming{" "}
            <span className="font-serif italic text-[var(--terracotta)]">
              in 2d.
            </span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-[var(--ink-soft)]">
            Chip counts are saved. Profit and loss lands in the next phase.
          </p>
        </div>

        <div className="border-t border-[var(--line)] pt-5">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--ink-soft)]">
            session id
          </p>
          <p className="mt-3 break-all font-mono text-sm text-foreground">
            {id}
          </p>
        </div>
      </section>
    </main>
  );
}
