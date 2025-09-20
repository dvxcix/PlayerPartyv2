// app/api/games/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE!;

type AnyRow = Record<string, any>;

function startEndOfTodayET(): { startISO: string; endISO: string } {
  // “Today” in Eastern Time. We build an ET day window and convert to UTC ISO.
  const now = new Date();

  // Find current UTC offset for America/New_York by guessing with fixed table (no tz lib in edge).
  // We’ll approximate: EDT (Mar–early Nov) is UTC-4, otherwise UTC-5.
  const m = now.getUTCMonth() + 1; // 1..12
  const isEDT = m >= 3 && m <= 11; // coarse but fine for day filtering
  const offset = isEDT ? -4 : -5;

  const toISO = (y: number, mo: number, d: number, hh: number, mm: number, ss: number) => {
    // Build a Date as if it were ET, then convert to UTC ISO by subtracting offset
    const dt = new Date(Date.UTC(y, mo, d, hh - offset, mm, ss));
    return dt.toISOString();
  };

  const y = now.getUTCFullYear();
  const mo = now.getUTCMonth();
  // Convert now to ET date components
  const et = new Date(now.getTime() + offset * 60 * 60 * 1000);
  const etY = et.getUTCFullYear();
  const etM = et.getUTCMonth();
  const etD = et.getUTCDate();

  const startISO = toISO(etY, etM, etD, 0, 0, 0);
  const endISO = toISO(etY, etM, etD, 23, 59, 59);
  return { startISO, endISO };
}

export async function GET() {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);
    const { startISO, endISO } = startEndOfTodayET();

    // 1) Pull today's games only (by commence_time)
    const { data: games, error: gErr } = await supabase
      .from("games")
      .select("id, game_id, home_team_abbr, away_team_abbr, commence_time, status")
      .gte("commence_time", startISO)
      .lte("commence_time", endISO)
      .order("commence_time", { ascending: true });

    if (gErr) {
      return NextResponse.json({ ok: false, error: gErr.message }, { status: 500 });
    }

    const ids = (games ?? []).map((g: AnyRow) => g.game_id);
    if (!ids.length) {
      return NextResponse.json({ ok: true, games: [] }, { status: 200 });
    }

    // 2) Pull participants and join players for names
    const { data: parts, error: pErr } = await supabase
      .from("game_participants")
      .select("game_id, player_id, team_abbr, players(full_name)")
      .in("game_id", ids);

    if (pErr) {
      return NextResponse.json({ ok: false, error: pErr.message }, { status: 500 });
    }

    // Group participants by game_id
    const byGame: Record<string, AnyRow[]> = {};
    for (const r of parts ?? []) {
      const gid = String(r.game_id);
      (byGame[gid] ||= []).push(r);
    }

    const shaped = (games ?? []).map((g: AnyRow) => {
      const home = String(g.home_team_abbr || "").toLowerCase();
      const away = String(g.away_team_abbr || "").toLowerCase();
      return {
        id: g.id,
        game_id: String(g.game_id),
        home_team_abbr: home,
        away_team_abbr: away,
        commence_time: g.commence_time,
        status: g.status ?? null,
        participants: (byGame[g.game_id] ?? []).map((p: AnyRow) => ({
          player_id: String(p.player_id),
          team_abbr: String(p.team_abbr || "").toUpperCase(),
          players: { full_name: p.players?.full_name ?? String(p.player_id) },
        })),
      };
    });

    return NextResponse.json({ ok: true, games: shaped }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
