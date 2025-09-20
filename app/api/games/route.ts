// app/api/games/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE!;

/**
 * Returns a broad UTC window that safely covers "today" in ET:
 * from now - 6 hours to now + 36 hours (UTC).
 * This avoids time zone edge-case misses while keeping results relevant.
 */
function getBroadUtcWindow() {
  const now = Date.now();
  const start = new Date(now - 6 * 60 * 60 * 1000).toISOString();
  const end = new Date(now + 36 * 60 * 60 * 1000).toISOString();
  return { startISO: start, endISO: end };
}

export async function GET(req: Request) {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);
    const url = new URL(req.url);
    const dateParam = url.searchParams.get("date"); // optional YYYY-MM-DD
    const includePast = url.searchParams.get("include_past") === "1";

    let q = supabase
      .from("games")
      .select(
        `
        id,
        game_id,
        home_team_abbr,
        away_team_abbr,
        commence_time,
        status,
        game_participants:game_participants(
          player_id,
          team_abbr,
          players(full_name)
        )
      `
      );

    if (includePast) {
      q = q.order("commence_time", { ascending: false }).limit(500);
    } else if (dateParam) {
      // If an explicit date is requested (interpreted as UTC calendar date)
      const start = new Date(`${dateParam}T00:00:00Z`).toISOString();
      const end = new Date(`${dateParam}T24:00:00Z`).toISOString();
      q = q.gte("commence_time", start).lt("commence_time", end).order("commence_time", { ascending: true });
    } else {
      // Broad window around "today" in ET (UTC-based)
      const { startISO, endISO } = getBroadUtcWindow();
      q = q.gte("commence_time", startISO).lt("commence_time", endISO).order("commence_time", { ascending: true });
    }

    const { data, error } = await q;
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const games = (data ?? []).map((g: any) => ({
      id: String(g.id ?? g.game_id),
      game_id: String(g.game_id ?? g.id),
      home_team_abbr: g.home_team_abbr,
      away_team_abbr: g.away_team_abbr,
      commence_time: g.commence_time,
      status: g.status,
      participants:
        (g.game_participants ?? []).map((p: any) => ({
          player_id: String(p.player_id),
          team_abbr: p.team_abbr,
          players: { full_name: p.players?.full_name ?? String(p.player_id) },
        })) ?? [],
    }));

    return NextResponse.json({ ok: true, data: games }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}