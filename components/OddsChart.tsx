// components/OddsChart.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Brush,
} from "recharts";
import { createClient } from "@supabase/supabase-js";

type MarketKey = "batter_home_runs" | "batter_first_home_run";
type OutcomeKey = "over" | "under" | "yes" | "no";
type PlayerLike = { player_id: string; full_name: string };

type Row = {
  player_id: string;
  bookmaker: string;
  american_odds: number;
  captured_at: string; // ISO
  game_id: string | null;
  market_key: string | null;
};

const BOOK_COLORS: Record<string, string> = {
  fanduel: "#1E90FF",
  betmgm: "#8B4513",
};

const AMERICAN = (n: number) => (n > 0 ? `+${n}` : `${n}`);
const toTs = (iso: string) => new Date(iso).getTime();

function matchesOutcome(marketKey: MarketKey, outcome: OutcomeKey, american: number) {
  if (marketKey === "batter_home_runs") {
    return outcome === "over" ? american >= 0 : outcome === "under" ? american < 0 : true;
  }
  return outcome === "yes" ? american >= 0 : outcome === "no" ? american < 0 : true;
}
function passBounds(marketKey: MarketKey, outcome: OutcomeKey, american: number) {
  if (marketKey === "batter_home_runs" && (outcome === "over" || outcome === "yes")) {
    if (american > 2500) return false;
  }
  if (marketKey === "batter_home_runs" && (outcome === "under" || outcome === "no")) {
    if (american < -5000) return false;
  }
  return true;
}
function ymdET(iso: string) {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value!;
  const m = parts.find((p) => p.type === "month")?.value!;
  const day = parts.find((p) => p.type === "day")?.value!;
  return `${y}-${m}-${day}`;
}
function etDayBounds(ymd: string): { start: string; end: string } {
  const start = `${ymd}T00:00:00-04:00`;
  const end = `${ymd}T23:59:59-04:00`;
  return { start: new Date(start).toISOString(), end: new Date(end).toISOString() };
}

export function OddsChart({
  gameIds,
  gameDates,
  players,
  marketKey,
  outcome,
  refreshTick,
}: {
  gameIds: string[];
  gameDates: Record<string, string>; // game_id -> YYYY-MM-DD (ET)
  players: PlayerLike[];
  marketKey: MarketKey;
  outcome: OutcomeKey;
  refreshTick: number;
}) {
  const [supabase, setSupabase] = useState<ReturnType<typeof createClient> | null>(null);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Create Supabase client ONLY in the browser
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      setError("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
      return;
    }
    setSupabase(createClient(url, key));
  }, []);

  useEffect(() => {
    if (!supabase) return; // wait until client exists (browser)
    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      setRows([]);
      try {
        const ids = players.map((p) => p.player_id).filter(Boolean);
        if (ids.length === 0) {
          setRows([]);
          setLoading(false);
          return;
        }

        let q = supabase
          .from("odds_history")
          .select("player_id,bookmaker,american_odds,captured_at,game_id,market_key")
          .in("player_id", ids)
          .in("bookmaker", ["fanduel", "betmgm"])
          .eq("market_key", marketKey);

        if (gameIds.length > 0) {
          const dates = Array.from(new Set(gameIds.map((g) => gameDates[g]).filter(Boolean)));
          if (dates.length === 0) {
            q = q.in("game_id", gameIds);
          } else {
            const ors: string[] = [];
            ors.push(`game_id.in.(${gameIds.join(",")})`);
            for (const d of dates) {
              const { start, end } = etDayBounds(d);
              ors.push(`and(captured_at.gte.${start},captured_at.lte.${end})`);
            }
            q = q.or(ors.join(","));
          }
        } else {
          const today = ymdET(new Date().toISOString());
          const { start, end } = etDayBounds(today);
          q = q.gte("captured_at", start).lte("captured_at", end);
        }

        const { data, error: e } = await q.order("captured_at", { ascending: true }).limit(5000);
        if (e) throw e;

        const flat: Row[] =
          (data ?? []).map((r: any) => ({
            player_id: String(r.player_id),
            bookmaker: String(r.bookmaker ?? "").toLowerCase(),
            american_odds: Number(r.american_odds),
            captured_at: r.captured_at,
            game_id: r.game_id ?? null,
            market_key: r.market_key ?? null,
          })) || [];

        if (!alive) return;
        setRows(flat);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message ?? String(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [supabase, JSON.stringify(players), JSON.stringify(gameIds), JSON.stringify(gameDates), marketKey, outcome, refreshTick]);

  const data = useMemo(() => {
    if (rows.length === 0) return [];

    const buckets = new Map<string, Row[]>();
    for (const r of rows) {
      const book = (r.bookmaker || "").toLowerCase();
      if (book !== "fanduel" && book !== "betmgm") continue;
      if (!matchesOutcome(marketKey, outcome, r.american_odds)) continue;
      if (!passBounds(marketKey, outcome, r.american_odds)) continue;

      const key = `${r.player_id}|${book}`;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push(r);
    }

    const lines: { key: string; pts: { ts: number; y: number }[] }[] = [];
    for (const [key, arr] of buckets) {
      arr.sort((a, b) => toTs(a.captured_at) - toTs(b.captured_at));
      const pts = arr.map((r) => ({ ts: toTs(r.captured_at), y: r.american_odds }));
      if (pts.length) lines.push({ key, pts });
    }

    if (!lines.length) return [];

    const allTs = Array.from(new Set(lines.flatMap((l) => l.pts.map((p) => p.ts)))).sort((a, b) => a - b);
    return allTs.map((ts) => {
      const row: any = { ts, x: new Date(ts).toISOString() };
      for (const line of lines) {
        const p = line.pts.find((pt) => pt.ts === ts);
        if (p) row[line.key] = p.y;
      }
      return row;
    });
  }, [rows, marketKey, outcome]);

  const series = useMemo(() => {
    const map = new Map<string, { key: string; stroke: string }>();
    for (const p of players) {
      map.set(`${p.player_id}|fanduel`, { key: `${p.player_id}|fanduel`, stroke: BOOK_COLORS.fanduel });
      map.set(`${p.player_id}|betmgm`, { key: `${p.player_id}|betmgm`, stroke: BOOK_COLORS.betmgm });
    }
    return Array.from(map.values());
  }, [players]);

  const hasData = data.length > 0 && series.some((s) => data.some((r) => s.key in r));

  if (!supabase && typeof window !== "undefined") {
    return <div className="text-xs text-red-600">Missing public Supabase env config.</div>;
  }

  return (
    <div className="w-full" style={{ height: 420 }}>
      {!players.length ? (
        <div className="text-xs text-gray-500">Select one or more players to see price history.</div>
      ) : error ? (
        <div className="text-xs text-red-600 break-words">Error: {error}</div>
      ) : loading ? (
        <div className="text-xs text-gray-500">Loading…</div>
      ) : !hasData ? (
        <div className="text-xs text-gray-500">No snapshots for this selection yet.</div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 8, left: 12 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="x"
              type="category"
              tickFormatter={(x: string) =>
                new Date(x).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
              }
            />
            <YAxis domain={["auto", "auto"]} tickFormatter={(n: number) => AMERICAN(n)} width={52} />
            <Tooltip
              formatter={(val: any, name: string) => [AMERICAN(val as number), name.split("|")[1].toUpperCase()]}
              labelFormatter={(x) =>
                new Date(x as string).toLocaleString("en-US", {
                  hour: "numeric",
                  minute: "2-digit",
                  month: "short",
                  day: "2-digit",
                  timeZone: "America/New_York",
                })
              }
            />
            {series.map((s) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                dot={{ r: 2 }}
                stroke={s.stroke}
                strokeWidth={2}
                isAnimationActive={false}
              />
            ))}
            <Brush dataKey="x" height={24} travellerWidth={8} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
