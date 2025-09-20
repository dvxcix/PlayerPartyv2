// app/api/players/[playerId]/odds/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE!;

type AnyRow = Record<string, any>;

function wantedKeys(input: string | null): string[] {
  const s = (input ?? "").toLowerCase();
  if (
    s === "batter_first_home_run" ||
    s === "first_home_run" ||
    s === "batter_first_home_runs"
  ) {
    // support singular/plural/alias, but store as the canonical key
    return ["batter_first_home_run"];
  }
  // default to standard HR market; support both singular/plural + alias
  return ["batter_home_run", "batter_home_runs", "player_home_run"];
}

function normBook(b: string): "fanduel" | "betmgm" | null {
  const s = (b || "").toLowerCase().replace(/[\s_-]+/g, "");
  if (s === "fanduel" || s === "fd") return "fanduel";
  if (s === "betmgm" || s === "mgm") return "betmgm";
  return null;
}

export async function GET(
  req: Request,
  { params }: { params: { playerId: string } }
) {
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
      return NextResponse.json(
        { ok: false, error: "Supabase env not set" },
        { status: 500 }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

    const url = new URL(req.url);
    const marketParam = url.searchParams.get("market_key");
    const game_id = url.searchParams.get("game_id");
    const keys = wantedKeys(marketParam);

    const playerId = params.playerId;
    if (!playerId) {
      return NextResponse.json(
        { ok: false, error: "playerId required" },
        { status: 400 }
      );
    }

    let q = supabase
      .from("odds_history")
      .select("captured_at, american_odds, bookmaker, player_id, game_id, market_key")
      .eq("player_id", playerId)
      .in("market_key", keys)
      .order("captured_at", { ascending: true });

    if (game_id) q = q.eq("game_id", game_id);

    const { data, error } = await q;
    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    const rows =
      (data ?? [])
        .map((r: AnyRow) => {
          const b = normBook(String(r.bookmaker ?? ""));
          if (!b) return null;
          const ao = Number(r.american_odds);
          const ts = Date.parse(String(r.captured_at));
          if (!Number.isFinite(ao) || !Number.isFinite(ts)) return null;
          return {
            captured_at: new Date(ts).toISOString(),
            american_odds: ao,
            bookmaker: b as "fanduel" | "betmgm",
          };
        })
        .filter(Boolean) ?? [];

    return NextResponse.json({ ok: true, data: rows }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}
