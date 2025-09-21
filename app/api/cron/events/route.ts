import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { fetchMlbEvents, normalizeTeamAbbr } from "@/lib/odds";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const events = await fetchMlbEvents();
    let inserted = 0;

    for (const ev of events) {
      const game_id = String(ev.id);
      const commence_time = new Date(ev.commence_time).toISOString();
      const home_abbr = normalizeTeamAbbr(ev.home_team);
      const away_abbr = normalizeTeamAbbr(ev.away_team);

      await supabaseAdmin.from("teams").upsert(
        [{ abbr: home_abbr, team_id: home_abbr }, { abbr: away_abbr, team_id: away_abbr }],
        { onConflict: "abbr" }
      );

      const { error } = await supabaseAdmin.from("games").upsert(
        [{
          game_id,
          sport_key: "baseball_mlb",
          game_date: commence_time.slice(0, 10),
          commence_time,
          home_team: home_abbr,
          away_team: away_abbr,
        }],
        { onConflict: "game_id" }
      );
      if (error) throw error;
      inserted++;
    }

    return NextResponse.json({ ok: true, inserted });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
