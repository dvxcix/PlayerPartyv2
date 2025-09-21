// app/api/players/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE!;

type AnyRow = Record<string, any>;

function parseGameIdsFromUrl(urlStr: string): string[] {
  const url = new URL(urlStr);
  const q = url.searchParams.get("game_ids") || "";
  return q
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function GET(req: Request) {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);
    const gameIds = parseGameIdsFromUrl(req.url);

    if (!gameIds.length) {
      // You can decide to either error, or return empty.
      // Returning empty keeps the UI simple.
      return NextResponse.json({ ok: true, data: [] }, { status: 200 });
    }

    // Pull participants for those games with the player full_name via FK/relationship.
    // Table shapes you shared:
    // - game_participants: game_id, player_id, team_abbr
    // - players: player_id, full_name, ...
    const { data, error } = await supabase
      .from("game_participants")
      .select("game_id, player_id, team_abbr, players(full_name)")
      .in("game_id", gameIds);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    // Deduplicate by (game_id, player_id)
    const seen = new Set<string>();
    const rows =
      (data ?? [])
        .map((r: AnyRow) => {
          const gid = String(r.game_id ?? "");
          const pid = String(r.player_id ?? "");
          const key = `${gid}|${pid}`;
          if (seen.has(key)) return null;
          seen.add(key);

          return {
            player_id: pid,
            full_name: (r.players && r.players[0]?.full_name) || r.players?.full_name || pid,
            team_abbr: r.team_abbr ?? null,
            game_id: gid,
          };
        })
        .filter(Boolean) ?? [];

    return NextResponse.json({ ok: true, data: rows }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
