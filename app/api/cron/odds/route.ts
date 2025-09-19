import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { fetchMlbPlayerHomeRunOdds, americanToDecimal, normalizeTeamAbbr, ALLOWED_BOOKS } from "@/lib/odds";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const payload = await fetchMlbPlayerHomeRunOdds();
    let upserts = 0, snapshots = 0, newPlayers = 0;

    for (const game of payload) {
      const game_id = String(game.id ?? game.event_id ?? `${game.home_team}-${game.away_team}-${game.commence_time}`);
      const commence_time = new Date(game.commence_time).toISOString();
      const home_abbr = normalizeTeamAbbr(game.home_team);
      const away_abbr = normalizeTeamAbbr(game.away_team);

      await supabaseAdmin.from("games").upsert(
        [{ game_id, sport_key: "baseball_mlb", game_date: commence_time.slice(0,10), commence_time, home_team: home_abbr, away_team: away_abbr }],
        { onConflict: "game_id" }
      );

      for (const book of (game.bookmakers ?? []).filter((b: any) => ALLOWED_BOOKS.includes(b.key?.toLowerCase()))) {
        const bookmaker = book.key.toLowerCase(); // 'fanduel' | 'betmgm'
        const market = (book.markets ?? []).find((m: any) => m.key === "player_home_run");
        if (!market) continue;
        for (const outcome of market.outcomes ?? []) {
          const playerName = outcome.description || outcome.name || outcome.player_name;
          const playerId = String(outcome.player_id || playerName);
          const american_odds = Number(outcome.price ?? outcome.american_odds ?? outcome.odds);
          const decimal_odds = americanToDecimal(american_odds);

          const { error: pErr } = await supabaseAdmin.from("players").upsert(
            [{ player_id: playerId, full_name: playerName, team_abbr: normalizeTeamAbbr(outcome.team ?? game.home_team) }],
            { onConflict: "player_id" }
          );
          if (pErr) throw pErr; else newPlayers++;

          await supabaseAdmin.from("game_participants").upsert(
            [{ game_id, player_id: playerId, team_abbr: normalizeTeamAbbr(outcome.team ?? game.home_team) }],
            { onConflict: "game_id,player_id" }
          );

          const { error: oErr } = await supabaseAdmin.from("odds").upsert(
            [{ market_key: "player_home_run", player_id: playerId, game_id, bookmaker, american_odds, decimal_odds }],
            { onConflict: "market_key,player_id,game_id,bookmaker" }
          );
          if (oErr) throw oErr; else upserts++;

          const { error: hErr } = await supabaseAdmin.from("odds_history").insert(
            [{ market_key: "player_home_run", player_id: playerId, game_id, bookmaker, american_odds, decimal_odds }]
          );
          if (hErr) throw hErr; else snapshots++;
        }
      }
    }

    return NextResponse.json({ ok: true, upserts, snapshots, newPlayers });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
