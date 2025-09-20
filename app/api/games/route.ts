// app/api/games/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE!;

/**
 * Helper: compute "today" start/end in America/New_York, return as ISO.
 */
function getNYDayRange(dateStr?: string) {
  // If a date=YYYY-MM-DD is provided, use that as the local day in ET.
  // Otherwise, compute the current ET day now.
  const fmt = (d: Date) =>
    new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString(); // keep as ISO

  // Build an ET Date by offsetting from UTC manually using the Intl API
  const now = new Date();
  const tz = "America/New_York";

  const toET = (d: Date) => {
    // Convert a UTC Date into local ET broken-down parts, then rebuild a Date from those parts as UTC.
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    })
      .formatToParts(d)
      .reduce<Record<string, string>>((acc, p) => {
        if (p.type !== "literal") acc[p.type] = p.value;
        return acc;
      }, {});
    // parts: { year, month, day, hour, minute, second }
    const yyyy = Number(parts.year);
    const mm = Number(parts.month);
    const dd = Number(parts.day);
    const HH = Number(parts.hour);
    const MM = Number(parts.minute);
    const SS = Number(parts.second);
    // Build a UTC date from ET wall clock
    return new Date(Date.UTC(yyyy, mm - 1, dd, HH, MM, SS));
  };

  let etMidnightStart: Date;
  if (dateStr) {
    // Use provided local ET day
    const [yyyy, mm, dd] = dateStr.split("-").map((x) => Number(x));
    // Build ET midnight for that day, then convert to UTC carrier
    const etCarrier = new Date(Date.UTC(yyyy, mm - 1, dd, 0, 0, 0));
    etMidnightStart = toET(etCarrier); // ensures we align to ET day even across DST
  } else {
    // Current ET day
    const nowET = toET(now);
    const parts = new Date(nowET);
    const yyyy = parts.getUTCFullYear();
    const mm = parts.getUTCMonth();
    const dd = parts.getUTCDate();
    etMidnightStart = new Date(Date.UTC(yyyy, mm, dd, 0, 0, 0));
  }
  const etMidnightEnd = new Date(etMidnightStart.getTime() + 24 * 60 * 60 * 1000);

  return { startISO: fmt(etMidnightStart), endISO: fmt(etMidnightEnd) };
}

export async function GET(req: Request) {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

    const url = new URL(req.url);
    const dateParam = url.searchParams.get("date") || undefined; // YYYY-MM-DD
    const includePast = url.searchParams.get("include_past") === "1";

    const { startISO, endISO } = getNYDayRange(dateParam);

    // Base: only today's games in ET (default)
    let q = supabase
      .from("games")
      .select(
        `
        id,
        game_id,
        home_team_abbr,
        away_team_abbr,
        commence_time,
        status,
        game_participants:game_participants(
          player_id,
          team_abbr,
          players(full_name)
        )
      `
      )
      .gte("commence_time", startISO)
      .lt("commence_time", endISO)
      .order("commence_time", { ascending: true });

    // If include_past=1, don’t constrain to today (useful for archive views)
    if (includePast) {
      q = supabase
        .from("games")
        .select(
          `
          id,
          game_id,
          home_team_abbr,
          away_team_abbr,
          commence_time,
          status,
          game_participants:game_participants(
            player_id,
            team_abbr,
            players(full_name)
          )
        `
        )
        .order("commence_time", { ascending: false })
        .limit(500);
    }

    const { data, error } = await q;
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    // Normalize id / game_id shapes and flatten for client
    const games = (data ?? []).map((g: any) => ({
      id: String(g.id ?? g.game_id),
      game_id: String(g.game_id ?? g.id),
      home_team_abbr: g.home_team_abbr,
      away_team_abbr: g.away_team_abbr,
      commence_time: g.commence_time,
      status: g.status,
      participants:
        (g.game_participants ?? []).map((p: any) => ({
          player_id: String(p.player_id),
          team_abbr: p.team_abbr,
          players: { full_name: p.players?.full_name ?? String(p.player_id) },
        })) ?? [],
    }));

    return NextResponse.json({ ok: true, data: games }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}