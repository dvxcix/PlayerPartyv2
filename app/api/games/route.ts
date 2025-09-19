// app/api/games/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const now = new Date();
    const start = new Date(now.getTime() - 12 * 60 * 60 * 1000).toISOString();
    const end   = new Date(now.getTime() + 36 * 60 * 60 * 1000).toISOString();

    const { data: games, error: gErr } = await supabaseAdmin
      .from("games")
      .select("game_id, sport_key, game_date, commence_time, home_team, away_team")
      .gte("commence_time", start)
      .lte("commence_time", end)
      .order("commence_time");
    if (gErr) throw gErr;

    const gameIds = games?.map((g) => g.game_id) ?? [];
    const { data: parts, error: pErr } = await supabaseAdmin
      .from("game_participants")
      .select("game_id, player_id, team_abbr, players(full_name)")
      .in("game_id", gameIds);
    if (pErr) throw pErr;

    const byGame: Record<string, any> = {};
    for (const g of games ?? []) byGame[g.game_id] = { ...g, participants: [] as any[] };

    for (const row of parts ?? []) {
      const playersField: any = (row as any).players;
      const joinedName =
        Array.isArray(playersField) ? playersField[0]?.full_name : playersField?.full_name;

      byGame[row.game_id].participants.push({
        game_id: row.game_id,
        player_id: row.player_id,
        team_abbr: row.team_abbr,
        full_name: joinedName ?? row.player_id,
      });
    }

    return NextResponse.json({ ok: true, games: Object.values(byGame) });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
