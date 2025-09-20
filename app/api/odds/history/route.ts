// app/api/odds/history/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE!;

type AnyRow = Record<string, any>;

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

    const playerIds = url.searchParams.get("player_ids")?.split(",") ?? [];
    const marketKey = url.searchParams.get("market_key") ?? "batter_home_runs";
    const gameId = url.searchParams.get("game_id");

    if (!playerIds.length)
      return NextResponse.json({ ok: false, error: "player_ids required" }, { status: 400 });

    let q = supabase
      .from("odds_history")
      .select("captured_at, american_odds, bookmaker, player_id, game_id, market_key")
      .in("player_id", playerIds)
      .eq("market_key", marketKey)
      .order("captured_at", { ascending: true });

    if (gameId) q = q.eq("game_id", gameId);

    const { data, error } = await q;
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    const rows =
      (data ?? [])
        .map((r: AnyRow) => {
          const b = normBook(String(r.bookmaker ?? ""));
          if (!b) return null;
          const ao = Number(r.american_odds);
          const ts = Date.parse(String(r.captured_at));
          if (!Number.isFinite(ao) || !Number.isFinite(ts)) return null;
          return {
            player_id: r.player_id,
            game_id: r.game_id,
            captured_at: new Date(ts).toISOString(),
            american_odds: ao,
            bookmaker: b as "fanduel" | "betmgm",
          };
        })
        .filter(Boolean) ?? [];

    return NextResponse.json({ ok: true, data: rows }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
