// components/OddsChart.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

type Player = { player_id: string; full_name: string };
type MarketKey = "batter_home_runs" | "batter_first_home_run";
type OutcomeKey = "over" | "under" | "yes" | "no";

type RawRow = { captured_at: string; american_odds: number; bookmaker: "fanduel" | "betmgm" | string };
type Point = { captured_at: string; ts: number; [seriesKey: string]: number | string };

const AMERICAN = (n: number) => (n > 0 ? `+${n}` : `${n}`);
const toImpliedPct = (american: number) =>
  american > 0 ? 100 / (american + 100) : Math.abs(american) / (Math.abs(american) + 100);

// (+) = Over/Yes, (-) = Under/No (UI-only)
function matchesOutcome(marketKey: MarketKey, outcome: OutcomeKey, american: number) {
  if (marketKey === "batter_home_runs")
    return outcome === "over" ? american >= 0 : outcome === "under" ? american < 0 : true;
  return outcome === "yes" ? american >= 0 : outcome === "no" ? american < 0 : true;
}

export function OddsChart({
  gameIds,
  players,
  marketKey,
  outcome,
}: {
  gameIds: string[];
  players: Player[];
  marketKey: MarketKey;
  outcome: OutcomeKey;
}) {
  const [series, setSeries] = useState<Record<string, RawRow[]>>({});

  // Which series (playerId__book) is currently hovered
  const [hoverKey, setHoverKey] = useState<string | null>(null);

  useEffect(() => setHoverKey(null), [players.map(p => p.player_id).join(","), gameIds.join(","), marketKey, outcome]);

  // Fetch rows (multi-game merge)
  useEffect(() => {
    let aborted = false;
    (async () => {
      const out: Record<string, RawRow[]> = {};
      await Promise.all(
        players.map(async (p) => {
          let rows: RawRow[] = [];
          if (gameIds.length === 0) {
            const res = await fetch(`/api/players/${p.player_id}/odds?market_key=${marketKey}`, {
              cache: "no-store",
            });
            const json = await res.json();
            if (json.ok) rows = json.data as RawRow[];
          } else {
            const parts = await Promise.all(
              gameIds.map(async (gid) => {
                const res = await fetch(
                  `/api/players/${p.player_id}/odds?market_key=${marketKey}&game_id=${gid}`,
                  { cache: "no-store" }
                );
                const json = await res.json();
                return json.ok ? (json.data as RawRow[]) : [];
              })
            );
            rows = parts.flat();
          }
          out[p.player_id] = rows.filter((r) => matchesOutcome(marketKey, outcome, Number(r.american_odds)));
        })
      );
      if (!aborted) setSeries(out);
    })();
    return () => {
      aborted = true;
    };
  }, [players.map((p) => p.player_id).join(","), marketKey, outcome, gameIds.join(",")]);

  // Merge by timestamp
  const data: Point[] = useMemo(() => {
    const timeMap: Record<string, Point> = {};
    for (const p of players) {
      const rows = series[p.player_id] ?? [];
      for (const r of rows) {
        const t = r.captured_at;
        if (!timeMap[t]) timeMap[t] = { captured_at: t, ts: Date.parse(t) };
        const key = `${p.player_id}__${r.bookmaker}`;
        timeMap[t][key] = r.american_odds;
      }
    }
    const arr = Object.values(timeMap);
    arr.sort((a, b) => a.ts - b.ts);
    return arr;
  }, [series, players.map((p) => p.player_id).join(",")]);

  // Interactivity controls (zoom/pan/brush/etc.)
  const [height, setHeight] = useState(620); // give the chart more default height
  const [showFD, setShowFD] = useState(true);
  const [showMGM, setShowMGM] = useState(true);
  const [showDots, setShowDots] = useState(true);
  const [smooth, setSmooth] = useState(false);

  const seriesLines = useMemo(() => {
    return players.flatMap((p) => {
      const lines: JSX.Element[] = [];
      if (showFD) {
        const key = `${p.player_id}__fanduel`;
        lines.push(
          <Line
            key={key}
            type={smooth ? "monotone" : "linear"}
            connectNulls
            dataKey={key}
            name={`${p.full_name} — FanDuel`}
            dot={showDots ? { r: 2.5 } : false}
            strokeWidth={2.25}
            stroke={BOOK_COLORS.fanduel}
            isAnimationActive={false}
            onMouseOver={() => setHoverKey(key)}
            onMouseOut={() => setHoverKey(null)}
          />
        );
      }
      if (showMGM) {
        const key = `${p.player_id}__betmgm`;
        lines.push(
          <Line
            key={key}
            type={smooth ? "monotone" : "linear"}
            connectNulls
            dataKey={key}
            name={`${p.full_name} — BetMGM`}
            dot={showDots ? { r: 2.5 } : false}
            strokeWidth={2.25}
            stroke={BOOK_COLORS.betmgm}
            isAnimationActive={false}
            onMouseOver={() => setHoverKey(key)}
            onMouseOut={() => setHoverKey(null)}
          />
        );
      }
      return lines;
    });
  }, [players, showFD, showMGM, showDots, smooth]);

  // Domain + zoom/pan
  const tsMin = data.length ? data[0].ts : undefined;
  const tsMax = data.length ? data[data.length - 1].ts : undefined;
  const [xDomain, setXDomain] = useState<[number, number] | undefined>(undefined);

  useEffect(() => {
    if (tsMin !== undefined && tsMax !== undefined) setXDomain([tsMin, tsMax]);
  }, [tsMin, tsMax, players.map((p) => p.player_id).join(",")]);

  function zoom(factor: number) {
    if (!xDomain) return;
    const [a, b] = xDomain;
    const center = (a + b) / 2;
    const half = ((b - a) / 2) * factor;
    const na = Math.max(tsMin ?? a, center - half);
    const nb = Math.min(tsMax ?? b, center + half);
    setXDomain([na, nb]);
  }
  function zoomIn() { zoom(0.5); }
  function zoomOut() { zoom(1.5); }
  function resetView() { if (tsMin !== undefined && tsMax !== undefined) setXDomain([tsMin, tsMax]); }
  function applyPreset(hours: number | "all") {
    if (hours === "all") return resetView();
    if (tsMin === undefined || tsMax === undefined) return;
    const end = tsMax;
    const start = end - hours * 60 * 60 * 1000;
    setXDomain([Math.max(tsMin, start), end]);
  }

  const dragging = useRef<{ startX: number; startDomain: [number, number] } | null>(null);
  function handleMouseDown(e: any) {
    if (!xDomain || !e || typeof e.activeLabel !== "number") return;
    dragging.current = { startX: e.activeLabel, startDomain: xDomain };
  }
  function handleMouseMove(e: any) {
    if (!dragging.current || !xDomain || !e || typeof e.activeLabel !== "number") return;
    const { startX, startDomain } = dragging.current;
    const delta = startX - e.activeLabel;
    setXDomain([startDomain[0] + delta, startDomain[1] + delta]);
  }
  function handleMouseUp() { dragging.current = null; }

  function onWheel(e: React.WheelEvent) {
    if (!xDomain) return;
    e.preventDefault();
    const dir = e.deltaY > 0 ? 1 : -1;
    zoom(dir > 0 ? 1.15 : 0.85);
  }

  function exportCSV() {
    if (!data.length) return;
    const [a, b] = xDomain ?? [tsMin ?? 0, tsMax ?? 0];
    const filtered = data.filter((d) => d.ts >= a && d.ts <= b);
    const headers = ["captured_at", ...Object.keys(filtered[0]).filter((k) => k !== "captured_at" && k !== "ts")];
    const rows = [headers.join(",")];
    for (const d of filtered) rows.push(headers.map((h) => (d as any)[h] ?? "").join(","));
    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const aEl = document.createElement("a");
    aEl.href = url; aEl.download = "odds_view.csv"; aEl.click();
    URL.revokeObjectURL(url);
  }

  const playersById = useMemo(() => Object.fromEntries(players.map((p) => [p.player_id, p])), [players]);
  const hasData = data.length > 0;

  // ——— Toolbar (kept slim; chart gets the space) ———
  return (
    <div className="w-full bg-white rounded-2xl border shadow-sm">
      <div className="flex flex-wrap items-center gap-2 p-3 border-b text-sm">
        <div className="flex items-center gap-2">
          <button className="px-2 py-1 border rounded hover:bg-gray-50" onClick={zoomIn} aria-label="Zoom in">＋</button>
          <button className="px-2 py-1 border rounded hover:bg-gray-50" onClick={zoomOut} aria-label="Zoom out">－</button>
          <button className="px-2 py-1 border rounded hover:bg-gray-50" onClick={resetView}>Reset</button>
        </div>

        <div className="flex items-center gap-1 pl-2">
          <span className="text-gray-500">Preset:</span>
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
          <button className="px-2 py-1 border rounded hover:bg-gray-50" onClick={exportCSV}>
            Export CSV
          </button>
          <div className="flex items-center gap-2">
            <span className="text-gray-500">Height</span>
            <input
              type="range"
              min={360}
              max={900}
              value={height}
              onChange={(e) => setHeight(Number(e.target.value))}
            />
            <span className="tabular-nums w-12 text-right">{height}px</span>
          </div>
        </div>
      </div>

      {/* Chart (no Legend; hover is line-specific) */}
      <div className="w-full" style={{ height }} onWheel={onWheel}>
        {!hasData ? (
          <div className="h-full grid place-items-center text-sm text-gray-500">
            No snapshots for this selection yet.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              margin={{ top: 8, right: 16, left: 12, bottom: 8 }}
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
                isAnimationActive={false}
                // Only show tooltip when we know which series is hovered
                content={({ active, payload, label }) => {
                  if (!active || !hoverKey || !payload?.length) return null;
                  // Find the one matching the hovered series key
                  const item = payload.find((p) => String(p.dataKey) === hoverKey && typeof p.value === "number");
                  if (!item) return null;

                  const [playerId, bookmaker] = String(item.dataKey).split("__");
                  const american = item.value as number;
                  const prob = toImpliedPct(american);
                  const d = typeof label === "number" ? new Date(label) : new Date(label ?? "");
                  return (
                    <div className="rounded-md border bg-white px-3 py-2 shadow-sm text-sm">
                      <div className="mb-1 font-medium">
                        {d.toLocaleString([], {
                          month: "short",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span className="inline-flex items-center gap-2">
                          <span
                            className="inline-block h-2 w-2 rounded-full"
                            style={{
                              background:
                                bookmaker === "fanduel" ? BOOK_COLORS.fanduel : BOOK_COLORS.betmgm,
                            }}
                          />
                          {players.find((p) => p.player_id === playerId)?.full_name ?? playerId} —{" "}
                          {bookmaker.toUpperCase()}
                        </span>
                        <span className="tabular-nums">{AMERICAN(american)}</span>
                        <span className="text-gray-500 tabular-nums">
                          {(prob * 100).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  );
                }}
              />
              {/* Lines (each line sets hoverKey on mouse over) */}
              {players.flatMap((p) => {
                const lines: JSX.Element[] = [];
                if (showFD) {
                  const key = `${p.player_id}__fanduel`;
                  lines.push(
                    <Line
                      key={key}
                      type={smooth ? "monotone" : "linear"}
                      connectNulls
                      dataKey={key}
                      dot={showDots ? { r: 2.5 } : false}
                      strokeWidth={2.25}
                      stroke={BOOK_COLORS.fanduel}
                      isAnimationActive={false}
                      onMouseOver={() => setHoverKey(key)}
                      onMouseOut={() => setHoverKey(null)}
                    />
                  );
                }
                if (showMGM) {
                  const key = `${p.player_id}__betmgm`;
                  lines.push(
                    <Line
                      key={key}
                      type={smooth ? "monotone" : "linear"}
                      connectNulls
                      dataKey={key}
                      dot={showDots ? { r: 2.5 } : false}
                      strokeWidth={2.25}
                      stroke={BOOK_COLORS.betmgm}
                      isAnimationActive={false}
                      onMouseOver={() => setHoverKey(key)}
                      onMouseOut={() => setHoverKey(null)}
                    />
                  );
                }
                return lines;
              })}
              <Brush
                dataKey="ts"
                height={22}
                travellerWidth={8}
                tickFormatter={(ts) =>
                  new Date(ts as number).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                }
                onChange={(range) => {
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
