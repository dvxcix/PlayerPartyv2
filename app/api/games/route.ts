// app/api/games/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE!;

export async function GET() {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

    // Get today's date only
    const today = new Date().toISOString().split("T")[0];

    const { data, error } = await supabase
      .from("games")
      .select("id, game_id, home_team_abbr, away_team_abbr, commence_time, participants")
      .gte("commence_time", `${today}T00:00:00Z`)
      .lte("commence_time", `${today}T23:59:59Z`)
      .order("commence_time", { ascending: true });

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, data }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
