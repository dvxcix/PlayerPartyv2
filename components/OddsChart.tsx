// components/OddsChart.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Brush,
} from "recharts";
import { BOOK_COLORS } from "@/lib/odds";
import type { Player } from "./PlayersPanel";

type MarketKey = "batter_home_runs" | "batter_first_home_run";
type OutcomeKey = "over" | "under" | "yes" | "no";

type Snapshot = {
  captured_at: string;
  american_odds: number;
  bookmaker: "fanduel" | "betmgm";
  player_id: string;
  game_id: string;
};

type Props = {
  gameIds: string[];
  players: Player[];
  marketKey: MarketKey;
  outcome: OutcomeKey;
  refreshTick: number;
};

const AMERICAN = (n: number) => (n > 0 ? `+${n}` : `${n}`);

export default function OddsChart({ gameIds, players, marketKey, outcome, refreshTick }: Props) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Fetch odds for selected players, restricted to selected game(s)
  useEffect(() => {
    (async () => {
      setError(null);
      setSnapshots([]);

      const player_ids = players.map(p => encodeURIComponent(p.player_id)).join(",");
      if (!player_ids) return;

      const params = new URLSearchParams();
      params.set("player_ids", player_ids);
      if (gameIds.length === 1) params.set("game_id", gameIds[0]);
      else if (gameIds.length > 1) params.set("game_ids", gameIds.join(","));
      params.set("market_key", marketKey);
      params.set("outcome", outcome);

      const res = await fetch(`/api/odds/history?${params.toString()}`, { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!json || json.ok !== true) {
        setError(`Non-JSON or error from /api/odds/history`);
        return;
      }
      setSnapshots(json.data || []);
    })();
  }, [players, gameIds, marketKey, outcome, refreshTick]);

  const chartData = useMemo(() => {
    if (!snapshots.length) return [];

    // group by timestamp to build combined rows with each series as key
    const rowsByTs = new Map<number, any>();
    const seriesKeys = new Set<string>();

    for (const s of snapshots) {
      const ts = Date.parse(s.captured_at);
      if (!Number.isFinite(ts)) continue;

      const key = `${s.player_id}|${s.bookmaker}`;
      seriesKeys.add(key);

      const row = rowsByTs.get(ts) || { ts, captured_at: new Date(ts).toISOString() };
      row[key] = s.american_odds;
      rowsByTs.set(ts, row);
    }

    const rows = Array.from(rowsByTs.values()).sort((a, b) => a.ts - b.ts);
    return { rows, seriesKeys: Array.from(seriesKeys) as string[] };
  }, [snapshots]);

  if (error) {
    return <div className="text-sm text-red-600">{error}</div>;
  }
  if (!players.length) {
    return <div className="text-sm text-gray-500">Select players to view odds.</div>;
  }
  if (!snapshots.length) {
    return <div className="text-sm text-gray-500">No snapshots for this selection yet.</div>;
  }

  return (
    <div className="w-full h-[420px]">
      <ResponsiveContainer>
        <LineChart data={chartData.rows} margin={{ top: 10, right: 12, bottom: 12, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="captured_at"
            tickFormatter={(v) => {
              const d = new Date(v);
              return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
            }}
          />
          <YAxis
            tickFormatter={AMERICAN}
            domain={["dataMin - 50", "dataMax + 50"]}
            width={60}
          />
          <Tooltip
            formatter={(value: any, name: string) => {
              // name = "player_id|bookmaker"
              const [pid, book] = String(name).split("|");
              const p = players.find(pp => pp.player_id === pid);
              const nm = p ? p.full_name : pid;
              const bookNice = book === "fanduel" ? "FanDuel" : book === "betmgm" ? "BetMGM" : book;
              return [AMERICAN(Number(value)), `${nm} — ${bookNice}`];
            }}
            labelFormatter={(v: any) => {
              const d = new Date(v);
              return d.toLocaleString();
            }}
          />
          {chartData.seriesKeys.map((k) => {
            const book = k.split("|")[1] as "fanduel" | "betmgm";
            const color = BOOK_COLORS[book] || "#8884d8";
            return (
              <Line
                key={k}
                type="monotone"
                dataKey={k}
                dot={{ r: 2 }}
                stroke={color}
                strokeWidth={2}
                isAnimationActive={false}
              />
            );
          })}
          <Brush height={20} travellerWidth={8} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
