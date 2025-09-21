// app/api/players/[player_id]/odds/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

// ---- ET day window [start, end) ----
function getETBoundsISO(d = new Date()) {
  // NOTE: Using -04:00 works during EDT; for simplicity we keep -04:00 all season here.
  // If you want exact DST handling year-round, swap to luxon or directly compute with Intl & Date.UTC.
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")!.value;
  const m = parts.find((p) => p.type === "month")!.value;
  const day = parts.find((p) => p.type === "day")!.value;
  const startET = new Date(`${y}-${m}-${day}T00:00:00-04:00`);
  const endET = new Date(`${y}-${m}-${day}T23:59:59.999-04:00`);
  return { startISO: startET.toISOString(), endISO: endET.toISOString() };
}

// ---- Normalize sportsbook and market keys ----
function normalizeBook(s: string) {
  const k = (s || "").toLowerCase().replace(/[\s._-]/g, "");
  if (k === "fd" || k.includes("fanduel")) return "fanduel";
  if (k === "mgm" || k.includes("betmgm") || k.includes("mgmresorts")) return "betmgm";
  return "fanduel";
}

// Accepted UI keys → list of DB aliases we’ll try in order
const MARKET_ALIASES: Record<string, string[]> = {
  home_run: [
    "home_run", "hr", "anytime_hr", "hr_anytime", "home_run_anytime", "to_hit_hr",
  ],
  first_home_run: [
    "first_home_run", "first_hr", "hr_first", "to_hit_first_hr", "firsttohithr",
  ],
};

type Row = {
  player_id: string;
  game_id: string;
  bookmaker: string;
  american_odds: number | null;
  decimal_odds?: number | null;
  captured_at: string; // ISO
  market_key: string;
  outcome?: string | null;
};

export async function GET(req: NextRequest, { params }: { params: { player_id: string } }) {
  try {
    const player_id = decodeURIComponent(params.player_id);
    const url = new URL(req.url);
    const game_id = url.searchParams.get("game_id") || "";
    const market_key_ui = (url.searchParams.get("market_key") || "home_run").toLowerCase();
    const outcome = url.searchParams.get("outcome"); // optional
    const { startISO, endISO } = getETBoundsISO(new Date());

    if (!player_id || !game_id) {
      return NextResponse.json({ ok: false, error: "Missing player_id or game_id" }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE!
    );

    // Build list of market keys we’ll try, in order
    const aliases = MARKET_ALIASES[market_key_ui] || [market_key_ui];

    // 1) Try odds_history for today (preferred: real history)
    for (const mk of aliases) {
      let q = supabase
        .from("odds_history")
        .select("player_id, game_id, bookmaker, american_odds, decimal_odds, captured_at, market_key, outcome")
        .eq("player_id", player_id)
        .eq("game_id", game_id)
        .eq("market_key", mk)
        .gte("captured_at", startISO)
        .lte("captured_at", endISO)
        .order("captured_at", { ascending: true });
      if (outcome) q = q.eq("outcome", outcome);

      const { data, error } = await q;
      if (error) {
        // keep trying other mk values if a column-level error occurs; otherwise bubble after loop
        continue;
      }
      if (data && data.length) {
        const rows: Row[] = data.map((r) => ({ ...r, bookmaker: normalizeBook(r.bookmaker) }));
        return NextResponse.json({ ok: true, data: rows });
      }
    }

    // 2) Fallback: use current odds table within today’s window
    //    (gives at least one point per bookmaker; chart will render a constant/flat line)
    for (const mk of aliases) {
      let q2 = supabase
        .from("odds")
        .select("player_id, game_id, bookmaker, american_odds, decimal_odds, updated_at, market_key")
        .eq("player_id", player_id)
        .eq("game_id", game_id)
        .eq("market_key", mk)
        .gte("updated_at", startISO)
        .lte("updated_at", endISO)
        .order("updated_at", { ascending: true });

      const { data: cur, error: e2 } = await q2;
      if (!e2 && cur && cur.length) {
        const rows: Row[] = cur.map((r: any) => ({
          player_id: r.player_id,
          game_id: r.game_id,
          bookmaker: normalizeBook(r.bookmaker),
          american_odds: r.american_odds ?? null,
          decimal_odds: r.decimal_odds ?? null,
          captured_at: r.updated_at, // adapt to chart shape
          market_key: r.market_key,
          outcome: null,
        }));
        return NextResponse.json({ ok: true, data: rows });
      }
    }

    // 3) Still nothing: return empty
    return NextResponse.json({ ok: true, data: [] });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
