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

type MarketKey = "batter_home_runs" | "batter_first_home_run";
type OutcomeKey = "over" | "under" | "yes" | "no";

type PlayerLike = { player_id: string; full_name: string };
type Snapshot = {
  player_id: string;
  bookmaker: "fanduel" | "betmgm" | string;
  american_odds: number;
  captured_at: string; // ISO
  game_id?: string | null;
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
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<Snapshot[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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

        const url = `/api/odds/history?player_ids=${encodeURIComponent(ids.join(","))}&market_key=${encodeURIComponent(
          marketKey
        )}`;
        const res = await fetch(url, { cache: "no-store" });
        const txt = await res.text();
        let payload: any;
        try {
          payload = JSON.parse(txt);
        } catch {
          throw new Error(`Non-JSON from ${url}`);
        }

        const list: any[] = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.data)
          ? payload.data
          : Array.isArray(payload?.rows)
          ? payload.rows
          : [];

        const flat: Snapshot[] = list
          .map((r) => ({
            player_id: String(r.player_id ?? r.pid ?? ""),
            bookmaker: (r.bookmaker ?? r.book ?? "").toString().toLowerCase(),
            american_odds: Number(r.american_odds ?? r.odds ?? NaN),
            captured_at: r.captured_at ?? r.ts ?? r.created_at ?? r.time ?? "",
            game_id: r.game_id ?? r.gid ?? null,
          }))
          .filter((r) => r.player_id && r.captured_at && !Number.isNaN(r.american_odds));

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
  }, [JSON.stringify(players), marketKey, refreshTick]);

  const data = useMemo(() => {
    if (rows.length === 0) return [];
    const selected = new Set(gameIds);
    const keepByGid = selected.size > 0;
    const selectedDates = new Set<string>(
      keepByGid ? gameIds.map((gid) => gameDates[gid]).filter(Boolean) : []
    );
    const todayET = ymdET(new Date().toISOString());

    const buckets = new Map<string, Snapshot[]>();

    for (const r of rows) {
      const book = (r.bookmaker || "").toLowerCase();
      if (book !== "fanduel" && book !== "betmgm") continue;
      if (!matchesOutcome(marketKey, outcome, r.american_odds)) continue;
      if (!passBounds(marketKey, outcome, r.american_odds)) continue;

      if (keepByGid) {
        // Require matching game_id; if missing, allow only if captured date matches one of the selected game ET dates
        if (r.game_id) {
          if (!selected.has(r.game_id)) continue;
        } else {
          const rDate = ymdET(r.captured_at);
          if (!selectedDates.has(rDate)) continue;
        }
      } else {
        // No game selected => keep only today ET
        if (ymdET(r.captured_at) !== todayET) continue;
      }

      const key = `${r.player_id}|${book}`;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push(r);
    }

    const lines: { key: string; pts: { ts: number; y: number }[] }[] = [];

    for (const [key, arr] of buckets) {
      arr.sort((a, b) => toTs(a.captured_at) - toTs(b.captured_at));
      const pts = arr.map((r) => ({ ts: toTs(r.captured_at), y: r.american_odds }));
      lines.push({ key, pts });
    }

    if (lines.length === 0) return [];

    const allTs = Array.from(new Set(lines.flatMap((l) => l.pts.map((p) => p.ts)))).sort((a, b) => a - b);
    return allTs.map((ts) => {
      const row: any = { ts, x: new Date(ts).toISOString() };
      for (const line of lines) {
        const p = line.pts.find((pt) => pt.ts === ts);
        if (p) row[line.key] = p.y;
      }
      return row;
    });
  }, [rows, gameIds, gameDates, marketKey, outcome]);

  const series = useMemo(() => {
    const map = new Map<string, { key: string; stroke: string }>();
    for (const p of players) {
      map.set(`${p.player_id}|fanduel`, { key: `${p.player_id}|fanduel`, stroke: BOOK_COLORS.fanduel });
      map.set(`${p.player_id}|betmgm`, { key: `${p.player_id}|betmgm`, stroke: BOOK_COLORS.betmgm });
    }
    return Array.from(map.values());
  }, [players]);

  const hasData = data.length > 0 && series.some((s) => data.some((r) => s.key in r));

  return (
    <div className="w-full" style={{ height: 420 }}>
      {!players.length ? (
        <div className="text-xs text-gray-500">Select one or more players to see price history.</div>
      ) : error ? (
        <div className="text-xs text-red-600">Error: {error}</div>
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
