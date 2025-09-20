// app/api/cron/participants/route.ts
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

function variants(code: string | null | undefined): string[] {
  if (!code) return [];
  const c = String(code);
  return Array.from(new Set([c, c.toUpperCase(), c.toLowerCase()]));
}

export async function GET() {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

    // Pull games for today via view, else via window
    let gamesRes = await supabase.from("v_games_today").select("*");
    if (gamesRes.error) {
      const { startISO, endISO } = windowUTC();
      gamesRes = await supabase
        .from("games")
        .select("*")
        .gte("commence_time", startISO)
        .lt("commence_time", endISO)
        .order("commence_time", { ascending: true });
    }
    if (gamesRes.error) {
      return NextResponse.json({ ok: false, error: `Games query failed: ${gamesRes.error.message}` }, { status: 500 });
    }
    const games = (gamesRes.data ?? []) as AnyRow[];
    if (!games.length) {
      return NextResponse.json({ ok: true, games: 0, upserts: 0, backfills: 0, message: "No games in window." });
    }

    // Cache players once
    const playersRes = await supabase.from("players").select("player_id, team_abbr");
    if (playersRes.error) {
      return NextResponse.json({ ok: false, error: `Players query failed: ${playersRes.error.message}` }, { status: 500 });
    }
    const allPlayers = (playersRes.data ?? []) as AnyRow[];

    let upserts = 0;
    let backfills = 0;

    for (const g of games) {
      const game_id = String(g.game_id ?? g.id ?? g.event_id ?? "");
      const home = String(g.home_team ?? g.home ?? "").trim();
      const away = String(g.away_team ?? g.away ?? "").trim();
      if (!game_id || !home || !away) continue;

      const teamSet = new Set([...variants(home), ...variants(away)]);

      const roster = allPlayers.filter((p) => {
        const t = (p.team_abbr ?? "").toString();
        return teamSet.has(t) || teamSet.has(t.toUpperCase()) || teamSet.has(t.toLowerCase());
      });

      const rows =
        roster
          .map((p) => ({
            game_id,
            player_id: String(p.player_id),
            team_abbr: p.team_abbr ?? home,
          }))
          .filter((r) => r.player_id) ?? [];

      if (rows.length) {
        const ins = await supabase.from("game_participants").upsert(rows, { onConflict: "game_id,player_id" });
        if (!ins.error) upserts += rows.length;
      }

      // Backfill from odds (if odds already wrote first)
      const oddPlayersRes = await supabase.from("odds").select("player_id").eq("game_id", game_id);
      const distinctIds = Array.from(new Set((oddPlayersRes.data ?? []).map((o: any) => o.player_id).filter(Boolean)));
      if (distinctIds.length) {
        const pRowsRes = await supabase.from("players").select("player_id, team_abbr").in("player_id", distinctIds);
        const pRows = pRowsRes.data ?? [];
        const backfillRows =
          pRows.map((pr: any) => ({
            game_id,
            player_id: String(pr.player_id),
            team_abbr: pr.team_abbr ?? home,
          })) ?? [];
        if (backfillRows.length) {
          const bf = await supabase.from("game_participants").upsert(backfillRows, { onConflict: "game_id,player_id" });
          if (!bf.error) backfills += backfillRows.length;
        }
      }
    }

    return NextResponse.json({ ok: true, games: games.length, upserts, backfills, message: "Participants linked." });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
