// app/api/cron/participants/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE!;

type Game = {
  game_id: string;
  home_team_abbr: string;
  away_team_abbr: string;
  commence_time: string;
};

type Player = {
  player_id: string;
  team_abbr: string | null;
};

function variants(abbr: string | null | undefined): string[] {
  if (!abbr) return [];
  return Array.from(new Set([abbr, abbr.toUpperCase(), abbr.toLowerCase()]));
}

/** Broad UTC window: now -6h to now +36h */
function getBroadUtcWindow() {
  const now = Date.now();
  return {
    startISO: new Date(now - 6 * 60 * 60 * 1000).toISOString(),
    endISO: new Date(now + 36 * 60 * 60 * 1000).toISOString(),
  };
}

export async function GET() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);
  const { startISO, endISO } = getBroadUtcWindow();

  // 1) Fetch games in window
  const { data: games, error: gErr } = await supabase
    .from("games")
    .select("game_id, home_team_abbr, away_team_abbr, commence_time")
    .gte("commence_time", startISO)
    .lt("commence_time", endISO)
    .order("commence_time", { ascending: true });

  if (gErr) {
    return NextResponse.json({ ok: false, error: `Games query failed: ${gErr.message}` }, { status: 500 });
  }
  if (!games?.length) {
    return NextResponse.json({ ok: true, message: "No games within window.", games: 0, upserts: 0, backfills: 0 });
  }

  let upserts = 0;
  let backfills = 0;

  for (const game of games as Game[]) {
    const home = game.home_team_abbr;
    const away = game.away_team_abbr;
    if (!home || !away) continue;

    const teamSet = Array.from(new Set([...variants(home), ...variants(away)]));

    // 2) Pull players that match any variant of the two team abbrs
    const { data: teamPlayers, error: pErr } = await supabase
      .from("players")
      .select("player_id, team_abbr")
      .in("team_abbr", teamSet);

    if (!pErr && (teamPlayers?.length ?? 0) > 0) {
      const rows =
        (teamPlayers ?? [])
          .filter((p: Player) => p.player_id && p.team_abbr)
          .map((p: Player) => ({
            game_id: game.game_id,
            player_id: p.player_id,
            team_abbr: p.team_abbr as string,
          })) ?? [];

      if (rows.length) {
        const { error: insErr } = await supabase
          .from("game_participants")
          .upsert(rows, { onConflict: "game_id,player_id" });
        if (!insErr) upserts += rows.length;
      }
    }

    // 3) Backfill from any odds already present for this game
    const { data: oddPlayers } = await supabase
      .from("odds")
      .select("player_id")
      .eq("game_id", game.game_id);

    const distinctPlayerIds = Array.from(
      new Set((oddPlayers ?? []).map((o: any) => o.player_id).filter(Boolean))
    ) as string[];

    if (distinctPlayerIds.length) {
      const { data: pRows } = await supabase
        .from("players")
        .select("player_id, team_abbr")
        .in("player_id", distinctPlayerIds);

      const backfillRows =
        (pRows ?? []).map((pr: any) => ({
          game_id: game.game_id,
          player_id: String(pr.player_id),
          team_abbr: pr.team_abbr ?? home,
        })) ?? [];

      if (backfillRows.length) {
        const { error: bfErr } = await supabase
          .from("game_participants")
          .upsert(backfillRows, { onConflict: "game_id,player_id" });
        if (!bfErr) backfills += backfillRows.length;
      }
    }
  }

  return NextResponse.json({
    ok: true,
    games: games.length,
    upserts,
    backfills,
    message: "Participants linked for current window.",
  });
}