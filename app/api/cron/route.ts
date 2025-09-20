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

/** Get ET midnight start/end for “today”, as ISO strings. */
function getETDayRange() {
  const tz = "America/New_York";
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
    .formatToParts(now)
    .reduce<Record<string, string>>((acc, p) => {
      if (p.type !== "literal") acc[p.type] = p.value;
      return acc;
    }, {});
  const yyyy = Number(parts.year);
  const mm = Number(parts.month);
  const dd = Number(parts.day);
  const start = new Date(Date.UTC(yyyy, mm - 1, dd, 0, 0, 0));
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  const toISO = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString();
  return { startISO: toISO(start), endISO: toISO(end) };
}

/**
 * Participants linker:
 * - For each TODAY (ET) game in `games`, take home/away team abbrs.
 * - Get all players in `players` whose team_abbr is one of those (home/away).
 * - Upsert (game_id, player_id, team_abbr) into `game_participants`.
 * - Also backfill using any existing odds rows for today’s games (if player_id is present),
 *   in case a player’s team_abbr is missing or outdated in `players`.
 */
export async function GET() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);
  const { startISO, endISO } = getETDayRange();

  // 1) Fetch today’s games (ET)
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
    return NextResponse.json({ ok: true, message: "No games today (ET).", games: 0, upserts: 0, backfills: 0 });
  }

  let upserts = 0;
  let backfills = 0;

  // 2) For each game, fetch rosters by team_abbr and upsert participants
  for (const game of games as Game[]) {
    const home = (game.home_team_abbr || "").toLowerCase();
    const away = (game.away_team_abbr || "").toLowerCase();
    if (!home || !away) continue;

    // pull players for both teams (assumes players.team_abbr matches your abbrs)
    const { data: teamPlayers, error: pErr } = await supabase
      .from("players")
      .select("player_id, team_abbr")
      .in("team_abbr", [home, away]);

    if (pErr) continue;

    const rows =
      (teamPlayers ?? [])
        .filter((p: Player) => p.player_id && p.team_abbr)
        .map((p: Player) => ({
          game_id: game.game_id,
          player_id: p.player_id,
          team_abbr: (p.team_abbr as string).toLowerCase(),
        })) ?? [];

    if (rows.length) {
      // Upsert on (game_id, player_id)
      const { error: insErr } = await supabase
        .from("game_participants")
        .upsert(rows, { onConflict: "game_id,player_id" });
      if (!insErr) upserts += rows.length;
    }

    // 3) Optional backfill: if any odds already exist for this game today, ensure those player_ids are linked
    const { data: oddPlayers } = await supabase
      .from("odds")
      .select("player_id, bookmaker_key, market_key")
      .eq("game_id", game.game_id);

    const distinctPlayerIds = Array.from(
      new Set((oddPlayers ?? []).map((o: any) => o.player_id).filter(Boolean))
    ) as string[];

    if (distinctPlayerIds.length) {
      // Try to infer team_abbr from players table (fallback to home team)
      const { data: pRows } = await supabase
        .from("players")
        .select("player_id, team_abbr")
        .in("player_id", distinctPlayerIds);

      const teamByPlayer = new Map<string, string>();
      for (const pr of pRows ?? []) {
        if (pr.player_id && pr.team_abbr) teamByPlayer.set(String(pr.player_id), String(pr.team_abbr).toLowerCase());
      }

      const backfillRows = distinctPlayerIds.map((pid) => ({
        game_id: game.game_id,
        player_id: pid,
        team_abbr: teamByPlayer.get(pid) || home, // fallback to home if unknown
      }));

      const { error: bfErr } = await supabase
        .from("game_participants")
        .upsert(backfillRows, { onConflict: "game_id,player_id" });
      if (!bfErr) backfills += backfillRows.length;
    }
  }

  return NextResponse.json({
    ok: true,
    games: games.length,
    upserts,
    backfills,
    message: "Participants linked for today’s games (ET).",
  });
}