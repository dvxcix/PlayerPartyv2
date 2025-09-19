# MLB Odds Dashboard (Vercel + Supabase + TheOddsAPI)

End-to-end starter that:
- Ingests today's MLB games (daily)
- Ingests **player_home_run** odds hourly from **FanDuel** and **BetMGM** only
- Stores snapshots in Supabase (`odds_history`)
- Shows a dashboard to pick a game, select players, and compare **two lines per player** (FanDuel = blue, BetMGM = brown) over time

## Quickstart

1) Clone & install
```bash
pnpm i
```
2) Configure env
```
cp .env.example .env.local
# fill in NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE, SUPABASE_ANON_KEY, THEODDSAPI_KEY
```
3) Run SQL migrations: paste `supabase/migrations/001_core.sql` and `002_rls.sql` into Supabase SQL editor and run.
4) Dev
```bash
pnpm dev
```
5) Deploy to Vercel; `vercel.json` sets cron for `/api/cron/events` (daily) and `/api/cron/odds` (hourly).

## Notes
- Only FanDuel + BetMGM are ingested/displayed.
- Time is stored in UTC; UI renders locally.
- You can extend to more markets by adding rows to `markets` and duplicating the odds fetch.
