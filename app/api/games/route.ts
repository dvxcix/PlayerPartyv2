// app/api/games/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function etDateString(d: Date) { return d.toLocaleDateString("en-US", { timeZone: "America/New_York" }); }

export async function GET() {
  try {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE!);
    const todayET = etDateString(new Date());

    const { data, error } = await supabase
      .from("games")
      .select("game_id, commence_time, home_team_abbr, away_team_abbr, home_team, away_team")
      .order("commence_time", { ascending: true });

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    const today = (data || []).filter((g) => {
      const et = new Date(g.commence_time).toLocaleDateString("en-US", { timeZone: "America/New_York" });
      return et === todayET;
    }).map(g => ({
      ...g,
      home_team_abbr: (g.home_team_abbr || "").toLowerCase(),
      away_team_abbr: (g.away_team_abbr || "").toLowerCase(),
    }));

    return NextResponse.json({ ok: true, data: today });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
