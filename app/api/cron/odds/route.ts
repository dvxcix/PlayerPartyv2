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

// Ingest these two markets (FD/MGM only)
const TARGET_MARKETS = ["batter_home_runs", "batter_first_home_run"] as const;
type TargetMarket = typeof TARGET_MARKETS[number];

async function ensureMarkets() {
  const rows = TARGET_MARKETS.map((k) => ({
    market_key: k,
    description:
      k === "batter_home_runs"
        ? "Batter home runs (Over/Under)"
        : "Batter first home run (Yes/No)",
  }));
  const { error } = await supabaseAdmin
    .from("markets")
    .upsert(rows, { onConflict: "market_key" });
  if (error) throw error;
}

export async function GET() {
  try {
    // Make sure FK targets exist BEFORE we write odds/odds_history
    await ensureMarkets();

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
      // Hit per-event endpoint for BOTH markets; filter to FanDuel + BetMGM at the API level
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
            // Player identification from props outcome payload
            const playerName = outcome.description || outcome.name || outcome.player_name;
            const playerId = String(outcome.player_id || playerName);
            const american_odds = Number(outcome.price ?? outcome.american_odds ?? outcome.odds);
            if (!Number.isFinite(american_odds)) continue; // skip malformed odds
            const decimal_odds = americanToDecimal(american_odds);
            const teamGuess = normalizeTeamAbbr(outcome.team ?? g.home_team);

            // Ensure player
            const { error: pErr } = await supabaseAdmin.from("players").upsert(
              [{ player_id: playerId, full_name: playerName, team_abbr: teamGuess }],
              { onConflict: "player_id" }
            );
            if (pErr) throw pErr; else newPlayers++;

            // Ensure participant link
            await supabaseAdmin.from("game_participants").upsert(
              [{ game_id: g.game_id, player_id: playerId, team_abbr: teamGuess }],
              { onConflict: "game_id,player_id" }
            );

            // Current odds snapshot (FK depends on markets being present)
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

            // Historical point
            const { error: hErr } = await supabaseAdmin.from("odds_history").insert([{
              market_key,
              player_id: playerId,
              game_id: g.game_id,
              bookmaker,
              american_odds,
              decimal_odds,
            }]);
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
