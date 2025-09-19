// components/OddsChart.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

type RawRow = { captured_at: string; american_odds: number; bookmaker: "fanduel" | "betmgm" | string };
type Point = {
  captured_at: string;
  ts: number; // numeric x for zoom/pan
  [seriesKey: string]: number | string;
};

const AMERICAN = (n: number) => (n > 0 ? `+${n}` : `${n}`);
const toImpliedPct = (american: number) =>
  american > 0 ? 100 / (american + 100) : Math.abs(american) / (Math.abs(american) + 100);

// --- Outcome logic: (+) = Over/Yes, (-) = Under/No (UI-only) ---
function matchesOutcome(marketKey: MarketKey, outcome: OutcomeKey, american: number) {
  if (marketKey === "batter_home_runs") {
    return outcome === "over" ? american >= 0 : outcome === "under" ? american < 0 : true;
  } else {
    return outcome === "yes" ? american >= 0 : outcome === "no" ? american < 0 : true;
  }
}

function usePlayerSeries(
  gameId: string | null,
  players: Player[],
  marketKey: MarketKey,
  outcome: OutcomeKey
) {
  const [series, setSeries] = useState<Record<string, RawRow[]>>({});

  useEffect(() => {
    let aborted = false;
    (async () => {
      const out: Record<string, RawRow[]> = {};
      await Promise.all(
        players.map(async (p) => {
          const url = `/api/players/${p.player_id}/odds?market_key=${marketKey}${
            gameId ? `&game_id=${gameId}` : ""
          }`;
          const res = await fetch(url, { cache: "no-store" });
          const json = await res.json();
          if (json.ok) {
            out[p.player_id] = (json.data as RawRow[]).filter((r) =>
              matchesOutcome(marketKey, outcome, Number(r.american_odds))
            );
          } else {
            out[p.player_id] = [];
          }
        })
      );
      if (!aborted) setSeries(out);
    })();
    return () => {
      aborted = true;
    };
  }, [gameId, marketKey, outcome, players.map((p) => p.player_id).join(",")]);

  // Merge timelines by timestamp so all selected players (and both books) appear together
  const merged: Point[] = useMemo(() => {
    const timeMap: Record<string, Point> = {};
    for (const p of players) {
      const rows = series[p.player_id] ?? [];
      for (const r of rows) {
        const t = r.captured_at;
        if (!timeMap[t]) timeMap[t] = { captured_at: t, ts: Date.parse(t) };
        const key = `${p.player_id}__${r.bookmaker}`; // e.g., "123__fanduel"
        timeMap[t][key] = r.american_odds;
      }
    }
    const arr = Object.values(timeMap);
    arr.sort((a, b) => a.ts - b.ts);
    return arr;
  }, [series, players.map((p) => p.player_id).join(",")]);

  return merged;
}

// --- Custom Tooltip ---
function CustomTooltip({
  active,
  payload,
  label,
  playersById,
}: {
  active?: boolean;
  payload?: any[];
  label?: string | number;
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

  const d = typeof label === "number" ? new Date(label) : new Date(label ?? "");

  return (
    <div className="rounded-md border bg-white px-3 py-2 shadow-sm text-sm">
      <div className="mb-1 font-medium">
        {d.toLocaleString([], { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
      </div>
      <div className="space-y-1">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center justify-between gap-4">
            <span className="inline-flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: r.color }} />
              {r.name}
            </span>
            <span className="tabular-nums">{r.american}</span>
            <span className="text-gray-500 tabular-nums">{r.prob}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function OddsChart({
  gameId,
  players,
  marketKey,
  outcome,
}: {
  gameId: string | null;
  players: Player[];
  marketKey: MarketKey;
  outcome: OutcomeKey;
}) {
  const data = usePlayerSeries(gameId, players, marketKey, outcome);
  const [height, setHeight] = useState(520);
  const [showFD, setShowFD] = useState(true);
  const [showMGM, setShowMGM] = useState(true);
  const [showDots, setShowDots] = useState(true);
  const [smooth, setSmooth] = useState(false);

  // Build series lines (we’ll hide/show via state)
  const seriesLines = useMemo(() => {
    return players.flatMap((p) => {
      const lines: JSX.Element[] = [];
      if (showFD) {
        lines.push(
          <Line
            key={`${p.player_id}__fanduel`}
            type={smooth ? "monotone" : "linear"}
            connectNulls
            dataKey={`${p.player_id}__fanduel`}
            name={`${p.full_name} — FanDuel`}
            dot={showDots ? { r: 2.5 } : false}
            strokeWidth={2.25}
            stroke={BOOK_COLORS.fanduel}
            isAnimationActive={false}
          />
        );
      }
      if (showMGM) {
        lines.push(
          <Line
            key={`${p.player_id}__betmgm`}
            type={smooth ? "monotone" : "linear"}
            connectNulls
            dataKey={`${p.player_id}__betmgm`}
            name={`${p.full_name} — BetMGM`}
            dot={showDots ? { r: 2.5 } : false}
            strokeWidth={2.25}
            stroke={BOOK_COLORS.betmgm}
            isAnimationActive={false}
          />
        );
      }
      return lines;
    });
  }, [players, showFD, showMGM, showDots, smooth]);

  // Domain controls (zoom/pan)
  const tsMin = data.length ? data[0].ts : undefined;
  const tsMax = data.length ? data[data.length - 1].ts : undefined;
  const [xDomain, setXDomain] = useState<[number, number] | undefined>(undefined);

  // Initialize/reset domain when data changes
  useEffect(() => {
    if (tsMin !== undefined && tsMax !== undefined) setXDomain([tsMin, tsMax]);
  }, [tsMin, tsMax, players.map((p) => p.player_id).join(",")]);

  // Zoom helpers
  function zoom(factor: number) {
    if (!xDomain) return;
    const [a, b] = xDomain;
    const center = (a + b) / 2;
    const half = ((b - a) / 2) * factor;
    const na = Math.max(tsMin ?? a, center - half);
    const nb = Math.min(tsMax ?? b, center + half);
    setXDomain([na, nb]);
  }
  function zoomIn() {
    zoom(0.5);
  }
  function zoomOut() {
    zoom(1.5);
  }
  function resetView() {
    if (tsMin !== undefined && tsMax !== undefined) setXDomain([tsMin, tsMax]);
  }

  // Presets
  function applyPreset(hours: number | "all") {
    if (hours === "all") return resetView();
    if (tsMin === undefined || tsMax === undefined) return;
    const end = tsMax;
    const start = end - hours * 60 * 60 * 1000;
    const clampedStart = Math.max(tsMin, start);
    setXDomain([clampedStart, end]);
  }

  // Mouse wheel zoom (center around current domain center)
  const chartRef = useRef<any>(null);
  function onWheel(e: React.WheelEvent) {
    if (!xDomain) return;
    e.preventDefault();
    const dir = e.deltaY > 0 ? 1 : -1; // wheel down = zoom out
    const factor = dir > 0 ? 1.15 : 0.85;
    zoom(factor);
  }

  // Click-drag pan using activeLabel timestamps
  const dragging = useRef<{ startX: number; startDomain: [number, number] } | null>(null);
  function handleMouseDown(e: any) {
    if (!xDomain || !e || typeof e.activeLabel !== "number") return;
    dragging.current = { startX: e.activeLabel, startDomain: xDomain };
  }
  function handleMouseMove(e: any) {
    if (!dragging.current || !xDomain || !e || typeof e.activeLabel !== "number") return;
    const { startX, startDomain } = dragging.current;
    const delta = startX - e.activeLabel; // ms
    setXDomain([startDomain[0] + delta, startDomain[1] + delta]);
  }
  function handleMouseUp() {
    dragging.current = null;
  }

  // Export CSV of the visible view
  function exportCSV() {
    if (!data.length) return;
    const [a, b] = xDomain ?? [tsMin ?? 0, tsMax ?? 0];
    const filtered = data.filter((d) => d.ts >= a && d.ts <= b);
    const headers = ["captured_at", ...Object.keys(filtered[0]).filter((k) => k !== "captured_at" && k !== "ts")];
    const rows = [headers.join(",")];
    for (const d of filtered) {
      const line = headers.map((h) => (d as any)[h] ?? "").join(",");
      rows.push(line);
    }
    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const aEl = document.createElement("a");
    aEl.href = url;
    aEl.download = "odds_view.csv";
    aEl.click();
    URL.revokeObjectURL(url);
  }

  const playersById = useMemo(() => {
    const m: Record<string, Player> = {};
    for (const p of players) m[p.player_id] = p;
    return m;
  }, [players]);

  const hasData = data.length > 0;

  return (
    <div className="w-full bg-white rounded-2xl border shadow-sm">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 p-3 border-b text-sm">
        <div className="flex items-center gap-2">
          <button className="px-2 py-1 border rounded hover:bg-gray-50" onClick={zoomIn} aria-label="Zoom in">＋</button>
          <button className="px-2 py-1 border rounded hover:bg-gray-50" onClick={zoomOut} aria-label="Zoom out">－</button>
          <button className="px-2 py-1 border rounded hover:bg-gray-50" onClick={resetView}>Reset</button>
        </div>

        <div className="flex items-center gap-1 pl-2">
          <span className="text-gray-500">Preset:</span>
          <button className="px-2 py-1 border rounded hover:bg-gray-50" onClick={() => applyPreset(3)}>3h</button>
          <button className="px-2 py-1 border rounded hover:bg-gray-50" onClick={() => applyPreset(6)}>6h</button>
          <button className="px-2 py-1 border rounded hover:bg-gray-50" onClick={() => applyPreset(12)}>12h</button>
          <button className="px-2 py-1 border rounded hover:bg-gray-50" onClick={() => applyPreset(24)}>24h</button>
          <button className="px-2 py-1 border rounded hover:bg-gray-50" onClick={() => applyPreset("all")}>All</button>
        </div>

        <div className="flex items-center gap-3 pl-2">
          <label className="inline-flex items-center gap-1">
            <input type="checkbox" checked={showFD} onChange={() => setShowFD((v) => !v)} />
            FanDuel
          </label>
          <label className="inline-flex items-center gap-1">
            <input type="checkbox" checked={showMGM} onChange={() => setShowMGM((v) => !v)} />
            BetMGM
          </label>
          <label className="inline-flex items-center gap-1">
            <input type="checkbox" checked={showDots} onChange={() => setShowDots((v) => !v)} />
            Dots
          </label>
          <label className="inline-flex items-center gap-1">
            <input type="checkbox" checked={smooth} onChange={() => setSmooth((v) => !v)} />
            Smooth
          </label>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button className="px-2 py-1 border rounded hover:bg-gray-50" onClick={exportCSV}>Export CSV</button>
          <div className="flex items-center gap-2">
            <span className="text-gray-500">Height</span>
            <input
              type="range"
              min={360}
              max={820}
              value={height}
              onChange={(e) => setHeight(Number(e.target.value))}
            />
            <span className="tabular-nums w-12 text-right">{height}px</span>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div
        className="w-full"
        style={{ height }}
        onWheel={onWheel}
      >
        {!hasData ? (
          <div className="h-full grid place-items-center text-sm text-gray-500">
            No snapshots for this selection yet.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              margin={{ top: 8, right: 16, left: 12, bottom: 16 }}
              ref={chartRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
            >
              <CartesianGrid strokeDasharray="4 4" />
              <XAxis
                dataKey="ts"
                type="number"
                domain={xDomain ?? ["auto", "auto"]}
                scale="time"
                tickFormatter={(ts) =>
                  new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                }
                minTickGap={48}
              />
              <YAxis tickFormatter={(v) => (Number(v) > 0 ? `+${v}` : `${v}`)} width={56} />
              <Tooltip
                content={<CustomTooltip playersById={players.reduce((m, p) => ((m[p.player_id] = p), m), {} as Record<string, Player>)} />}
                isAnimationActive={false}
                labelFormatter={(ts: number) => ts}
              />
              <Legend wrapperStyle={{ paddingTop: 8 }} />
              {seriesLines}
              <Brush
                dataKey="ts"
                height={22}
                travellerWidth={8}
                tickFormatter={(ts) =>
                  new Date(ts as number).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                }
                onChange={(range) => {
                  // Brush gives indexes; map to ts range if indexes exist
                  // If using indexes, we can compute from data
                  if (range?.startIndex != null && range?.endIndex != null) {
                    const si = Math.max(0, range.startIndex);
                    const ei = Math.min(data.length - 1, range.endIndex);
                    setXDomain([data[si].ts, data[ei].ts]);
                  }
                }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
