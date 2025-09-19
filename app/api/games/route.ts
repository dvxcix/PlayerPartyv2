// app/api/games/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

function isoDateInTZ(tz: string, d = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")!.value;
  const m = parts.find((p) => p.type === "month")!.value;
  const dd = parts.find((p) => p.type === "day")!.value;
  return `${y}-${m}-${dd}`;
}

export async function GET() {
  try {
    const tz = process.env.NEXT_PUBLIC_TIMEZONE || "America/New_York";
    const today = isoDateInTZ(tz);

    const { data: games, error: gErr } = await supabaseAdmin
      .from("games")
      .select("game_id, sport_key, game_date, commence_time, home_team, away_team")
      .gte("commence_time", `${today}T00:00:00.000Z`)
      .lte("commence_time", `${today}T23:59:59.999Z`)
      .order("commence_time");
    if (gErr) throw gErr;

    const gameIds = games?.map((g) => g.game_id) ?? [];

    // Join players to get names; Supabase may return an array or object under `players`
    const { data: parts, error: pErr } = await supabaseAdmin
      .from("game_participants")
      .select("game_id, player_id, team_abbr, players(full_name)")
      .in("game_id", gameIds);
    if (pErr) throw pErr;

    const byGame: Record<string, any> = {};
    for (const g of games ?? []) byGame[g.game_id] = { ...g, participants: [] as any[] };

    for (const row of parts ?? []) {
      // Handle both shapes: players: { full_name } OR players: [{ full_name }]
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
