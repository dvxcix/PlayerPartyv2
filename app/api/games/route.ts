// app/api/games/route.ts
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

function getGameId(g: any): string | null {
  const candidates = [g?.game_id, g?.event_id, g?.id, g?.odds_api_event_id];
  const found = candidates.find((x) => typeof x === "string" && x.trim().length > 0);
  return found ? String(found) : null;
}

function getTeamCode(g: any, side: "home" | "away"): string | null {
  const keys =
    side === "home"
      ? ["home_team_abbr", "home_team", "home", "home_team_code", "home_abbr", "home_short"]
      : ["away_team_abbr", "away_team", "away", "away_team_code", "away_abbr", "away_short"];

  for (const k of keys) {
    const v = g?.[k];
    if (typeof v === "string" && v.trim()) {
      const code = v.trim();
      if (code.length <= 5) return code;
      return code;
    }
  }
  return null;
}

export async function GET(req: Request) {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);
    const url = new URL(req.url);
    const includePast = url.searchParams.get("include_past") === "1";
    const dateParam = url.searchParams.get("date"); // optional YYYY-MM-DD

    let gamesRes;
    if (includePast) {
      gamesRes = await supabase.from("games").select("*").order("commence_time", { ascending: false }).limit(500);
    } else if (dateParam) {
      const start = new Date(`${dateParam}T00:00:00Z`).toISOString();
      const end = new Date(`${dateParam}T24:00:00Z`).toISOString();
      gamesRes = await supabase
        .from("games")
        .select("*")
        .gte("commence_time", start)
        .lt("commence_time", end)
        .order("commence_time", { ascending: true });
    } else {
      const { startISO, endISO } = getBroadUtcWindow();
      gamesRes = await supabase
        .from("games")
        .select("*")
        .gte("commence_time", startISO)
        .lt("commence_time", endISO)
        .order("commence_time", { ascending: true });
    }

    if (gamesRes.error) {
      return NextResponse.json({ ok: false, error: gamesRes.error.message }, { status: 500 });
    }

    const rawGames = gamesRes.data ?? [];
    const gameIds = rawGames
      .map(getGameId)
      .filter((x): x is string => Boolean(x));

    // Fetch participants in one shot and group by game_id
    let participantsByGame = new Map<string, Array<{ player_id: string; team_abbr: string | null; full_name?: string }>>();

    if (gameIds.length) {
      // Try to get participants + player name via FK; if it fails, do a manual join
      const gpRes = await supabase
        .from("game_participants")
        .select("game_id, player_id, team_abbr, players(full_name)")
        .in("game_id", gameIds);

      if (!gpRes.error && gpRes.data) {
        for (const row of gpRes.data as any[]) {
          const gid = String(row.game_id);
          const arr = participantsByGame.get(gid) ?? [];
          arr.push({
            player_id: String(row.player_id),
            team_abbr: row.team_abbr ?? null,
            full_name: row.players?.full_name,
          });
          participantsByGame.set(gid, arr);
        }
      } else {
        // Fallback: fetch without FK expansion, then lookup names separately
        const gpRaw = await supabase
          .from("game_participants")
          .select("game_id, player_id, team_abbr")
          .in("game_id", gameIds);

        if (!gpRaw.error && gpRaw.data?.length) {
          const ids = Array.from(new Set(gpRaw.data.map((r: any) => r.player_id)));
          const pRes = await supabase.from("players").select("player_id, full_name").in("player_id", ids);
          const nameMap = new Map<string, string>();
          for (const p of pRes.data ?? []) nameMap.set(String(p.player_id), p.full_name);

          for (const row of gpRaw.data as any[]) {
            const gid = String(row.game_id);
            const arr = participantsByGame.get(gid) ?? [];
            arr.push({
              player_id: String(row.player_id),
              team_abbr: row.team_abbr ?? null,
              full_name: nameMap.get(String(row.player_id)),
            });
            participantsByGame.set(gid, arr);
          }
        }
      }
    }

    const games = rawGames.map((g: any) => {
      const game_id = getGameId(g);
      return {
        id: String(game_id ?? g.id ?? ""),
        game_id: String(game_id ?? g.id ?? ""),
        home_team_abbr: getTeamCode(g, "home"),
        away_team_abbr: getTeamCode(g, "away"),
        commence_time: g.commence_time ?? g.start_time ?? g.commence ?? null,
        status: g.status ?? null,
        participants: game_id
          ? (participantsByGame.get(String(game_id)) ?? []).map((p) => ({
              player_id: p.player_id,
              team_abbr: p.team_abbr,
              players: { full_name: p.full_name ?? p.player_id },
            }))
          : [],
      };
    });

    return NextResponse.json({ ok: true, data: games }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}