// app/api/players/[playerId]/odds/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE!;

type Row = {
  captured_at: string;
  american_odds: number;
  bookmaker_key: string; // "fanduel" / "betmgm" (any casing in DB is fine)
  player_id: string;
  game_id: string | null;
  market_key: string;
};

function normalizeBook(b: string): "fanduel" | "betmgm" | null {
  const s = (b || "").toLowerCase().replace(/[\s_-]+/g, "");
  if (s.includes("fanduel") || s === "fd") return "fanduel";
  if (s.includes("betmgm") || s === "mgm") return "betmgm";
  return null;
}

export async function GET(
  req: Request,
  { params }: { params: { playerId: string } }
) {
  try {
    const url = new URL(req.url);
    const market_key = url.searchParams.get("market_key") || "batter_home_runs";
    const game_id = url.searchParams.get("game_id");

    if (!params.playerId) {
      return NextResponse.json({ ok: false, error: "playerId required" }, { status: 400 });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

    let q = supabase
      .from("odds_history")
      .select("captured_at, american_odds, bookmaker_key, player_id, game_id, market_key")
      .eq("player_id", params.playerId)
      .eq("market_key", market_key)
      .order("captured_at", { ascending: true });

    if (game_id) q = q.eq("game_id", game_id);

    const { data, error } = await q;
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const rows =
      (data as Row[]).map((r) => {
        const b = normalizeBook(r.bookmaker_key);
        if (!b) return null;
        const ao = Number(r.american_odds);
        const ts = Date.parse(r.captured_at);
        if (!Number.isFinite(ao) || !Number.isFinite(ts)) return null;
        return {
          captured_at: new Date(ts).toISOString(),
          american_odds: ao,
          bookmaker: b,
        };
      }).filter(Boolean) ?? [];

    return NextResponse.json({ ok: true, data: rows }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}