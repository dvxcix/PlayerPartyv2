// app/api/players/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE!;

function easternBoundsToday() {
  const tz = "America/New_York";
  const now = new Date();

  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const [{ value: mm }, , { value: dd }, , { value: yyyy }] = fmt.formatToParts(now);
  const startLocal = new Date(`${yyyy}-${mm}-${dd}T00:00:00`);
  const endLocal = new Date(`${yyyy}-${mm}-${dd}T24:00:00`);
  const startET = new Date(
    new Date(startLocal.toLocaleString("en-US", { timeZone: "America/New_York" })).toISOString()
  );
  const endET = new Date(
    new Date(endLocal.toLocaleString("en-US", { timeZone: "America/New_York" })).toISOString()
  );
  return { start: startET.toISOString(), end: endET.toISOString() };
}

export async function GET(req: Request) {
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
      return NextResponse.json({ ok: false, error: "Supabase env not set" }, { status: 500 });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);
    const url = new URL(req.url);
    const gameIdsParam = url.searchParams.get("game_ids");
    const gameIds = gameIdsParam
      ? gameIdsParam.split(",").map((s) => s.trim()).filter(Boolean)
      : [];

    if (gameIds.length > 0) {
      // Players for selected games
      const { data, error } = await supabase
        .from("game_participants")
        .select("player_id, team_abbr, players(full_name)")
        .in("game_id", gameIds);

      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

      // de-dupe by player_id while preserving name
      const map = new Map<string, { player_id: string; full_name: string }>();
      for (const r of data ?? []) {
        const pid = String(r.player_id);
        const name = r.players?.full_name ?? String(r.player_id);
        if (!map.has(pid)) map.set(pid, { player_id: pid, full_name: name });
      }
      return NextResponse.json({ ok: true, data: Array.from(map.values()) }, { status: 200 });
    }

    // No games selected → all players for *today’s* games
    const { start, end } = easternBoundsToday();
    const { data, error } = await supabase
      .from("game_participants")
      .select("player_id, players(full_name), games!inner(commence_time)")
      .gte("games.commence_time", start)
      .lt("games.commence_time", end);

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    const map = new Map<string, { player_id: string; full_name: string }>();
    for (const r of data ?? []) {
      const pid = String(r.player_id);
      const name = r.players?.full_name ?? String(r.player_id);
      if (!map.has(pid)) map.set(pid, { player_id: pid, full_name: name });
    }

    return NextResponse.json({ ok: true, data: Array.from(map.values()) }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
