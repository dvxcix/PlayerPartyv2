// app/api/players/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { PlayerListItem } from "@/lib/types";

function toETDateString(d: Date) {
  return d.toLocaleDateString("en-US", { timeZone: "America/New_York" });
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const gameIdsParam = url.searchParams.get("game_ids"); // comma-separated game_ids (optional)

    const todayET = toETDateString(new Date());

    // Wide window then filter by ET day on the server
    const now = new Date();
    const start = new Date(now.getTime() - 12 * 3600 * 1000).toISOString();
    const end = new Date(now.getTime() + 36 * 3600 * 1000).toISOString();

    let q = supabaseAdmin
      .from("game_participants")
      .select("game_id, player_id, team_abbr, players!inner(full_name), games!inner(commence_time)")
      .gte("games.commence_time", start)
      .lt("games.commence_time", end);

    if (gameIdsParam && gameIdsParam.trim().length) {
      const ids = gameIdsParam.split(",").map(s => s.trim()).filter(Boolean);
      if (ids.length) q = q.in("game_id", ids);
    }

    const { data, error } = await q;
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    const rows = (data ?? []).filter((r: any) => {
      const et = new Date(String(r.games.commence_time)).toLocaleDateString("en-US", { timeZone: "America/New_York" });
      return et === todayET;
    });

    // Shape to API contract
    const out: PlayerListItem[] = rows.map((r: any) => ({
      player_id: String(r.player_id),
      full_name: String(r.players.full_name),
      team_abbr: r.team_abbr ? String(r.team_abbr).toUpperCase() : null,
      game_id: String(r.game_id),
    }));

    // Stable sort: by team then name
    out.sort((a, b) => {
      const t = (a.team_abbr ?? "").localeCompare(b.team_abbr ?? "");
      if (t !== 0) return t;
      return a.full_name.localeCompare(b.full_name);
    });

    return NextResponse.json({ ok: true, data: out }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
