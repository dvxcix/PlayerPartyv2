// components/OddsChart.tsx
"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState, Dispatch, SetStateAction } from "react";
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
import type { PlayerPick } from "./PlayersPanel";

type MarketKey = "batter_home_runs" | "batter_first_home_run";
type OutcomeKey = "over" | "under" | "yes" | "no";

type RawRow = {
  captured_at: string;
  american_odds: number;
  bookmaker: "fanduel" | "betmgm" | string;
};
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

// Hide extreme/dirty points:
// - OVER / YES  -> hide if odds > +2500
// - UNDER / NO  -> hide if odds < -5000
function withinThreshold(outcome: OutcomeKey, american: number) {
  if (outcome === "over" || outcome === "yes") return american <= 2500;
  if (outcome === "under" || outcome === "no") return american >= -5000;
  return true;
}

// ----- Marker helpers -----
type MarkerStyle = "dot" | "initials" | "logo+initials";

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function makeMarkerRenderer(
  seriesKey: string,
  player: PlayerPick,
  marker: MarkerStyle,
  color: string
) {
  // Custom SVG renderer for <Line dot={...}> that closes over the series context
  return function DotRenderer(props: any) {
    const { cx, cy, payload } = props;
    if (cx == null || cy == null) return null;

    if (marker === "dot") {
      return (
        <circle cx={cx} cy={cy} r={2.5} fill={color} fillOpacity={0.95} />
      );
    }

    const label = initials(player.full_name);
    const size = 14; // marker size
    const half = size / 2;

    if (marker === "logo+initials") {
      const logo = player.team_abbr ? `/logos/${player.team_abbr}.png` : null;
      return (
        <g>
          {/* logo circle */}
          {logo ? (
            <>
              <defs>
                <clipPath id={`clip-${seriesKey}-${cx}-${cy}`}>
                  <circle cx={cx} cy={cy} r={half} />
                </clipPath>
              </defs>
              {/* Embedded raster logo */}
              <image
                href={logo}
                x={cx - half}
                y={cy - half}
                width={size}
                height={size}
                clipPath={`url(#clip-${seriesKey}-${cx}-${cy})`}
                preserveAspectRatio="xMidYMid slice"
              />
              <circle cx={cx} cy={cy} r={half} stroke={color} strokeWidth={1.5} fill="none" />
            </>
          ) : (
            <circle cx={cx} cy={cy} r={half} fill="#fff" stroke={color} strokeWidth={1.5} />
          )}
          {/* initials overlay */}
          <text
            x={cx}
            y={cy + 0.5}
            textAnchor="middle"
            fontSize="8"
            fontWeight={700}
            fill="#111"
            pointerEvents="none"
          >
            {label}
          </text>
        </g>
      );
    }

    // initials only
    return (
      <g>
        <circle cx={cx} cy={cy} r={half} fill="#fff" stroke={color} strokeWidth={1.5} />
        <text
          x={cx}
          y={cy + 0.5}
          textAnchor="middle"
          fontSize="8"
          fontWeight={700}
          fill="#111"
          pointerEvents="none"
        >
          {label}
        </text>
      </g>
    );
  };
}

export function OddsChart({
  gameIds,
  players,
  marketKey,
  outcome,
  refreshTick = 0,
}: {
  gameIds: string[];
  players: PlayerPick[];
  marketKey: MarketKey;
  outcome: OutcomeKey;
  refreshTick?: number;
}) {
  const [series, setSeries] = useState<Record<string, RawRow[]>>({});
  const [hoverKey, setHoverKey] = useState<string | null>(null);

  useEffect(() => setHoverKey(null), [
    players.map((p) => p.player_id).join(","),
    gameIds.join(","),
    marketKey,
    outcome,
  ]);

  // fetch + merge
  useEffect(() => {
    let aborted = false;
    (async () => {
      const out: Record<string, RawRow[]> = {};
      await Promise.all(
        players.map(async (p) => {
          let rows: RawRow[] = [];
          if (gameIds.length === 0) {
            const res = await fetch(
              `/api/players/${p.player_id}/odds?market_key=${marketKey}&t=${Date.now()}`,
              { cache: "no-store" }
            );
            const json = await res.json();
            if (json.ok) rows = json.data as RawRow[];
          } else {
            const parts = await Promise.all(
              gameIds.map(async (gid) => {
                const res = await fetch(
                  `/api/players/${p.player_id}/odds?market_key=${marketKey}&game_id=${gid}&t=${Date.now()}`,
                  { cache: "no-store" }
                );
                const json = await res.json();
                return json.ok ? (json.data as RawRow[]) : [];
              })
            );
            rows = parts.flat();
          }

          out[p.player_id] = rows
            .filter((r) => matchesOutcome(marketKey, outcome, Number(r.american_odds)))
            .filter((r) => withinThreshold(outcome, Number(r.american_odds)));
        })
      );
      if (!aborted) setSeries(out);
    })();
    return () => {
      aborted = true;
    };
  }, [
    players.map((p) => p.player_id).join(","),
    marketKey,
    outcome,
    gameIds.join(","),
    refreshTick,
  ]);

  // merge by timestamp
  const data: Point[] = useMemo(() => {
    const timeMap: Record<string, Point> = {};
    for (const p of players) {
      for (const r of series[p.player_id] ?? []) {
        const t = r.captured_at;
        if (!timeMap[t]) timeMap[t] = { captured_at: t, ts: Date.parse(t) };
        const key = `${p.player_id}__${r.bookmaker}`;
        timeMap[t][key] = r.american_odds;
      }
    }
    return Object.values(timeMap).sort((a, b) => a.ts - b.ts);
  }, [series, players.map((p) => p.player_id).join(",")]);

  // interactivity / layout
  const [height, setHeight] = useState(680);
  const [showFD, setShowFD] = useState(true);
  const [showMGM, setShowMGM] = useState(true);
  const [smooth, setSmooth] = useState(false);

  // NEW: marker style toggle
  const [markerStyle, setMarkerStyle] = useState<MarkerStyle>("logo+initials");

  // zoom/pan domain
  const tsMin = data.length ? data[0].ts : undefined;
  const tsMax = data.length ? data[data.length - 1].ts : undefined;
  const [xDomain, setXDomain] = useState<[number, number] | undefined>(undefined);

  useEffect(() => {
    if (tsMin !== undefined && tsMax !== undefined) setXDomain([tsMin, tsMax]);
  }, [tsMin, tsMax, players.map((p) => p.player_id).join(",")]);

  const playersById = useMemo(
    () => Object.fromEntries(players.map((p) => [p.player_id, p])),
    [players]
  );
  const hasData = data.length > 0;

  const fadeIfNotHovered = (key: string) => (hoverKey && hoverKey !== key ? 0.35 : 1);

  return (
    <div className="w-full bg-white rounded-2xl border shadow-sm">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 p-3 border-b text-sm">
        <div className="flex items-center gap-2">
          <button className="px-2 py-1 border rounded hover:bg-gray-50" onClick={() => zoom(setXDomain, xDomain, tsMin, tsMax, 0.5)} aria-label="Zoom in">＋</button>
          <button className="px-2 py-1 border rounded hover:bg-gray-50" onClick={() => zoom(setXDomain, xDomain, tsMin, tsMax, 1.5)} aria-label="Zoom out">－</button>
          <button className="px-2 py-1 border rounded hover:bg-gray-50" onClick={() => resetView(setXDomain, tsMin, tsMax)}>Reset</button>
        </div>

        <div className="flex items-center gap-1 pl-2">
          <span className="text-gray-500">Preset:</span>
          <button className="px-2 py-1 border rounded hover:bg-gray-50" onClick={() => applyPreset(setXDomain, tsMin, tsMax, 6)}>6h</button>
          <button className="px-2 py-1 border rounded hover:bg-gray-50" onClick={() => applyPreset(setXDomain, tsMin, tsMax, 12)}>12h</button>
          <button className="px-2 py-1 border rounded hover:bg-gray-50" onClick={() => applyPreset(setXDomain, tsMin, tsMax, 24)}>24h</button>
          <button className="px-2 py-1 border rounded hover:bg-gray-50" onClick={() => resetView(setXDomain, tsMin, tsMax)}>All</button>
        </div>

        <div className="flex items-center gap-3 pl-2">
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={showFD} onChange={() => setShowFD((v) => !v)} />
            <Image src="/miscimg/FD.png" alt="FanDuel" width={16} height={16} />
            <span>FanDuel</span>
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={showMGM} onChange={() => setShowMGM((v) => !v)} />
            <Image src="/miscimg/MGM.png" alt="BetMGM" width={16} height={16} />
            <span>BetMGM</span>
          </label>
        </div>

        {/* Marker style */}
        <div className="flex items-center gap-1 pl-2">
          <span className="text-gray-500">Markers:</span>
          <button
            className={`px-2 py-1 border rounded ${markerStyle === "dot" ? "bg-blue-50 border-blue-300" : "hover:bg-gray-50"}`}
            onClick={() => setMarkerStyle("dot")}
          >
            Dot
          </button>
          <button
            className={`px-2 py-1 border rounded ${markerStyle === "initials" ? "bg-blue-50 border-blue-300" : "hover:bg-gray-50"}`}
            onClick={() => setMarkerStyle("initials")}
          >
            Initials
          </button>
          <button
            className={`px-2 py-1 border rounded ${markerStyle === "logo+initials" ? "bg-blue-50 border-blue-300" : "hover:bg-gray-50"}`}
            onClick={() => setMarkerStyle("logo+initials")}
          >
            Logo+Initials
          </button>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center gap-2">
            <span className="text-gray-500">Height</span>
            <input type="range" min={360} max={1000} value={height} onChange={(e) => setHeight(Number(e.target.value))} />
            <span className="tabular-nums w-12 text-right">{height}px</span>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="w-full" style={{ height }} onWheel={(e) => wheelZoom(e, setXDomain, xDomain, data)}>
        {!hasData ? (
          <div className="h-full grid place-items-center text-sm text-gray-500">No snapshots for this selection yet.</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              margin={{ top: 8, right: 16, left: 12, bottom: 8 }}
              onMouseDown={(e) => handleMouseDown(e, xDomain, setXDomain)}
              onMouseMove={(e) => handleMouseMove(e, xDomain, setXDomain)}
              onMouseUp={() => (dragging.current = null)}
            >
              <CartesianGrid strokeDasharray="4 4" />
              <XAxis
                dataKey="ts"
                type="number"
                domain={xDomain ?? ["auto", "auto"]}
                scale="time"
                tickFormatter={(ts) => new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                minTickGap={48}
              />
              <YAxis tickFormatter={(v) => (Number(v) > 0 ? `+${v}` : `${v}`)} width={56} />
              <Tooltip
                isAnimationActive={false}
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;

                  const ts = typeof label === "number" ? label : Number(label);
                  const row = data.find((d) => d.ts === ts);

                  let item = null as any;
                  if (row && hoverKey && typeof row[hoverKey] === "number") {
                    item = { dataKey: hoverKey, value: row[hoverKey] } as any;
                  } else {
                    item = payload.find((p) => typeof p.value === "number");
                  }
                  if (!item) return null;

                  const [playerId, bookmaker] = String(item.dataKey).split("__");
                  const american = Number(item.value);
                  const prob = toImpliedPct(american);
                  const d = new Date(ts);

                  return (
                    <div className="rounded-md border bg-white px-3 py-2 shadow-sm text-sm">
                      <div className="mb-1 font-medium">
                        {d.toLocaleString([], { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span className="inline-flex items-center gap-2">
                          <Image
                            src={bookmaker === "fanduel" ? "/miscimg/FD.png" : "/miscimg/MGM.png"}
                            alt={bookmaker?.toUpperCase() ?? ""}
                            width={16}
                            height={16}
                          />
                          {playersById[playerId]?.full_name ?? playerId} — {bookmaker?.toUpperCase()}
                        </span>
                        <span className="tabular-nums">{AMERICAN(american)}</span>
                        <span className="text-gray-500 tabular-nums">{(prob * 100).toFixed(1)}%</span>
                      </div>
                    </div>
                  );
                }}
              />

              {/* Lines with custom markers; hover fade for non-focused series */}
              {players.map((p) => {
                const fdKey = `${p.player_id}__fanduel`;
                const mgmKey = `${p.player_id}__betmgm`;
                const fdDot = makeMarkerRenderer(fdKey, p, markerStyle, BOOK_COLORS.fanduel);
                const mgmDot = makeMarkerRenderer(mgmKey, p, markerStyle, BOOK_COLORS.betmgm);

                return (
                  <g key={p.player_id}>
                    {showFD && (
                      <Line
                        type={smooth ? "monotone" : "linear"}
                        connectNulls
                        dataKey={fdKey}
                        dot={fdDot as any}
                        activeDot={{ r: 6, onMouseOver: () => setHoverKey(fdKey), onMouseOut: () => setHoverKey(null) } as any}
                        strokeWidth={2.3}
                        stroke={BOOK_COLORS.fanduel}
                        strokeOpacity={fadeIfNotHovered(fdKey)}
                        isAnimationActive={false}
                        onMouseOver={() => setHoverKey(fdKey)}
                        onMouseOut={() => setHoverKey(null)}
                      />
                    )}
                    {showMGM && (
                      <Line
                        type={smooth ? "monotone" : "linear"}
                        connectNulls
                        dataKey={mgmKey}
                        dot={mgmDot as any}
                        activeDot={{ r: 6, onMouseOver: () => setHoverKey(mgmKey), onMouseOut: () => setHoverKey(null) } as any}
                        strokeWidth={2.3}
                        stroke={BOOK_COLORS.betmgm}
                        strokeOpacity={fadeIfNotHovered(mgmKey)}
                        isAnimationActive={false}
                        onMouseOver={() => setHoverKey(mgmKey)}
                        onMouseOut={() => setHoverKey(null)}
                      />
                    )}
                  </g>
                );
              })}

              <Brush
                dataKey="ts"
                height={22}
                travellerWidth={8}
                tickFormatter={(ts) => new Date(ts as number).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
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

/* ---------- panning / zoom helpers ---------- */

const dragging = { current: null as null | { startX: number; startDomain: [number, number] } };

function handleMouseDown(e: any, xDomain: [number, number] | undefined, setX: Dispatch<SetStateAction<[number, number] | undefined>>) {
  if (!xDomain || !e || typeof e.activeLabel !== "number") return;
  dragging.current = { startX: e.activeLabel, startDomain: xDomain };
}
function handleMouseMove(e: any, xDomain: [number, number] | undefined, setX: Dispatch<SetStateAction<[number, number] | undefined>>) {
  if (!dragging.current || !xDomain || !e || typeof e.activeLabel !== "number") return;
  const { startX, startDomain } = dragging.current;
  const delta = startX - e.activeLabel;
  setX([startDomain[0] + delta, startDomain[1] + delta]);
}

function wheelZoom(e: React.WheelEvent, setX: Dispatch<SetStateAction<[number, number] | undefined>>, domain: [number, number] | undefined, data: Point[]) {
  if (!domain) return;
  e.preventDefault();
  const [a, b] = domain;
  const center = (a + b) / 2;
  const factor = e.deltaY > 0 ? 1.15 : 0.85;
  const half = ((b - a) / 2) * factor;
  const minTs = data[0]?.ts ?? a;
  const maxTs = data[data.length - 1]?.ts ?? b;
  setX([Math.max(minTs, center - half), Math.min(maxTs, center + half)]);
}

function zoom(
  setX: Dispatch<SetStateAction<[number, number] | undefined>>,
  domain: [number, number] | undefined,
  tsMin: number | undefined,
  tsMax: number | undefined,
  factor: number
) {
  if (!domain) return;
  const [a, b] = domain;
  const center = (a + b) / 2;
  const half = ((b - a) / 2) * factor;
  const na = Math.max(tsMin ?? a, center - half);
  const nb = Math.min(tsMax ?? b, center + half);
  setX([na, nb]);
}

function resetView(
  setX: Dispatch<SetStateAction<[number, number] | undefined>>,
  tsMin: number | undefined,
  tsMax: number | undefined
) {
  if (tsMin !== undefined && tsMax !== undefined) setX([tsMin, tsMax]);
}

function applyPreset(
  setX: Dispatch<SetStateAction<[number, number] | undefined>>,
  tsMin: number | undefined,
  tsMax: number | undefined,
  hours: number
) {
  if (tsMin === undefined || tsMax === undefined) return;
  const end = tsMax;
  const start = end - hours * 60 * 60 * 1000;
  setX([Math.max(tsMin, start), end]);
}
