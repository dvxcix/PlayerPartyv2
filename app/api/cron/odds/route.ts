// app/api/cron/odds/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  fetchMlbEventProps,
  americanToDecimal,
  normalizeTeamAbbr,
  ALLOWED_BOOKS,
} from "@/lib/odds";

export const dynamic = "force-dynamic";

// The markets we ingest (toggle-able in UI later)
const TARGET_MARKETS = ["batter_home_runs", "batter_first_home_run"] as const;
type TargetMarket = typeof TARGET_MARKETS[number];

export async function GET() {
  try {
    // Pull games in a +/- window to cover today's slate
    const now = new Date();
    const start = new Date(now.getTime() - 12 * 60 * 60 * 1000).toISOString();
    const end   = new Date(now.getTime() + 36 * 60 * 60 * 1000).toISOString();

    const { data: games, error: gErr } = await supabaseAdmin
      .from("games")
      .select("game_id, commence_time, home_team, away_team")
      .gte("commence_time", start)
      .lte("commence_time", end)
      .order("commence_time");
    if (gErr) throw gErr;

    let upserts = 0, snapshots = 0, newPlayers = 0, emptyEvents = 0;

    for (const g of games ?? []) {
      // Fetch both markets for this event (FD/MGM)
      const payload = await fetchMlbEventProps(g.game_id, TARGET_MARKETS as unknown as string[]);

      const bookmakers = payload?.bookmakers ?? [];
      if (!bookmakers.length) { emptyEvents++; continue; }

      for (const book of bookmakers) {
        const bookmaker = String(book.key).toLowerCase();
        if (!ALLOWED_BOOKS.includes(bookmaker)) continue;

        for (const mk of book.markets ?? []) {
          const market_key: TargetMarket = mk.key;
          if (!TARGET_MARKETS.includes(market_key)) continue;

          for (const outcome of mk.outcomes ?? []) {
            // The v4 props payload typically exposes the player name in description/name
            const playerName = outcome.description || outcome.name || outcome.player_name;
            const playerId = String(outcome.player_id || playerName);
            const american_odds = Number(outcome.price ?? outcome.american_odds ?? outcome.odds);
            const decimal_odds = americanToDecimal(american_odds);
            const teamGuess = normalizeTeamAbbr(outcome.team ?? g.home_team);

            // upsert player
            const { error: pErr } = await supabaseAdmin.from("players").upsert(
              [{ player_id: playerId, full_name: playerName, team_abbr: teamGuess }],
              { onConflict: "player_id" }
            );
            if (pErr) throw pErr; else newPlayers++;

            // link participant
            await supabaseAdmin.from("game_participants").upsert(
              [{ game_id: g.game_id, player_id: playerId, team_abbr: teamGuess }],
              { onConflict: "game_id,player_id" }
            );

            // current odds
            const { error: oErr } = await supabaseAdmin.from("odds").upsert(
              [{
                market_key,
                player_id: playerId,
                game_id: g.game_id,
                bookmaker,
                american_odds,
                decimal_odds,
              }],
              { onConflict: "market_key,player_id,game_id,bookmaker" }
            );
            if (oErr) throw oErr; else upserts++;

            // history snapshot
            const { error: hErr } = await supabaseAdmin.from("odds_history").insert(
              [{ market_key, player_id: playerId, game_id: g.game_id, bookmaker, american_odds, decimal_odds }]
            );
            if (hErr) throw hErr; else snapshots++;
          }
        }
      }
    }

    return NextResponse.json({ ok: true, upserts, snapshots, newPlayers, emptyEvents });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
