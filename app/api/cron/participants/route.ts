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

type AnyRow = Record<string, any>;

function getGameId(g: AnyRow): string | null {
  const candidates = [g?.game_id, g?.event_id, g?.id, g?.odds_api_event_id];
  const found = candidates.find((x) => typeof x === "string" && x.trim().length > 0);
  return found ? String(found) : null;
}

function getTeamCode(g: AnyRow, side: "home" | "away"): string | null {
  const keys =
    side === "home"
      ? ["home_team_abbr", "home_team", "home", "home_team_code", "home_abbr", "home_short"]
      : ["away_team_abbr", "away_team", "away", "away_team_code", "away_abbr", "away_short"];

  for (const k of keys) {
    const v = g?.[k];
    if (typeof v === "string" && v.trim()) {
      return v.trim();
    }
  }
  return null;
}

function getPlayerTeamCode(p: AnyRow): string | null {
  const keys = ["team_abbr", "team_abbreviation", "team", "team_code", "team_short"];
  for (const k of keys) {
    const v = p?.[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function variants(code: string | null | undefined): string[] {
  if (!code) return [];
  const c = String(code);
  return Array.from(new Set([c, c.toUpperCase(), c.toLowerCase()]));
}

export async function GET() {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);
    const { startISO, endISO } = getBroadUtcWindow();

    // 1) Fetch games in the window (generic select to be schema-agnostic)
    const gamesRes = await supabase
      .from("games")
      .select("*")
      .gte("commence_time", startISO)
      .lt("commence_time", endISO)
      .order("commence_time", { ascending: true });

    if (gamesRes.error) {
      return NextResponse.json(
        { ok: false, error: `Games query failed: ${gamesRes.error.message}` },
        { status: 500 }
      );
    }

    const games = (gamesRes.data ?? []) as AnyRow[];
    if (!games.length) {
      return NextResponse.json({
        ok: true,
        message: "No games within window.",
        games: 0,
        upserts: 0,
        backfills: 0,
      });
    }

    // 2) Cache players once
    const allPlayersRes = await supabase.from("players").select("*");
    if (allPlayersRes.error) {
      return NextResponse.json(
        { ok: false, error: `Players query failed: ${allPlayersRes.error.message}` },
        { status: 500 }
      );
    }
    const allPlayers = (allPlayersRes.data ?? []) as AnyRow[];

    let upserts = 0;
    let backfills = 0;

    for (const g of games) {
      const gameId = getGameId(g);
      const home = getTeamCode(g, "home");
      const away = getTeamCode(g, "away");
      if (!gameId || !home || !away) continue;

      const teamSet = new Set([...variants(home), ...variants(away)]);
      const roster = allPlayers.filter((p) => teamSet.has(getPlayerTeamCode(p) ?? "__NO_MATCH__"));

      const rows =
        roster
          .map((p) => ({
            game_id: gameId,
            player_id: String(p.player_id ?? p.id ?? ""),
            team_abbr: getPlayerTeamCode(p) ?? home,
          }))
          .filter((r) => r.player_id) ?? [];

      if (rows.length) {
        const ins = await supabase
          .from("game_participants")
          .upsert(rows, { onConflict: "game_id,player_id" });
        if (!ins.error) upserts += rows.length;
      }

      // 3) Backfill from odds (if any already present)
      const oddPlayersRes = await supabase
        .from("odds")
        .select("player_id")
        .eq("game_id", gameId);
      const distinctIds = Array.from(
        new Set((oddPlayersRes.data ?? []).map((o: AnyRow) => o.player_id).filter(Boolean))
      ) as string[];

      if (distinctIds.length) {
        const pRowsRes = await supabase
          .from("players")
          .select("*")
          .in("player_id", distinctIds);
        const pRows = (pRowsRes.data ?? []) as AnyRow[];

        const backfillRows =
          pRows.map((pr) => ({
            game_id: gameId,
            player_id: String(pr.player_id ?? pr.id),
            team_abbr: getPlayerTeamCode(pr) ?? home,
          })) ?? [];

        if (backfillRows.length) {
          const bf = await supabase
            .from("game_participants")
            .upsert(backfillRows, { onConflict: "game_id,player_id" });
          if (!bf.error) backfills += backfillRows.length;
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
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}  return null;
}

function getPlayerTeamCode(p: AnyRow): string | null {
  const keys = ["team_abbr", "team_abbreviation", "team", "team_code", "team_short"];
  for (const k of keys) {
    const v = p?.[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function variants(code: string | null | undefined): string[] {
  if (!code) return [];
  const c = String(code);
  return Array.from(new Set([c, c.toUpperCase(), c.toLowerCase()]));
}

export async function GET() {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);
    const { startISO, endISO } = getBroadUtcWindow();

    // 1) Fetch games in the window
    const gamesRes = await supabase
      .from("games")
      .select("*")
      .gte("commence_time", startISO)
      .lt("commence_time", endISO)
      .order("commence_time", { ascending: true });

    if (gamesRes.error) {
      return NextResponse.json(
        { ok: false, error: `Games query failed: ${gamesRes.error.message}` },
        { status: 500 }
      );
    }

    const games = (gamesRes.data ?? []) as AnyRow[];
    if (!games.length) {
      return NextResponse.json({
        ok: true,
        message: "No games within window.",
        games: 0,
        upserts: 0,
        backfills: 0,
      });
    }

    let upserts = 0;
    let backfills = 0;

    // Cache players table once
    const allPlayersRes = await supabase.from("players").select("*");
    if (allPlayersRes.error) {
      return NextResponse.json(
        { ok: false, error: `Players query failed: ${allPlayersRes.error.message}` },
        { status: 500 }
      );
    }
    const allPlayers = (allPlayersRes.data ?? []) as AnyRow[];

    for (const g of games) {
      const gameId = getGameId(g);
      const home = getTeamCode(g, "home");
      const away = getTeamCode(g, "away");
      if (!gameId || !home || !away) continue;

      const teamSet = new Set([...variants(home), ...variants(away)]);
      const roster = allPlayers.filter((p) => teamSet.has(getPlayerTeamCode(p) ?? "__NO_MATCH__"));

      const rows =
        roster
          .map((p) => ({
            game_id: gameId,
            player_id: String(p.player_id ?? p.id ?? ""),
            team_abbr: getPlayerTeamCode(p) ?? home,
          }))
          .filter((r) => r.player_id) ?? [];

      if (rows.length) {
        const ins = await supabase
          .from("game_participants")
          .upsert(rows, { onConflict: "game_id,player_id" });
        if (!ins.error) upserts += rows.length;
      }

      // Backfill from odds if present
      const oddPlayersRes = await supabase.from("odds").select("player_id").eq("game_id", gameId);
      const distinctIds = Array.from(
        new Set((oddPlayersRes.data ?? []).map((o: AnyRow) => o.player_id).filter(Boolean))
      ) as string[];

      if (distinctIds.length) {
        const pRowsRes = await supabase
          .from("players")
          .select("*")
          .in("player_id", distinctIds);
        const pRows = (pRowsRes.data ?? []) as AnyRow[];

        const backfillRows =
          pRows.map((pr) => ({
            game_id: gameId,
            player_id: String(pr.player_id ?? pr.id),
            team_abbr: getPlayerTeamCode(pr) ?? home,
          })) ?? [];

        if (backfillRows.length) {
          const bf = await supabase
            .from("game_participants")
            .upsert(backfillRows, { onConflict: "game_id,player_id" });
          if (!bf.error) backfills += backfillRows.length;
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
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}}

function getPlayerTeamCode(p) {
  const keys = ["team_abbr", "team_abbreviation", "team", "team_code", "team_short"];
  for (const k of keys) {
    const v = p?.[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function variants(code) {
  if (!code) return [];
  const c = String(code);
  return Array.from(new Set([c, c.toUpperCase(), c.toLowerCase()]));
}

export async function GET() {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);
    const { startISO, endISO } = getBroadUtcWindow();

    // 1) Fetch games in the window
    const gamesRes = await supabase
      .from("games")
      .select("*")
      .gte("commence_time", startISO)
      .lt("commence_time", endISO)
      .order("commence_time", { ascending: true });

    if (gamesRes.error) {
      return NextResponse.json(
        { ok: false, error: `Games query failed: ${gamesRes.error.message}` },
        { status: 500 }
      );
    }
    const games = gamesRes.data || [];
    if (!games.length) {
      return NextResponse.json({
        ok: true,
        message: "No games within window.",
        games: 0,
        upserts: 0,
        backfills: 0,
      });
    }

    let upserts = 0;
    let backfills = 0;

    // Cache players table once (avoid N calls)
    const allPlayersRes = await supabase.from("players").select("*");
    if (allPlayersRes.error) {
      return NextResponse.json(
        { ok: false, error: `Players query failed: ${allPlayersRes.error.message}` },
        { status: 500 }
      );
    }
    const allPlayers = allPlayersRes.data || [];

    for (const g of games) {
      const gameId = getGameId(g);
      const home = getTeamCode(g, "home");
      const away = getTeamCode(g, "away");
      if (!gameId || !home || !away) continue;

      const teamSet = new Set([...variants(home), ...variants(away)]);
      const roster = allPlayers.filter((p) => teamSet.has(getPlayerTeamCode(p)));

      const rows =
        roster
          .map((p) => ({
            game_id: gameId,
            player_id: String(p.player_id ?? p.id ?? ""),
            team_abbr: getPlayerTeamCode(p) ?? home,
          }))
          .filter((r) => r.player_id) || [];

      if (rows.length) {
        const ins = await supabase
          .from("game_participants")
          .upsert(rows, { onConflict: "game_id,player_id" });
        if (!ins.error) upserts += rows.length;
      }

      // Backfill from odds if present
      const oddPlayersRes = await supabase
        .from("odds")
        .select("player_id")
        .eq("game_id", gameId);
      const distinctIds = Array.from(
        new Set((oddPlayersRes.data || []).map((o) => o.player_id).filter(Boolean))
      );

      if (distinctIds.length) {
        const pRowsRes = await supabase
          .from("players")
          .select("*")
          .in("player_id", distinctIds);
        const pRows = pRowsRes.data || [];

        const backfillRows =
          pRows.map((pr) => ({
            game_id: gameId,
            player_id: String(pr.player_id ?? pr.id),
            team_abbr: getPlayerTeamCode(pr) ?? home,
          })) || [];

        if (backfillRows.length) {
          const bf = await supabase
            .from("game_participants")
            .upsert(backfillRows, { onConflict: "game_id,player_id" });
          if (!bf.error) backfills += backfillRows.length;
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
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
