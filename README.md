# Pokerbook

buy-ins, cash-outs, and clean settlements for home poker nights.

## Phase 1 status

- Next.js 15 App Router with TypeScript
- Tailwind CSS
- Supabase JS client installed with environment placeholders
- Routes scaffolded: `/`, `/new`, `/session/[id]`
- No auth, no database writes, no V1 feature logic yet

## Local setup

```powershell
npm install
npm run dev
```

Open `http://localhost:3000`.

## Supabase setup for Phase 2

1. Create a new Supabase project at `https://supabase.com`.
2. Open Project Settings, then API.
3. Copy the Project URL into `NEXT_PUBLIC_SUPABASE_URL`.
4. Copy the anon public key into `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
5. Save those values in a local `.env.local` file.

Use `.env.example` as the template. Do not commit `.env.local`.

Planned V1 tables:

```sql
create table sessions (
  id uuid primary key default gen_random_uuid(),
  buy_in_amount integer not null,
  created_at timestamptz not null default now(),
  status text not null default 'active'
);

create table players (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  name text not null,
  total_buy_ins integer not null default 0,
  final_chips integer
);
```

Realtime will be wired in Phase 4 after the core flow is working.
