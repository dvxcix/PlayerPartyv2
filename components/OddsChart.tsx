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

type PlayerLite = { player_id: string; full_name: string };

type Snapshot = {
  captured_at: string; // ISO
  american_odds: number;
  bookmaker: "fanduel" | "betmgm";
};

const AMERICAN = (n: number) => (n > 0 ? `+${n}` : `${n}`);
const toPct = (a: number) => (a > 0 ? 100 / (a + 100) : Math.abs(a) / (Math.abs(a) + 100));

const normBook = (b: string): "fanduel" | "betmgm" | null => {
  const s = (b || "").toLowerCase().replace(/[\s_-]+/g, "");
  if (s === "fanduel" || s === "fd") return "fanduel";
  if (s === "betmgm" || s === "mgm") return "betmgm";
  return null;
};

// (+) = Over/Yes, (-) = Under/No (UI-only split)
function matchesOutcome(market: MarketKey, outcome: OutcomeKey, american: number) {
  if (market === "batter_home_runs") {
    return outcome === "over" ? american >= 0 : outcome === "under" ? american < 0 : true;
  }
  return outcome === "yes" ? american >= 0 : outcome === "no" ? american < 0 : true;
}

// We hide extreme bad data per your rule
function passBounds(market: MarketKey, outcome: OutcomeKey, american: number) {
  if (market === "batter_home_runs") {
    if (outcome === "over" && american > 2500) return false;
    if (outcome === "under" && american < -5000) return false;
  }
  // (no special bounds for first HR unless you want them)
  return true;
}

async function fetchHistory(playerId: string, gameId: string | undefined, marketKey: MarketKey) {
  const params = new URLSearchParams({ market_key: marketKey });
  if (gameId) params.set("game_id", gameId);
  const res = await fetch(`/api/players/${encodeURIComponent(playerId)}/odds?` + params.toString(), {
    cache: "no-store",
  });
  const json = await res.json();
  if (!json?.ok) return [];
  // Some versions return { ok, data }, others return array directly
  const rows = Array.isArray(json.data) ? json.data : Array.isArray(json) ? json : [];
  return (rows as any[])
    .map((r) => ({
      captured_at: r.captured_at,
      american_odds: r.american_odds,
      bookmaker: normBook(r.bookmaker),
    }))
    .filter((r) => r.bookmaker);
}

export function OddsChart({
  gameIds,
  players,
  marketKey,
  outcome,
  refreshTick,
}: {
  gameIds: string[];
  players: PlayerLite[];
  marketKey: MarketKey;
  outcome: OutcomeKey;
  refreshTick: number;
}) {
  const [series, setSeries] = useState<
    Record<
      string, // `${player_id}|${book}`
      Snapshot[]
    >
  >({});

  useEffect(() => {
    let cancelled = false;

    (async () => {
      // If specific games are selected, we query per (player, game).
      // If none selected, we query per player (all games).
      const pairs: Array<{ player_id: string; game_id?: string }> = [];
      if (gameIds.length > 0) {
        for (const gid of gameIds) {
          for (const p of players) pairs.push({ player_id: p.player_id, game_id: gid });
        }
      } else {
        for (const p of players) pairs.push({ player_id: p.player_id });
      }

      const out: typeof series = {};
      for (const item of pairs) {
        const rows = await fetchHistory(item.player_id, item.game_id, marketKey);
        for (const r of rows) {
          if (!matchesOutcome(marketKey, outcome, r.american_odds)) continue;
          if (!passBounds(marketKey, outcome, r.american_odds)) continue;

          const key = `${item.player_id}|${r.bookmaker}`;
          if (!out[key]) out[key] = [];
          out[key].push(r as Snapshot);
        }
      }

      // sort each by time
      Object.values(out).forEach((arr) =>
        arr.sort((a, b) => new Date(a.captured_at).getTime() - new Date(b.captured_at).getTime())
      );

      if (!cancelled) setSeries(out);
    })();

    return () => {
      cancelled = true;
    };
  }, [JSON.stringify(gameIds), JSON.stringify(players), marketKey, outcome, refreshTick]);

  // Flatten to recharts shape: one line per `${player}|${book}`
  const lines = useMemo(() => {
    const result: { key: string; label: string; book: "fanduel" | "betmgm"; points: any[] }[] = [];
    for (const [key, rows] of Object.entries(series)) {
      const [player_id, book] = key.split("|");
      if (book !== "fanduel" && book !== "betmgm") continue;
      const points = rows.map((r) => ({
        ts: new Date(r.captured_at).getTime(),
        american: r.american_odds,
        implied: toPct(r.american_odds),
      }));
      result.push({
        key,
        label: `${player_id} (${book === "fanduel" ? "FD" : "MGM"})`,
        book: book as "fanduel" | "betmgm",
        points,
      });
    }
    return result;
  }, [series]);

  const empty = lines.length === 0;

  return (
    <div className="w-full" style={{ height: 420 }}>
      {empty ? (
        <div className="text-sm text-gray-500 p-4">No snapshots for this selection yet.</div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart margin={{ top: 10, left: 10, right: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              type="number"
              dataKey="ts"
              domain={["dataMin", "dataMax"]}
              tickFormatter={(t) =>
                new Date(t).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
              }
            />
            <YAxis
              yAxisId="left"
              orientation="left"
              tickFormatter={(n) => AMERICAN(n as number)}
              domain={["auto", "auto"]}
            />
            <Tooltip
              labelFormatter={(ts) =>
                new Date(Number(ts)).toLocaleString(undefined, {
                  month: "numeric",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })
              }
              formatter={(val: any, _name, ctx) => {
                const n = Number(val);
                const implied = (toPct(n) * 100).toFixed(1) + "%";
                const lineMeta = lines.find((L) => ctx?.dataKey?.toString().includes(L.key));
                const who = lineMeta?.label ?? "";
                return [`${AMERICAN(n)}  (${implied})`, who];
              }}
            />
            {lines.map((L) => (
              <Line
                key={L.key}
                data={L.points}
                type="monotone"
                dataKey="american"
                yAxisId="left"
                dot={false}
                stroke={BOOK_COLORS[L.book] ?? "#8884d8"}
                strokeWidth={2}
                isAnimationActive={false}
                name={L.label}
              />
            ))}
            <Brush dataKey="ts" height={24} travellerWidth={8} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
