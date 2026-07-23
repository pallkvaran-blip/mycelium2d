# Global leaderboard — Supabase setup

The game's global high-score board talks **directly to Supabase's REST API** from the
browser. There is **no server code to run** — you create a table + two row-level-security
(RLS) policies, then paste your project URL + public anon key into the game.

Time: ~10 minutes. Cost: Supabase's free tier is plenty for this.

---

## 1. Create a project
1. Sign up at <https://supabase.com> and create a new project (pick any region near your players).
2. Wait for it to finish provisioning.

## 2. Create the table + policies
Open **SQL Editor** → **New query**, paste this, and run it:

```sql
-- One row per submitted score.
create table public.scores (
  id           bigint generated always as identity primary key,
  name         text not null,
  level        int  not null,
  species      text,
  species_name text,
  created_at   timestamptz not null default now()
);

alter table public.scores enable row level security;

-- Anyone may READ the board.
create policy "public read" on public.scores
  for select to anon
  using (true);

-- Anyone may INSERT a score, with sanity caps so nobody posts level 999 or a giant name.
-- (level is capped at 100 = the game's MAX_LEVEL.)
create policy "public insert" on public.scores
  for insert to anon
  with check (
    level >= 0 and level <= 100
    and char_length(name) between 1 and 14
    and char_length(coalesce(species_name, '')) <= 40
  );

-- Fast board queries (highest level first, earliest run wins ties).
create index scores_board_idx on public.scores (level desc, created_at asc);
```

No `update`/`delete` policies are created, so anonymous visitors can read and add scores
but can never edit or delete them.

## 3. Get your credentials
In the dashboard: **Project Settings → API**. Copy:
- **Project URL** — e.g. `https://abcdefgh.supabase.co`
- **anon public** key — the long JWT under "Project API keys".

> ⚠️ Use the **anon (public)** key only. It's designed to be embedded in client code and
> is safe to commit — access is gated by the RLS policies above. **Never** paste the
> **service_role** key anywhere in the game; that one is a real secret.

## 4. Wire it into the game
Open `src/net_scores.js` and fill in the two constants near the top:

```js
const SUPABASE_URL = 'https://abcdefgh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOi...your-anon-key...';
```

Then rebuild and redeploy:

```bash
node build.mjs      # regenerates dist/ (and dist/index.html for itch)
```

That's it. With the fields filled in, the game shows the **Global** board and submits
qualifying runs to it; leave them empty and it silently uses the **local** per-device
board instead. If the backend is ever unreachable, the game falls back to local so it
never breaks.

---

## Notes & limits
- **Scores are client-submitted, so they're spoofable.** The RLS caps stop absurd values
  (level > 100, over-long names), but a determined player could still POST a legit-looking
  score via devtools. That's inherent to any backend-less browser game; fine for a fun board.
- **Monthly** = a rolling last-30-days window (derived at query time). **All-Time** = every row.
- Want to reset or moderate? Delete rows in the Supabase **Table Editor** (or run
  `delete from public.scores where ...` in the SQL editor).
- Optional hardening later: a Supabase **Edge Function** could add per-IP rate limiting or a
  shared submit secret. Not required to launch.

---

## Run telemetry (the `events` table) — optional but recommended

The leaderboard only records top-10 *deaths* with a name, so it can't tell you how far most
people get, whether they come back, or whether anyone buys a species. The game also emits
**anonymous run telemetry** (`src/net_scores.js` `logEvent`) into a separate `events` table:
`run_start` · `level_clear` · `run_end` (cause `won`/`died`) · `purchase`. No names — just an
anonymous per-device id (`mycelium.clientid.v1`) and a per-load session id. Until this table
exists the POSTs 404 harmlessly (the game is unaffected).

Create it once in the Supabase **SQL editor**:

```sql
create table if not exists public.events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  client_id text, session_id text,
  kind text not null,          -- run_start | level_clear | run_end | purchase
  species text, level int, cause text, turns int
);
alter table public.events enable row level security;
create policy events_insert on public.events for insert to anon with check (
  char_length(kind) <= 24 and coalesce(char_length(species),0) <= 32
  and coalesce(level,0) between 0 and 1000 );
create policy events_read on public.events for select to anon using (true);
```

Then view the funnel at **`<site>/analytics.html`** (`docs/analytics.html`, published by
`build.mjs`; NOT in the itch zip): players, sessions, run-length distribution, win/death split,
species picked, purchases, and simple retention. Reads are public (anon key), same as the board.
