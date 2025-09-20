// app/api/games/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE!;

type AnyRow = Record<string, any>;

function windowUTC() {
  const now = Date.now();
  return {
    startISO: new Date(now - 6 * 60 * 60 * 1000).toISOString(),
    endISO: new Date(now + 36 * 60 * 60 * 1000).toISOString(),
  };
}

export async function GET(req: Request) {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);
    const url = new URL(req.url);
    const includePast = url.searchParams.get("include_past") === "1";
    const dateParam = url.searchParams.get("date"); // optional YYYY-MM-DD

    // Prefer view v_games_today if available
    let gamesRes = await supabase.from("v_games_today").select("*");
    let fromView = true;

    if (gamesRes.error) {
      // Fall back to games table with window filtering
      fromView = false;
      let q = supabase.from("games").select("*");
      if (includePast) {
        q = q.order("commence_time", { ascending: false }).limit(500);
      } else if (dateParam) {
        const start = new Date(`${dateParam}T00:00:00Z`).toISOString();
        const end = new Date(`${dateParam}T24:00:00Z`).toISOString();
        q = q.gte("commence_time", start).lt("commence_time", end).order("commence_time", { ascending: true });
      } else {
        const { startISO, endISO } = windowUTC();
        q = q.gte("commence_time", startISO).lt("commence_time", endISO).order("commence_time", { ascending: true });
      }
      gamesRes = await q;
    }

    if (gamesRes.error) {
      return NextResponse.json({ ok: false, error: gamesRes.error.message }, { status: 500 });
    }

    const rawGames = (gamesRes.data ?? []) as AnyRow[];

    // Normalize core fields from either v_games_today or games
    const gamesNorm = rawGames.map((g) => ({
      game_id: String(g.game_id ?? g.id ?? g.event_id ?? ""),
      home_team: String(g.home_team ?? g.home ?? ""),
      away_team: String(g.away_team ?? g.away ?? ""),
      commence_time: g.commence_time ?? g.start_time ?? null,
      status: g.status ?? null,
      game_date: g.game_date ?? null,
    })).filter((g) => g.game_id);

    const gameIds = gamesNorm.map((g) => g.game_id);
    let participantsByGame = new Map<string, Array<{ player_id: string; team_abbr: string | null; full_name?: string }>>();

    if (gameIds.length) {
      const gpRes = await supabase
        .from("game_participants")
        .select("game_id, player_id, team_abbr")
        .in("game_id", gameIds);

      if (gpRes.error) {
        return NextResponse.json({ ok: false, error: gpRes.error.message }, { status: 500 });
      }

      const gpRows = gpRes.data ?? [];
      const playerIds = Array.from(new Set(gpRows.map((r: any) => r.player_id)));
      const namesMap = new Map<string, string>();
      if (playerIds.length) {
        const pRes = await supabase
          .from("players")
          .select("player_id, full_name")
          .in("player_id", playerIds);
        for (const p of pRes.data ?? []) {
          namesMap.set(String(p.player_id), p.full_name);
        }
      }

      for (const row of gpRows) {
        const gid = String(row.game_id);
        const arr = participantsByGame.get(gid) ?? [];
        arr.push({
          player_id: String(row.player_id),
          team_abbr: row.team_abbr ?? null,
          full_name: namesMap.get(String(row.player_id)),
        });
        participantsByGame.set(gid, arr);
      }
    }

    const payload = gamesNorm.map((g) => ({
      id: g.game_id,
      game_id: g.game_id,
      home_team_abbr: g.home_team,  // UI expects *_abbr fields; we map directly
      away_team_abbr: g.away_team,
      commence_time: g.commence_time,
      status: g.status,
      participants: (participantsByGame.get(g.game_id) ?? []).map((p) => ({
        player_id: p.player_id,
        team_abbr: p.team_abbr,
        players: { full_name: p.full_name ?? p.player_id },
      })),
    }));

    return NextResponse.json({ ok: true, data: payload, source: fromView ? "v_games_today" : "games" }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
