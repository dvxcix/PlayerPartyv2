// app/api/games/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

// Build ET day window [start, end)
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

  // Midnight ET for given day → convert to UTC ISO
  const startET = new Date(`${y}-${m}-${day}T00:00:00-04:00`); // -04:00 okay; DST shifts are fine for "today"
  const endET = new Date(`${y}-${m}-${day}T23:59:59.999-04:00`);
  return { startISO: startET.toISOString(), endISO: endET.toISOString() };
}

// Map full team names → abbr via teams table
async function buildTeamNameToAbbr(supabase: any) {
  const { data, error } = await supabase.from("teams").select("name, abbr");
  if (error) throw error;
  const map = new Map<string, string>();
  for (const row of data || []) {
    if (row?.name && row?.abbr) map.set(row.name.toLowerCase().trim(), row.abbr.toLowerCase().trim());
  }
  return (name: string | null | undefined) => {
    if (!name) return null;
    return map.get(name.toLowerCase().trim()) || null;
  };
}

export async function GET() {
  try {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE!);
    const { startISO, endISO } = getETBoundsISO(new Date());

    // Get today's games by commence_time
    const { data: games, error } = await supabase
      .from("games")
      .select("game_id, sport_key, game_date, commence_time, home_team, away_team")
      .gte("commence_time", startISO)
      .lte("commence_time", endISO)
      .order("commence_time", { ascending: true });

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    const toAbbr = await buildTeamNameToAbbr(supabase);

    const shaped = (games || []).map((g) => ({
      game_id: g.game_id,
      sport_key: g.sport_key,
      commence_time: g.commence_time,
      home_team: g.home_team,
      away_team: g.away_team,
      home_team_abbr: (toAbbr(g.home_team) || "").toLowerCase(),
      away_team_abbr: (toAbbr(g.away_team) || "").toLowerCase(),
    }));

    return NextResponse.json({ ok: true, data: shaped });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
