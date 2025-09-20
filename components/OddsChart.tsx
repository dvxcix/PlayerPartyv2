// components/OddsChart.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Brush,
} from "recharts";
import { BOOK_COLORS } from "@/lib/odds";

type MarketKey = "batter_home_runs" | "batter_first_home_run";
type OutcomeKey = "over" | "under" | "yes" | "no";
type PlayerLike = { player_id: string; full_name: string };

type HistoryRow = {
  player_id: string;
  full_name: string;
  bookmaker: "fanduel" | "betmgm";
  american_odds: number;
  captured_at: string; // ISO
  game_id?: string | null;
};

type ChartPoint = {
  captured_at: string;
  ts: number;
  [seriesKey: string]: number | string;
};

type Props = {
  gameIds: string[];
  players: PlayerLike[];
  marketKey: MarketKey;
  outcome: OutcomeKey;
  refreshTick: number;
};

const passBounds = (marketKey: MarketKey, outcome: OutcomeKey, american: number) => {
  if (marketKey === "batter_home_runs") {
    if (outcome === "over") return american <= 2500;
    if (outcome === "under") return american >= -5000;
  }
  return true;
};

export default function OddsChart({
  gameIds,
  players,
  marketKey,
  outcome,
  refreshTick,
}: Props) {
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);
        setRows([]);

        if (players.length === 0) return;

        const player_ids = players.map((p) => encodeURIComponent(p.player_id)).join(",");
        const params = new URLSearchParams();
        params.set("market_key", marketKey);
        params.set("player_ids", player_ids);
        if (gameIds.length > 0) params.set("game_ids", gameIds.join(","));

        const res = await fetch(`/api/odds/history?${params.toString()}`, { cache: "no-store" });
        const json = await res.json().catch(() => null);

        if (!json || json.ok !== true || !Array.isArray(json.data)) {
          throw new Error(`Non-JSON / malformed response from /api/odds/history`);
        }

        const clean = (json.data as HistoryRow[])
          .filter(
            (r) =>
              r &&
              r.player_id &&
              r.bookmaker &&
              typeof r.american_odds === "number" &&
              r.captured_at &&
              passBounds(marketKey, outcome, r.american_odds)
          )
          .filter((r) => (gameIds.length ? gameIds.includes(String(r.game_id ?? "")) : true))
          .sort((a, b) => Date.parse(a.captured_at) - Date.parse(b.captured_at));

        setRows(clean);
      } catch (e: any) {
        setError(e?.message ?? String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [gameIds.join(","), players.map((p) => p.player_id).join(","), marketKey, outcome, refreshTick]);

  const chartData = useMemo<{ rows: ChartPoint[]; seriesKeys: string[] }>(() => {
    if (!rows.length) return { rows: [], seriesKeys: [] };

    const buckets = new Map<string, HistoryRow[]>();
    rows.forEach((r) => {
      const key = `${r.player_id}|${r.bookmaker}`;
      const arr = buckets.get(key) || [];
      arr.push(r);
      buckets.set(key, arr);
    });

    const timestamps = Array.from(
      new Set(rows.map((r) => Date.parse(r.captured_at)).filter((n) => Number.isFinite(n)))
    )
      .sort((a, b) => a - b)
      .slice(-2000);

    const seriesKeys = Array.from(buckets.keys());
    const table: ChartPoint[] = timestamps.map((ts) => {
      const iso = new Date(ts).toISOString();
      const row: ChartPoint = { captured_at: iso, ts };
      seriesKeys.forEach((k) => {
        const arr = buckets.get(k)!;
        let last = undefined as number | undefined;
        for (let i = 0; i < arr.length; i++) {
          const t = Date.parse(arr[i].captured_at);
          if (t <= ts) last = arr[i].american_odds;
          else break;
        }
        if (typeof last === "number") row[k] = last;
      });
      return row;
    });

    return { rows: table, seriesKeys };
  }, [rows]);

  if (loading) return <div className="text-sm text-gray-600">Loading odds…</div>;
  if (error) return <div className="text-sm text-red-600">Error: {error}</div>;
  if (!chartData.seriesKeys.length) return <div className="text-sm text-gray-600">No snapshots for this selection yet.</div>;

  return (
    <div className="w-full h-[420px]">
      <ResponsiveContainer>
        <LineChart data={chartData.rows} margin={{ top: 10, right: 12, bottom: 12, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="captured_at"
            tickFormatter={(v: string) => new Date(v).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            minTickGap={30}
          />
          <YAxis
            domain={["auto", "auto"]}
            tickFormatter={(v: number) => (v > 0 ? `+${v}` : `${v}`)}
            width={48}
          />
          <Tooltip
            formatter={(value: any, key: string) => {
              const [player_id, book] = key.split("|");
              const label = `${book.toUpperCase()} ${value > 0 ? `+${value}` : value}`;
              return [label, player_id];
            }}
            labelFormatter={(v: string) =>
              new Date(v).toLocaleString([], { hour: "2-digit", minute: "2-digit" })
            }
          />
          {chartData.seriesKeys.map((k) => {
            const book = k.split("|")[1] || "";
            const stroke = BOOK_COLORS[book] || "#333";
            return (
              <Line
                key={k}
                type="monotone"
                dataKey={k}
                dot={false}
                stroke={stroke}
                strokeWidth={2}
                isAnimationActive={false}
              />
            );
          })}
          <Brush dataKey="captured_at" height={24} travellerWidth={8} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
