// app/api/players/[player_id]/odds/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function normalizeBook(s: string) {
  const k = (s || "").toLowerCase().replace(/[\s._-]/g, "");
  if (k === "fd" || k.includes("fanduel")) return "fanduel";
  if (k === "mgm" || k.includes("betmgm") || k.includes("mgmresorts")) return "betmgm";
  return "fanduel";
}

function isSameETDate(ts: string | Date, etDateStr: string) {
  const d = new Date(ts);
  const et = d.toLocaleDateString("en-US", { timeZone: "America/New_York" });
  return et === etDateStr;
}

export async function GET(req: NextRequest, { params }: { params: { player_id: string } }) {
  try {
    const player_id = decodeURIComponent(params.player_id);
    const url = new URL(req.url);
    const game_id = url.searchParams.get("game_id") || "";
    const market_key = url.searchParams.get("market_key") || "home_run";
    const dateET = url.searchParams.get("date"); // e.g., "9/20/2025"

    if (!player_id || !game_id || !dateET) {
      return NextResponse.json({ ok: false, error: "Missing player_id, game_id, or date" }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE!
    );

    // Prefer hr_odds; fallback odds_history if your schema uses that name
    // Columns expected: player_id, game_id, bookmaker, american_odds, captured_at, market_key
    const { data, error } = await supabase
      .from("hr_odds")
      .select("player_id, game_id, bookmaker, american_odds, captured_at, market_key")
      .eq("player_id", player_id)
      .eq("game_id", game_id)
      .eq("market_key", market_key)
      .order("captured_at", { ascending: true });

    if (error) {
      // fallback table name
      const fb = await supabase
        .from("odds_history")
        .select("player_id, game_id, bookmaker, american_odds, captured_at, market_key")
        .eq("player_id", player_id)
        .eq("game_id", game_id)
        .eq("market_key", market_key)
        .order("captured_at", { ascending: true });
      if (fb.error) return NextResponse.json({ ok: false, error: fb.error.message }, { status: 500 });
      const filtered = (fb.data || []).filter((r) => isSameETDate(r.captured_at, dateET));
      const normed = filtered.map((r) => ({ ...r, bookmaker: normalizeBook(r.bookmaker) }));
      return NextResponse.json({ ok: true, data: normed });
    }

    const filtered = (data || []).filter((r) => isSameETDate(r.captured_at, dateET));
    const normed = filtered.map((r) => ({ ...r, bookmaker: normalizeBook(r.bookmaker) }));
    return NextResponse.json({ ok: true, data: normed });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
