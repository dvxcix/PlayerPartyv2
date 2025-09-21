// app/api/players/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function getETBoundsISO(d = new Date()) {
  const et = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const y = et.find((p) => p.type === "year")!.value;
  const m = et.find((p) => p.type === "month")!.value;
  const day = et.find((p) => p.type === "day")!.value;
  const startET = new Date(`${y}-${m}-${day}T00:00:00-04:00`);
  const endET = new Date(`${y}-${m}-${day}T23:59:59.999-04:00`);
  return { startISO: startET.toISOString(), endISO: endET.toISOString() };
}

export async function GET(req: NextRequest) {
  try {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE!);
    const { startISO, endISO } = getETBoundsISO(new Date());

    const url = new URL(req.url);
    const gameIdsParam = url.searchParams.get("game_ids"); // comma-separated

    // 1) Which games are today?
    const { data: games, error: gErr } = await supabase
      .from("games")
      .select("game_id, commence_time")
      .gte("commence_time", startISO)
      .lte("commence_time", endISO);

    if (gErr) return NextResponse.json({ ok: false, error: gErr.message }, { status: 500 });

    let todayGameIds = (games || []).map((g) => g.game_id);
    if (gameIdsParam) {
      const filterIds = gameIdsParam.split(",").map((s) => s.trim()).filter(Boolean);
      const set = new Set(filterIds);
      todayGameIds = todayGameIds.filter((id) => set.has(id));
    }

    if (!todayGameIds.length) return NextResponse.json({ ok: true, data: [] });

    // 2) Pull participants for those games
    const { data: parts, error: pErr } = await supabase
      .from("game_participants")
      .select("game_id, player_id, team_abbr, batting_order")
      .in("game_id", todayGameIds);

    if (pErr) return NextResponse.json({ ok: false, error: pErr.message }, { status: 500 });

    const playerIds = Array.from(new Set((parts || []).map((p) => p.player_id)));
    if (!playerIds.length) return NextResponse.json({ ok: true, data: [] });

    // 3) Pull player info
    const { data: players, error: plErr } = await supabase
      .from("players")
      .select("player_id, full_name, team_abbr")
      .in("player_id", playerIds);

    if (plErr) return NextResponse.json({ ok: false, error: plErr.message }, { status: 500 });

    const byPlayer = new Map(players!.map((r) => [r.player_id, r]));
    const rows = (parts || []).map((row) => {
      const p = byPlayer.get(row.player_id);
      return {
        player_id: row.player_id,
        full_name: p?.full_name || row.player_id,
        team_abbr: (row.team_abbr || p?.team_abbr || null)?.toLowerCase() || null,
        game_id: row.game_id,
        batting_order: row.batting_order ?? null,
      };
    });

    // Optional: order by team then batting_order then name
    rows.sort((a, b) => {
      const ta = a.team_abbr || "";
      const tb = b.team_abbr || "";
      if (ta !== tb) return ta.localeCompare(tb);
      const ba = a.batting_order ?? 999;
      const bb = b.batting_order ?? 999;
      if (ba !== bb) return ba - bb;
      return a.full_name.localeCompare(b.full_name);
    });

    return NextResponse.json({ ok: true, data: rows });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
