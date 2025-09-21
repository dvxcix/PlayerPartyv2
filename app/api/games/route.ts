// app/api/games/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { ApiGame } from "@/lib/types";

function dateStringET(d: Date) {
  return d.toLocaleDateString("en-US", { timeZone: "America/New_York" });
}

export async function GET(req: Request) {
  try {
    const todayET = dateStringET(new Date());

    // Broad time window in UTC to catch all ET games around "today"
    const now = new Date();
    const start = new Date(now.getTime() - 12 * 3600 * 1000).toISOString();
    const end = new Date(now.getTime() + 36 * 3600 * 1000).toISOString();

    const { data, error } = await supabaseAdmin
      .from("games")
      .select("id, game_id, home_team_abbr, away_team_abbr, commence_time")
      .gte("commence_time", start)
      .lt("commence_time", end)
      .order("commence_time", { ascending: true });

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    const rows = (data ?? []).filter((g) => {
      const etDay = dateStringET(new Date(String(g.commence_time)));
      return etDay === todayET;
    });

    // Normalize abbrs to uppercase for logos/consistency.
    const games: ApiGame[] = rows.map((g) => ({
      ...g,
      home_team_abbr: String(g.home_team_abbr || "").toUpperCase(),
      away_team_abbr: String(g.away_team_abbr || "").toUpperCase(),
    }));

    return NextResponse.json({ ok: true, data: games }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
