// components/OddsChart.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
  Brush,
} from "recharts";
import { BOOK_COLORS } from "@/lib/odds";

type Player = { player_id: string; full_name: string };
type MarketKey = "batter_home_runs" | "batter_first_home_run";
type OutcomeKey = "over" | "under" | "yes" | "no";

type Point = {
  captured_at: string;
  [seriesKey: string]: number | string;
};

const AMERICAN = (n: number) => (n > 0 ? `+${n}` : `${n}`);
const toImpliedPct = (american: number) =>
  american > 0 ? 100 / (american + 100) : Math.abs(american) / (Math.abs(american) + 100);

function usePlayerSeries(
  gameId: string | null,
  players: Player[],
  marketKey: MarketKey,
  outcome: OutcomeKey
) {
  const [series, setSeries] = useState<Record<string, any[]>>({});

  useEffect(() => {
    let aborted = false;
    (async () => {
      const out: Record<string, any[]> = {};
      await Promise.all(
        players.map(async (p) => {
          // NOTE: backend currently ignores outcome. If/when outcome data exists,
          // you can extend /api/players/[id]/odds to filter server-side.
          const url = `/api/players/${p.player_id}/odds?market_key=${marketKey}${
            gameId ? `&game_id=${gameId}` : ""
          }`;
          const res = await fetch(url, { cache: "no-store" });
          const json = await res.json();
          if (json.ok) out[p.player_id] = json.data; // [{captured_at, american_odds, bookmaker}]
        })
      );
      if (!aborted) setSeries(out);
    })();
    return () => {
      aborted = true;
    };
  }, [gameId, marketKey, outcome, players.map((p) => p.player_id).join(",")]);

  // Without outcome in the DB, the toggle is a view preference. If your DB later
  // stores outcome, this is where you'd filter by it. For now we just plot what we have.
  const merged: Point[] = useMemo(() => {
    const timeMap: Record<string, Point> = {};
    for (const p of players) {
      const rows = series[p.player_id] ?? [];
      for (const r of rows) {
        const t = r.captured_at;
        if (!timeMap[t]) timeMap[t] = { captured_at: t };
        const key = `${p.player_id}__${r.bookmaker}`;
        timeMap[t][key] = r.american_odds;
      }
    }
    const arr = Object.values(timeMap);
    arr.sort(
      (a, b) =>
        new Date(a.captured_at as string).getTime() - new Date(b.captured_at as string).getTime()
    );
    return arr;
  }, [series, players.map((p) => p.player_id).join(",")]);

  return merged;
}

function CustomTooltip({
  active,
  payload,
  label,
  playersById,
}: {
  active?: boolean;
  payload?: any[];
  label?: string;
  playersById: Record<string, Player>;
}) {
  if (!active || !payload?.length) return null;

  const rows = payload
    .filter((p) => p && typeof p.value === "number")
    .map((p) => {
      const [playerId, bookmaker] = String(p.dataKey).split("__");
      const player = playersById[playerId];
      const american = p.value as number;
      const prob = toImpliedPct(american);
      return {
        color: p.stroke,
        name: `${player?.full_name ?? playerId} — ${bookmaker.toUpperCase()}`,
        american: AMERICAN(american),
        prob: `${(prob * 100).toFixed(1)}%`,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="rounded-md border bg-white px-3 py-2 shadow-sm text-sm">
      <div className="mb-1 font-medium">
        {new Date(label ?? "").toLocaleString([], {
          month: "short",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
