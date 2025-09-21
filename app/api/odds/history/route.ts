// app/api/odds/history/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE!;

type AnyRow = Record<string, any>;

function wantedKeys(input: string | null): string[] {
  const s = (input ?? "").toLowerCase();
  if (s === "batter_first_home_run" || s === "first_home_run" || s === "batter_first_home_runs") {
    return ["batter_first_home_run"];
  }
  return ["batter_home_run", "batter_home_runs", "player_home_run"];
}
function normBook(b: string): "fanduel" | "betmgm" | null {
  const s = (b || "").toLowerCase().replace(/[\s_-]+/g, "");
  if (s === "fanduel" || s === "fd") return "fanduel";
  if (s === "betmgm" || s === "mgm") return "betmgm";
  return null;
}

export async function GET(req: Request) {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);
    const url = new URL(req.url);

    const playersParam = url.searchParams.get("player_ids"); // comma-separated names/ids
    const gameIdParam = url.searchParams.get("game_id");     // single game id
    const gamesParam = url.searchParams.get("game_ids");     // comma-separated game ids
    const marketParam = url.searchParams.get("market_key");
    const outcomeParam = (url.searchParams.get("outcome") ?? "").toLowerCase(); // over/under/yes/no

    const player_ids = (playersParam ?? "")
      .split(",")
      .map(s => s.trim())
      .filter(Boolean);

    const keys = wantedKeys(marketParam);

    // Build query
    let q = supabase
      .from("odds_history")
      .select("captured_at, american_odds, bookmaker, player_id, game_id, market_key")
      .in("market_key", keys);

    if (player_ids.length) q = q.in("player_id", player_ids);

    // Filter to this/these game(s) – TODAY context comes from the caller /api/games
    if (gameIdParam) {
      q = q.eq("game_id", gameIdParam);
    } else if (gamesParam) {
      const gids = gamesParam.split(",").map(s => s.trim()).filter(Boolean);
      if (gids.length) q = q.in("game_id", gids);
    }

    const { data, error } = await q.order("captured_at", { ascending: true });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    // Optional: Outcome filtering by sign convention
    const passOutcome = (ao: number) => {
      if (!outcomeParam) return true;
      if (outcomeParam === "over" || outcomeParam === "yes") return ao >= 0;
      if (outcomeParam === "under" || outcomeParam === "no") return ao < 0;
      return true;
    };

    const rows =
      (data ?? [])
        .map((r: AnyRow) => {
          const b = normBook(String(r.bookmaker ?? ""));
          if (!b) return null;
          const ao = Number(r.american_odds);
          if (!Number.isFinite(ao)) return null;
          if (!passOutcome(ao)) return null;
          const ts = Date.parse(String(r.captured_at));
          if (!Number.isFinite(ts)) return null;
          return {
            captured_at: new Date(ts).toISOString(),
            american_odds: ao,
            bookmaker: b as "fanduel" | "betmgm",
            player_id: String(r.player_id),
            game_id: String(r.game_id),
          };
        })
        .filter(Boolean) ?? [];

    return NextResponse.json({ ok: true, data: rows }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
