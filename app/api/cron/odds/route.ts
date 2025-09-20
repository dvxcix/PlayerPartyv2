// app/api/cron/odds/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE!;
const THEODDSAPI_KEY = process.env.THEODDSAPI_KEY!;
const BOOKS = ["fanduel", "betmgm"] as const;
const SPORT = "baseball_mlb";

type BookKey = (typeof BOOKS)[number];

type OddsAPIPrice = {
  price: number; // american odds number (can be negative)
  point?: number | null; // for OU markets
};

type OddsAPIOutcome = {
  name: string; // player name or "Over"/"Under"/"Yes"/"No" context-dependent
  description?: string | null; // TheOddsAPI uses description for player name on player props
  price: number; // american odds
  point?: number | null;
};

type OddsAPIMarket = {
  key: "batter_home_runs" | "batter_first_home_run";
  outcomes: OddsAPIOutcome[];
};

type OddsAPIBookmaker = {
  key: string; // "fanduel", "betmgm", etc.
  markets: OddsAPIMarket[];
};

type OddsAPIEvent = {
  id: string; // event id
  bookmakers: OddsAPIBookmaker[];
};

function isBookWanted(key: string): key is BookKey {
  const s = key.toLowerCase().replace(/[\s_-]+/g, "");
  if (s === "fanduel") return true;
  if (s === "betmgm" || s === "mgm") return true;
  return false;
}

// Return ET midnight start/end ISO for “today”
function getETDayRange() {
  const tz = "America/New_York";
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
    .formatToParts(now)
    .reduce<Record<string, string>>((acc, p) => {
      if (p.type !== "literal") acc[p.type] = p.value;
      return acc;
    }, {});
  const yyyy = Number(parts.year);
  const mm = Number(parts.month);
  const dd = Number(parts.day);
  const start = new Date(Date.UTC(yyyy, mm - 1, dd, 0, 0, 0));
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  const toISO = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString();
  return { startISO: toISO(start), endISO: toISO(end) };
}

export async function GET() {
  if (!THEODDSAPI_KEY) {
    return NextResponse.json({ ok: false, error: "Missing THEODDSAPI_KEY" }, { status: 500 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);
  const { startISO, endISO } = getETDayRange();

  // 1) Pull only TODAY’s games from DB
  const { data: games, error: gErr } = await supabase
    .from("games")
    .select("game_id, commence_time")
    .gte("commence_time", startISO)
    .lt("commence_time", endISO)
    .order("commence_time", { ascending: true });

  if (gErr) {
    return NextResponse.json({ ok: false, error: `Games query failed: ${gErr.message}` }, { status: 500 });
  }

  if (!games?.length) {
    return NextResponse.json({ ok: true, message: "No games today in ET window.", inserted: 0 });
  }

  const marketsWanted = ["batter_home_runs", "batter_first_home_run"] as const;

  let eventsProcessed = 0;
  let snapshotsInserted = 0;

  for (const game of games) {
    const eventId = String(game.game_id);

    // 2) Fetch event odds for the two markets (player props)
    const url = new URL(`https://api.the-odds-api.com/v4/sports/${SPORT}/events/${eventId}/odds`);
    url.searchParams.set("apiKey", THEODDSAPI_KEY);
    url.searchParams.set("markets", marketsWanted.join(","));
    url.searchParams.set("bookmakers", BOOKS.join(","));
    url.searchParams.set("oddsFormat", "american");
    url.searchParams.set("dateFormat", "iso");

    let eventPayload: OddsAPIEvent | null = null;

    try {
      const resp = await fetch(url.toString(), { cache: "no-store" });
      if (resp.status === 404) {
        // Skip gracefully — not all events have these props live yet
        eventsProcessed++;
        continue;
      }
      if (!resp.ok) {
        const txt = await resp.text();
        // Skip this event but continue
        eventsProcessed++;
        continue;
      }
      const json = (await resp.json()) as OddsAPIEvent;
      eventPayload = json;
    } catch {
      // Network hiccup — skip this event
      eventsProcessed++;
      continue;
    }

    if (!eventPayload?.bookmakers?.length) {
      eventsProcessed++;
      continue;
    }

    // 3) Iterate bookmakers and markets
    for (const bk of eventPayload.bookmakers) {
      if (!isBookWanted(bk.key)) continue;
      const bookmaker_key = bk.key.toLowerCase().includes("mgm") ? "betmgm" : "fanduel";

      for (const mkt of bk.markets ?? []) {
        if (!marketsWanted.includes(mkt.key)) continue;

        // Ensure the market exists in our markets table
        await supabase
          .from("markets")
          .upsert(
            [{ market_key: mkt.key, name: mkt.key.replaceAll("_", " ") }],
            { onConflict: "market_key" }
          );

        // Outcomes: for these markets, TheOddsAPI sets player name in `description` (or sometimes `name`)
        for (const oc of mkt.outcomes ?? []) {
          const american_odds = Number(oc.price);
          if (!Number.isFinite(american_odds)) continue;

          const rawName = (oc.description ?? oc.name ?? "").trim();
          if (!rawName) continue;

          // Attempt to map the outcome to a player_id by exact or loose match
          // (keeps same style you had before, but safe if no match — we still store odds row with null player)
          let player_id: string | null = null;

          // exact match
          if (rawName) {
            const { data: match } = await supabase
              .from("players")
              .select("player_id, full_name")
              .ilike("full_name", rawName)
              .limit(1)
              .maybeSingle();

            if (match?.player_id) {
              player_id = String(match.player_id);
            } else {
              // loose match: strip punctuation, compare lowercased
              const cleaned = rawName.toLowerCase().replace(/[^\w\s]/g, "").trim();
              const { data: loose } = await supabase
                .from("players")
                .select("player_id, full_name")
                .limit(20);
              const found = (loose ?? []).find((p) =>
                (p.full_name ?? "")
                  .toLowerCase()
                  .replace(/[^\w\s]/g, "")
                  .trim() === cleaned
              );
              if (found) player_id = String(found.player_id);
            }
          }

          // 4) Upsert full-odds row & append to odds_history
          const nowISO = new Date().toISOString();
          const oddsRow = {
            game_id: eventId,
            market_key: mkt.key,
            bookmaker_key,
            player_id, // can be null if we didn’t match — history still useful
            american_odds,
            captured_at: nowISO,
          };

          // odds (latest snapshot per (game,market,book,player))
          await supabase
            .from("odds")
            .upsert([oddsRow], {
              onConflict: "game_id,market_key,bookmaker_key,player_id",
            });

          // odds_history (append-only)
          await supabase.from("odds_history").insert([oddsRow]);

          snapshotsInserted++;
        }
      }
    }

    eventsProcessed++;
  }

  return NextResponse.json(
    { ok: true, eventsProcessed, snapshotsInserted },
    { status: 200 }
  );
}