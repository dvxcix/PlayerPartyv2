// app/api/players/[playerId]/odds/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { OddsSnapshot } from "@/lib/types";

function todayETString(d = new Date()) {
  return d.toLocaleDateString("en-US", { timeZone: "America/New_York" });
}

const MARKET_ALIASES = new Map<string, string[]>([
  ["batter_first_home_run", ["batter_first_home_run", "first_home_run", "batter_first_home_runs"]],
  ["batter_home_runs", ["batter_home_runs", "batter_home_run", "player_home_run"]],
]);

function wantedKeys(input: string | null): string[] {
  const k = (input || "").toLowerCase().trim();
  for (const [canonical, alts] of MARKET_ALIASES.entries()) {
    if (alts.includes(k)) return Array.from(new Set([canonical, ...alts]));
  }
  // default to HR market
  return MARKET_ALIASES.get("batter_home_runs")!;
}

function normBook(b: any): "fanduel" | "betmgm" | null {
  const s = String(b || "").toLowerCase().replace(/[\s_-]+/g, "");
  if (s === "fanduel" || s === "fd") return "fanduel";
  if (s === "betmgm" || s === "mgm") return "betmgm";
  return null;
}

export async function GET(req: Request, { params }: { params: { playerId: string } }) {
  try {
    const url = new URL(req.url);
    const marketParam = url.searchParams.get("market_key");
    const gameIdParam = url.searchParams.get("game_id");
    const dateParam = url.searchParams.get("date"); // optional YYYY-MM-DD in ET

    const playerId = params.playerId;
    if (!playerId) return NextResponse.json({ ok: false, error: "playerId required" }, { status: 400 });

    const keys = wantedKeys(marketParam);

    // Broad window fetch; filter to ET date server-side
    const now = new Date();
    const start = new Date(now.getTime() - 12 * 3600 * 1000).toISOString();
    const end = new Date(now.getTime() + 36 * 3600 * 1000).toISOString();

    let q = supabaseAdmin
      .from("odds_history")
      .select("captured_at, american_odds, bookmaker, player_id, game_id, market_key")
      .eq("player_id", playerId)
      .in("market_key", keys)
      .gte("captured_at", start)
      .lt("captured_at", end)
      .order("captured_at", { ascending: true });

    if (gameIdParam) q = q.eq("game_id", gameIdParam);

    const { data, error } = await q;
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    const wantET = dateParam || todayETString();
    const rows: OddsSnapshot[] =
      (data ?? [])
        .filter((r) => {
          const etDay = new Date(String(r.captured_at)).toLocaleDateString("en-US", {
            timeZone: "America/New_York",
          });
          return etDay === wantET;
        })
        .map((r) => {
          const book = normBook(r.bookmaker);
          const ao = Number(r.american_odds);
          const ts = new Date(String(r.captured_at)).toISOString();
          if (!book || !Number.isFinite(ao)) return null;
          return { captured_at: ts, american_odds: ao, bookmaker: book };
        })
        .filter(Boolean) as OddsSnapshot[];

    return NextResponse.json({ ok: true, data: rows }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
