// app/api/players/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { PlayerListItem } from "@/lib/types";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const ids = (url.searchParams.get("game_ids") || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (!ids.length) {
      return NextResponse.json({ ok: true, data: [] }, { status: 200 });
    }

    const { data, error } = await supabaseAdmin
      .from("game_participants")
      .select("game_id, player_id, team_abbr, players(full_name)")
      .in("game_id", ids);

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    const out: PlayerListItem[] = [];
    const seen = new Set<string>();

    for (const r of data ?? []) {
      const pid = String(r.player_id);
      const gid = String(r.game_id);
      const name = Array.isArray(r.players) ? r.players[0]?.full_name : r.players?.full_name;
      const key = `${gid}|${pid}`;
      if (seen.has(key)) continue;
      seen.add(key);

      out.push({
        player_id: pid,
        full_name: String(name || pid),
        team_abbr: r.team_abbr ?? null,
        game_id: gid,
      });
    }

    out.sort((a, b) => a.full_name.localeCompare(b.full_name));

    return NextResponse.json({ ok: true, data: out }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
