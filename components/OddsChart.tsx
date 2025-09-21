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
import { BOOK_COLORS } from "@/lib/odds";

type MarketKey = "batter_home_runs" | "batter_first_home_run";
type OutcomeKey = "over" | "under" | "yes" | "no";

type PlayerPick = { player_id: string; full_name: string; game_id: string };

type Snapshot = {
  captured_at: string; // ISO
  american_odds: number;
  bookmaker: "fanduel" | "betmgm";
};

type ChartRow = { captured_at: string; ts: number; [seriesKey: string]: number | string };

function passBounds(market: MarketKey, outcome: OutcomeKey, american: number): boolean {
  // global clamps from earlier request: hide > +2500 and < -5000
  if (american > 2500) return false;
  if (american < -5000) return false;

  // For HR 0.5: OVER usually positive, UNDER usually negative (but keep both if in bounds)
  // For First HR: YES often positive, NO negative (but keep both if in bounds)
  return true;
}

export default function OddsChart({
  players,
  marketKey,
  outcome,
  refreshTick,
}: {
  players: PlayerPick[];
  marketKey: MarketKey;
  outcome: OutcomeKey;
  refreshTick: number;
}) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [rows, setRows] = useState<ChartRow[]>([]);
  const [seriesKeys, setSeriesKeys] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErr(null);

        // Fetch each player's odds for their specific game_id
        const seriesMap: Record<string, Snapshot[]> = {};

        for (const p of players) {
          const u = new URL(`/api/players/${encodeURIComponent(p.player_id)}/odds`, window.location.origin);
          u.searchParams.set("market_key", marketKey);
          u.searchParams.set("game_id", p.game_id);

          const res = await fetch(u.toString(), { cache: "no-store" });
          const json = await res.json();
          if (!json?.ok) throw new Error(json?.error || "player odds fetch failed");

          const arr: Snapshot[] = (json.data ?? []).filter((r: Snapshot) =>
            passBounds(marketKey, outcome, r.american_odds)
          );

          // Make two series keys: one per book
          const fdKey = `${p.full_name} | FanDuel`;
          const mgmKey = `${p.full_name} | BetMGM`;
          seriesMap[fdKey] = arr.filter((r) => r.bookmaker === "fanduel");
          seriesMap[mgmKey] = arr.filter((r) => r.bookmaker === "betmgm");
        }

        // Merge all snapshots by timestamp
        const byTs: Map<number, ChartRow> = new Map();
        Object.entries(seriesMap).forEach(([key, snaps]) => {
          snaps.forEach((s) => {
            const ts = Date.parse(s.captured_at);
            if (!Number.isFinite(ts)) return;
            const iso = new Date(ts).toISOString();
            if (!byTs.has(ts)) byTs.set(ts, { captured_at: iso, ts });
            (byTs.get(ts) as ChartRow)[key] = s.american_odds;
          });
        });

        const mergedRows = Array.from(byTs.values()).sort((a, b) => a.ts - b.ts);
        const keys = Object.keys(seriesMap);

        setRows(mergedRows);
        setSeriesKeys(keys);
      } catch (e: any) {
        setErr(e?.message ?? String(e));
        setRows([]);
        setSeriesKeys([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [players.map((p) => `${p.player_id}|${p.game_id}`).join(","), marketKey, outcome, refreshTick]);

  const hasData = rows.length > 0 && seriesKeys.length > 0;

  return (
    <div className="space-y-2">
      {loading && <div className="text-xs text-gray-500">Loading odds…</div>}
      {err && <div className="text-xs text-red-600">Error: {err}</div>}
      {!loading && !err && !hasData && (
        <div className="text-xs text-gray-500">No snapshots for this selection yet.</div>
      )}

      {hasData && (
        <div className="w-full h-[420px]">
          <ResponsiveContainer>
            <LineChart data={rows} margin={{ top: 10, right: 12, bottom: 12, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="captured_at"
                tickFormatter={(v) => new Date(v).toLocaleTimeString()}
                minTickGap={28}
              />
              <YAxis
                domain={["auto", "auto"]}
                tickFormatter={(n) => (n > 0 ? `+${n}` : `${n}`)}
              />
              <Tooltip
                formatter={(v: any) => (typeof v === "number" ? (v > 0 ? `+${v}` : `${v}`) : v)}
                labelFormatter={(l: any) =>
                  new Date(l).toLocaleString(undefined, {
                    hour: "2-digit",
                    minute: "2-digit",
                    month: "2-digit",
                    day: "2-digit",
                  })
                }
              />
              {seriesKeys.map((k) => {
                const isFD = /FanDuel$/i.test(k);
                return (
                  <Line
                    key={k}
                    type="monotone"
                    dataKey={k}
                    stroke={isFD ? BOOK_COLORS.fanduel : BOOK_COLORS.betmgm}
                    dot={false}
                    strokeWidth={2}
                    isAnimationActive={false}
                  />
                );
              })}
              <Brush dataKey="captured_at" height={28} travellerWidth={10} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
