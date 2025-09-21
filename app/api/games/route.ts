// app/api/games/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { ApiGame } from "@/lib/types";

function etDateString(d: Date) {
  return d.toLocaleDateString("en-US", { timeZone: "America/New_York" });
}

export async function GET() {
  try {
    const todayET = etDateString(new Date());

    // Broad UTC window; we’ll filter to ET “today” in code (DST-safe)
    const now = new Date();
    const start = new Date(now.getTime() - 12 * 3600 * 1000).toISOString();
    const end = new Date(now.getTime() + 36 * 3600 * 1000).toISOString();

    const { data, error } = await supabaseAdmin
      .from("games")
      .select("game_id, commence_time, home_team, away_team")
      .gte("commence_time", start)
      .lt("commence_time", end)
      .order("commence_time", { ascending: true });

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    const rows = (data ?? []).filter((g) => {
      const etDay = etDateString(new Date(String(g.commence_time)));
      return etDay === todayET;
    });

    const games: ApiGame[] = rows.map((g) => ({
      game_id: String(g.game_id),
      commence_time: new Date(String(g.commence_time)).toISOString(),
      home_team: (g.home_team ?? null) && String(g.home_team).toUpperCase(),
      away_team: (g.away_team ?? null) && String(g.away_team).toUpperCase(),
    }));

    return NextResponse.json({ ok: true, data: games }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
