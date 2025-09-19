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

type RawRow = { captured_at: string; american_odds: number; bookmaker: string };
type Point = {
  captured_at: string;
  [seriesKey: string]: number | string;
};

const AMERICAN = (n: number) => (n > 0 ? `+${n}` : `${n}`);
const toImpliedPct = (american: number) =>
  american > 0 ? 100 / (american + 100) : Math.abs(american) / (Math.abs(american) + 100);

// Outcome logic (front-end only) based on your current data convention:
// + price => Over/Yes, - price => Under/No
function rowMatchesOutcome(
  marketKey: MarketKey,
  outcome: OutcomeKey,
  american: number
): boolean {
  if (marketKey === "batter_home_runs") {
    if (outcome === "over") return american >= 0;
    if (outcome === "under") return american < 0;
  } else {
    // batter_first_home_run
    if (outcome === "yes") return american >= 0;
    if (outcome === "no") return american < 0;
  }
  return true;
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
            // Filter by outcome using price sign convention
            const filtered: RawRow[] = (json.data as RawRow[]).filter((r) =>
              rowMatchesOutcome(marketKey, outcome, Number(r.american_odds))
            );
            out[p.player_id] = filtered;
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
        if (!timeMap[t]) timeMap[t] = { captured_at: t };
        const key = `${p.player_id}__${r.bookmaker}`; // e.g., "123__fanduel"
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
        })}
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

  const playersById = useMemo(() => {
    const m: Record<string, Player> = {};
    for (const p of players) m[p.player_id] = p;
    return m;
  }, [players]);

  // Build 2 lines per player (FD + MGM). Legend items are clickable to mute a series.
  const lines = players.flatMap((p) => [
    <Line
      key={`${p.player_id}__fanduel`}
      type="linear"
      connectNulls
      dataKey={`${p.player_id}__fanduel`}
      name={`${p.full_name} — FanDuel`}
      dot={{ r: 2.5 }}
      strokeWidth={2.25}
      stroke={BOOK_COLORS.fanduel}
      isAnimationActive={false}
    />,
    <Line
      key={`${p.player_id}__betmgm`}
      type="linear"
      connectNulls
      dataKey={`${p.player_id}__betmgm`}
      name={`${p.full_name} — BetMGM`}
      dot={{ r: 2.5 }}
      strokeWidth={2.25}
      stroke={BOOK_COLORS.betmgm}
      isAnimationActive={false}
    />,
  ]);

  const hasData = data.length > 0;

  return (
    <div className="h-[520px] w-full bg-white rounded-2xl p-3 shadow-sm">
      {!hasData ? (
        <div className="h-full grid place-items-center text-sm text-gray-500">
          No snapshots for this outcome yet. Try switching to OVER/YES, or wait for the next cron.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 16, left: 12, bottom: 16 }}>
            <CartesianGrid strokeDasharray="4 4" />
            <XAxis
              dataKey="captured_at"
              tickFormatter={(t) =>
                new Date(t as string).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
              }
              minTickGap={48}
            />
            <YAxis tickFormatter={(v) => (Number(v) > 0 ? `+${v}` : `${v}`)} width={56} />
            <Tooltip content={<CustomTooltip playersById={playersById} />} isAnimationActive={false} />
            <Legend wrapperStyle={{ paddingTop: 8 }} />
            {lines}
            <Brush dataKey="captured_at" height={22} travellerWidth={8} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
