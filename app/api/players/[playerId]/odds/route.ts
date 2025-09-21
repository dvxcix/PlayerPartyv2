// app/api/players/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE!;

// Compute today's window in Eastern Time (00:00:00–23:59:59)
function todayETWindow() {
  const now = new Date();
  // Offset New York manually to avoid deps; this is "good enough" for app usage
  const est = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .formatToParts(now)
    .reduce((acc: any, p) => ((acc[p.type] = p.value), acc), {} as any);

  const y = Number(est.year);
  const m = Number(est.month);
  const d = Number(est.day);
  const startET = new Date(Date.UTC(y, m - 1, d, 5, 0, 0)); // 00:00 ET == 05:00 UTC (non-DST safe enough)
  const endET = new Date(Date.UTC(y, m - 1, d + 1, 4, 59, 59, 999)); // 23:59:59.999 ET

  return { startISO: startET.toISOString(), endISO: endET.toISOString() };
}

export async function GET(req: Request) {
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
      return NextResponse.json({ ok: false, error: "Supabase env not set" }, { status: 500 });
    }
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

    const url = new URL(req.url);
    const gameIdsParam = url.searchParams.get("game_ids");
    const gameIds = (gameIdsParam ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const { startISO, endISO } = todayETWindow();

    // First, get today's games
    const gq = supabase
      .from("games")
      .select("game_id, commence_time, home_team, away_team")
      .gte("commence_time", startISO)
      .lte("commence_time", endISO);

    const { data: games, error: gErr } = await gq;
    if (gErr) return NextResponse.json({ ok: false, error: gErr.message }, { status: 500 });

    const todaysIds = new Set((games ?? []).map((g: any) => String(g.game_id)));

    // Use only valid today game_ids (if client sent any)
    const activeIds =
      gameIds.length > 0 ? gameIds.filter((id) => todaysIds.has(id)) : Array.from(todaysIds);

    if (activeIds.length === 0) {
      return NextResponse.json({ ok: true, players: [] }, { status: 200 });
    }

    // Pull participants for those games
    const { data: parts, error: pErr } = await supabase
      .from("game_participants")
      .select("game_id, player_id, team_abbr, players(full_name)")
      .in("game_id", activeIds);

    if (pErr) return NextResponse.json({ ok: false, error: pErr.message }, { status: 500 });

    // Deduplicate by (player_id, game_id)
    const seen = new Set<string>();
    const players = [];
    for (const r of parts ?? []) {
      const pid = String(r.player_id);
      const gid = String(r.game_id);
      const key = `${pid}|${gid}`;
      if (seen.has(key)) continue;
      seen.add(key);
      players.push({
        player_id: pid,
        full_name: r.players?.full_name ?? pid,
        team_abbr: r.team_abbr ?? null,
        game_id: gid, // IMPORTANT: tie each player to the game they belong to
      });
    }

    // Sort players by name for UX
    players.sort((a, b) => a.full_name.localeCompare(b.full_name));

    return NextResponse.json({ ok: true, players }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
