// app/api/games/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE!;

type AnyRow = Record<string, any>;

export async function GET() {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

    // Today's window in UTC (same approach you used elsewhere)
    const today = new Date().toISOString().split("T")[0];
    const start = `${today}T00:00:00Z`;
    const end = `${today}T23:59:59Z`;

    // 1) Pull today's games
    const { data: games, error: gamesErr } = await supabase
      .from("games")
      .select("game_id, home_team_abbr, away_team_abbr, commence_time, status")
      .gte("commence_time", start)
      .lte("commence_time", end)
      .order("commence_time", { ascending: true });

    if (gamesErr) {
      return NextResponse.json({ ok: false, error: gamesErr.message }, { status: 500 });
    }

    if (!games || games.length === 0) {
      return NextResponse.json({ ok: true, games: [] }, { status: 200 });
    }

    const gameIds = games.map((g: AnyRow) => g.game_id);

    // 2) Pull participants for those games (join players to get full_name)
    const { data: parts, error: partsErr } = await supabase
      .from("game_participants")
      .select("game_id, player_id, team_abbr, players(full_name)")
      .in("game_id", gameIds);

    if (partsErr) {
      return NextResponse.json({ ok: false, error: partsErr.message }, { status: 500 });
    }

    // group participants by game_id
    const byGame: Record<string, AnyRow[]> = {};
    (parts || []).forEach((p: AnyRow) => {
      const gid = String(p.game_id);
      (byGame[gid] ||= []).push({
        player_id: p.player_id,
        team_abbr: p.team_abbr,
        players: { full_name: p.players?.full_name ?? p.player_id },
      });
    });

    // shape to what the front-end expects (note: "games", not "data")
    const payload = (games || []).map((g: AnyRow) => ({
      id: g.game_id, // keep both id and game_id for historical UI code that used either
      game_id: g.game_id,
      home_team_abbr: g.home_team_abbr,
      away_team_abbr: g.away_team_abbr,
      commence_time: g.commence_time,
      status: g.status ?? null,
      participants: byGame[g.game_id] || [],
    }));

    return NextResponse.json({ ok: true, games: payload }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
