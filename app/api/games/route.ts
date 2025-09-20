// app/api/games/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { normalizeTeamAbbr } from "@/lib/odds";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE!;

function easternBoundsToday() {
  // Build “today” in America/New_York, then return UTC ISO bounds
  const tz = "America/New_York";
  const now = new Date();

  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const [{ value: mm }, , { value: dd }, , { value: yyyy }] = fmt.formatToParts(now);
  // 00:00:00 ET to 24:00:00 ET
  const startLocal = new Date(`${yyyy}-${mm}-${dd}T00:00:00`);
  const endLocal = new Date(`${yyyy}-${mm}-${dd}T24:00:00`);

  // Convert “local ET clock time” to actual ET timestamps via toLocaleString w/ tz, then back to Date
  const startET = new Date(
    new Date(startLocal.toLocaleString("en-US", { timeZone: tz })).toISOString()
  );
  const endET = new Date(
    new Date(endLocal.toLocaleString("en-US", { timeZone: tz })).toISOString()
  );

  return { start: startET.toISOString(), end: endET.toISOString() };
}

export async function GET() {
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
      return NextResponse.json({ ok: false, error: "Supabase env not set" }, { status: 500 });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);
    const { start, end } = easternBoundsToday();

    const { data, error } = await supabase
      .from("games")
      .select("game_id, home_team, away_team, commence_time")
      .gte("commence_time", start)
      .lt("commence_time", end)
      .order("commence_time", { ascending: true });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const rows =
      (data ?? []).map((g: any) => {
        const homeAbbr = normalizeTeamAbbr(g.home_team).toLowerCase();
        const awayAbbr = normalizeTeamAbbr(g.away_team).toLowerCase();
        return {
          id: String(g.game_id),
          game_id: String(g.game_id),
          home_team_abbr: homeAbbr,
          away_team_abbr: awayAbbr,
          commence_time: g.commence_time, // ISO
        };
      }) ?? [];

    return NextResponse.json({ ok: true, data: rows }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
