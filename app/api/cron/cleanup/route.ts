// app/api/cron/cleanup/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE!;

// Helper: get YYYY-MM-DD for "today" in America/New_York
function todayET(): string {
  const now = new Date();
  // Format as en-US in New York; then recompose YYYY-MM-DD
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const y = fmt.find((p) => p.type === "year")!.value;
  const m = fmt.find((p) => p.type === "month")!.value;
  const d = fmt.find((p) => p.type === "day")!.value;
  return `${y}-${m}-${d}`;
}

// Optional safety: ensure we only run shortly after local midnight ET
function isPastMidnightET(minuteThreshold = 1): boolean {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const hh = Number(parts.find((p) => p.type === "hour")!.value);
  const mm = Number(parts.find((p) => p.type === "minute")!.value);
  return hh === 0 && mm >= minuteThreshold;
}

export async function GET() {
  try {
    if (!SUPABASE_URL || !SERVICE_ROLE) {
      return NextResponse.json(
        { ok: false, error: "Missing Supabase env vars" },
        { status: 500 }
      );
    }

    // If you schedule this route every 15m, only proceed after 12:01am ET.
    if (!isPastMidnightET(1)) {
      return NextResponse.json({ ok: true, skipped: "Not past 12:01am ET" });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
    const today = todayET();

    // We delete any rows whose local (ET) date is < today.
    // Use RPC with raw SQL so we can cast timestamps with timezone properly.
    // Order matters due to FKs: odds_history -> odds -> game_participants -> games.

    const sql = `
      with params as (
        select to_date($1, 'YYYY-MM-DD')::date as today
      )
      -- 1) odds_history
      delete from odds_history
      using params
      where (timezone('America/New_York', captured_at))::date < params.today;

      -- 2) odds
      delete from odds
      using params
      where (timezone('America/New_York', created_at))::date < params.today;

      -- 3) game_participants
      delete from game_participants
      using params
      where game_id in (
        select g.game_id
        from games g, params
        where (timezone('America/New_York', g.commence_time))::date < params.today
      );

      -- 4) games
      delete from games
      using params
      where (timezone('America/New_York', games.commence_time))::date < params.today;
    `;

    // Supabase JS: call Postgres directly with rpc? Use the "pg_exec" built-in if you created it.
    // Easiest: use the 'query' on the "pg" schema via HTTP fetch (PostgREST) is not available.
    // So we run it via a one-off function we define inline here using Postgres' anonymous code block.

    const { error } = await supabase.rpc("exec_sql", {
      sql_text: sql,
      params: [today],
    } as any);

    // If you don’t have exec_sql helper created yet, create it once in SQL:
    // create or replace function exec_sql(sql_text text, params text[] default null)
    // returns void language plpgsql as $$
    // declare
    //   _today text;
    // begin
    //   if params is not null and array_length(params,1) >= 1 then
    //     _today := params[1];
    //   end if;
    //   execute sql_text using _today;
    // end $$;

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, purged_before_local_date: today });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
