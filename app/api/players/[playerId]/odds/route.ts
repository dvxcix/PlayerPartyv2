// app/api/players/[player_id]/odds/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function getETBoundsISO(d = new Date()) {
  const et = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const y = et.find((p) => p.type === "year")!.value;
  const m = et.find((p) => p.type === "month")!.value;
  const day = et.find((p) => p.type === "day")!.value;
  const startET = new Date(`${y}-${m}-${day}T00:00:00-04:00`);
  const endET = new Date(`${y}-${m}-${day}T23:59:59.999-04:00`);
  return { startISO: startET.toISOString(), endISO: endET.toISOString() };
}

function normalizeBook(s: string) {
  const k = (s || "").toLowerCase().replace(/[\s._-]/g, "");
  if (k === "fd" || k.includes("fanduel")) return "fanduel";
  if (k === "mgm" || k.includes("betmgm") || k.includes("mgmresorts")) return "betmgm";
  return "fanduel";
}

export async function GET(req: NextRequest, { params }: { params: { player_id: string } }) {
  try {
    const player_id = decodeURIComponent(params.player_id);
    const url = new URL(req.url);
    const game_id = url.searchParams.get("game_id") || "";
    const market_key = url.searchParams.get("market_key") || "home_run";
    const outcome = url.searchParams.get("outcome"); // optional
    const { startISO, endISO } = getETBoundsISO(new Date());

    if (!player_id || !game_id) {
      return NextResponse.json({ ok: false, error: "Missing player_id or game_id" }, { status: 400 });
    }

    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE!);

    // Base query
    let q = supabase
      .from("odds_history")
      .select("player_id, game_id, bookmaker, american_odds, decimal_odds, captured_at, market_key, outcome")
      .eq("player_id", player_id)
      .eq("game_id", game_id)
      .eq("market_key", market_key)
      .gte("captured_at", startISO)
      .lte("captured_at", endISO)
      .order("captured_at", { ascending: true });

    if (outcome) q = q.eq("outcome", outcome);

    const { data, error } = await q;
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    const rows = (data || []).map((r) => ({
      ...r,
      bookmaker: normalizeBook(r.bookmaker),
    }));

    return NextResponse.json({ ok: true, data: rows });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
