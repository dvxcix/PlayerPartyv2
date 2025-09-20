// app/api/cron/participants/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE!;

/** Broad UTC window: now -6h to now +36h — safely covers “today” in ET. */
function getBroadUtcWindow() {
  const now = Date.now();
  return {
    startISO: new Date(now - 6 * 60 * 60 * 1000).toISOString(),
    endISO: new Date(now + 36 * 60 * 60 * 1000).toISOString(),
  };
}

/** Safely extract the game_id/event id from any shape. */
function getGameId(g: any): string | null {
  const candidates = [g?.game_id, g?.event_id, g?.id, g?.odds_api_event_id];
  const found = candidates.find((x) => typeof x === "string" && x.trim().length > 0);
  return found ? String(found) : null;
}

/** Try to pull a 2–4 char team code from common field names. */
function getTeamCode(g: any, side: "home" | "away"): string | null {
  const keys =
    side === "home"
      ? ["home_team_abbr", "home_team", "home", "home_team_code", "home_abbr", "home_short"]
      : ["away_team_abbr", "away_team", "away", "away_team_code", "away_abbr", "away_short"];

  for (const k of keys) {
    const v = g?.[k];
    if (typeof v === "string" && v.trim()) {
      const code = v.trim();
      // prefer compact codes like "NYY" / "LAD", but accept any non-empty
      if (code.length <= 5) return code;
      // If it’s a full name, you can map to an abbr here if you have a map.
      return code;
    }
  }
  return null;
}

/** From a player row, find a team code field. */
function getPlayerTeamCode(p: any): string | null {
  const keys = ["team_abbr", "team_abbreviation", "team", "team_code", "team_short"];
  for (const k of keys) {
    const v = p?.[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

/** Build case-insensitive variants to match inconsistent casing. */
function variants(code: string | null | undefined): string[] {
  if (!code) return [];
  const c = String(code);
  return Array.from(new Set([c, c.toUpperCase(), c.toLowerCase()]));
}

export async function GET() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);
  const { startISO, endISO } = getBroadUtcWindow();

  // 1) Fetch games in the window with a generic SELECT *
  const { data: games, error: gErr } = await supabase
    .from("games")
    .select("*")
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

  for (const g of games) {
    const gameId = getGameId(g);
    const home = getTeamCode(g, "home");
    const away = getTeamCode(g, "away");
    if (!gameId || !home || !away) continue;

    const teamSet = Array.from(new Set([...variants(home), ...variants(away)]));

    // 2) Pull players whose team code matches either side (any case)
    const { data: players, error: pErr } = await supabase.from("players").select("*");
    if (pErr) continue;

    const roster = (players ?? []).filter((p: any) =>
      teamSet.includes(getPlayerTeamCode(p) ?? "__NO_MATCH__")
    );

    // Prepare rows for upsert
    const rows =
      roster.map((p: any) => ({
        game_id: gameId,
        player_id: String(p.player_id ?? p.id ?? ""),
        team_abbr: getPlayerTeamCode(p) ?? home, // default to home if missing
      })).filter((r) => r.player_id) ?? [];

    if (rows.length) {
      const { error: insErr } = await supabase
        .from("game_participants")
        .upsert(rows, { onConflict: "game_id,player_id" });
      if (!insErr) upserts += rows.length;
    }

    // 3) Backfill from any odds already present for this game (ensures linkage even if player.team_* is missing)
    const { data: oddPlayers } = await supabase
      .from("odds")
      .select("player_id")
      .eq("game_id", gameId);

    const distinctPlayerIds = Array.from(
      new Set((oddPlayers ?? []).map((o: any) => o.player_id).filter(Boolean))
    ) as string[];

    if (distinctPlayerIds.length) {
      const { data: pRows } = await supabase
        .from("players")
        .select("*")
        .in("player_id", distinctPlayerIds);

      const backfillRows =
        (pRows ?? []).map((pr: any) => ({
          game_id: gameId,
          player_id: String(pr.player_id ?? pr.id),
          team_abbr: getPlayerTeamCode(pr) ?? home,
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