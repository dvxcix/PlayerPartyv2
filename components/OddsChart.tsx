// components/OddsChart.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Brush } from "recharts";
import { BOOK_COLORS } from "@/lib/odds";

type MarketKey = "batter_home_runs" | "batter_first_home_run";
type OutcomeKey = "over" | "under" | "yes" | "no";
type PlayerLike = { player_id?: string; id?: string; full_name?: string };

type Snapshot = {
  captured_at: string;
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

// UI-only outcome split by sign
function matchesOutcome(market: MarketKey, outcome: OutcomeKey, american: number) {
  if (market === "batter_home_runs") {
    return outcome === "over" ? american >= 0 : outcome === "under" ? american < 0 : true;
  }
  return outcome === "yes" ? american >= 0 : outcome === "no" ? american < 0 : true;
}

// Bounds for HR market
function passBounds(market: MarketKey, outcome: OutcomeKey, american: number) {
  if (market === "batter_home_runs") {
    if (outcome === "over" && american > 2500) return false;
    if (outcome === "under" && american < -5000) return false;
  }
  return true;
}

const getPlayerId = (p: PlayerLike) => (p.player_id ?? p.id ?? "").toString();

// Convert ISO ts to a YYYY-MM-DD **in ET**
function ymdET(iso: string): string {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")!.value;
  const m = parts.find((p) => p.type === "month")!.value;
  const day = parts.find((p) => p.type === "day")!.value;
  return `${y}-${m}-${day}`;
}

// Market alias sets (some rows may use slight variants)
const MARKET_ALIASES: Record<MarketKey, string[]> = {
  batter_home_runs: ["batter_home_runs", "batter_home_run", "player_home_run"],
  batter_first_home_run: ["batter_first_home_run", "first_home_run"],
};

async function fetchOdds(playerId: string, marketKey: string) {
  const params = new URLSearchParams({ market_key: marketKey });
  const res = await fetch(`/api/players/${encodeURIComponent(playerId)}/odds?${params.toString()}`, { cache: "no-store" });
  const json = await res.json().catch(() => null);
  if (!json || json.ok === false) return [] as Snapshot[];
  const raw = Array.isArray(json.data) ? json.data : Array.isArray(json) ? json : [];
  const out: Snapshot[] = [];
  for (const r of raw as any[]) {
    const book = normBook(String(r.bookmaker ?? ""));
    const ao = Number(r.american_odds);
    const ts = Date.parse(String(r.captured_at));
    if (!book) continue;
    if (!Number.isFinite(ao) || !Number.isFinite(ts)) continue;
    out.push({ captured_at: new Date(ts).toISOString(), american_odds: ao, bookmaker: book });
  }
  return out;
}

async function fetchTodayOnly(
  playerId: string,
  marketKey: MarketKey,
  targetDatesET: Set<string> | null // if null → no games selected, return full history
): Promise<Snapshot[]> {
  const aliases = MARKET_ALIASES[marketKey];
  let rows: Snapshot[] = [];
  for (const mk of aliases) {
    rows = await fetchOdds(playerId, mk);
    if (rows.length) break;
  }
  if (!rows.length) return [];

  // If games are selected, keep ONLY rows whose captured_at's ET date matches any selected game's ET date
  if (targetDatesET && targetDatesET.size > 0) {
    rows = rows.filter((r) => targetDatesET.has(ymdET(r.captured_at)));
  }
  return rows;
}

export function OddsChart({
  gameIds,
  gameDates, // game_id -> 'YYYY-MM-DD' in ET (from commence_time)
  players,
  marketKey,
  outcome,
  refreshTick,
}: {
  gameIds: string[];
  gameDates?: Record<string, string>;
  players: PlayerLike[];
  marketKey: MarketKey;
  outcome: OutcomeKey;
  refreshTick: number;
}) {
  const [series, setSeries] = useState<Record<string, Snapshot[]>>({}); // `${player}|${book}`

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (players.length === 0) {
        setSeries({});
        return;
      }

      // Build the set of selected game ET dates
      let targetDates: Set<string> | null = null;
      if (gameIds.length > 0 && gameDates) {
        targetDates = new Set<string>();
        for (const gid of gameIds) {
          const d = gameDates[gid];
          if (d) targetDates.add(d);
        }
      }

      const acc: Record<string, Snapshot[]> = {};

      // For each selected player, fetch history then filter to targetDates (if any)
      for (const p of players) {
        const pid = getPlayerId(p);
        if (!pid) continue;

        const rows = await fetchTodayOnly(pid, marketKey, targetDates);
        for (const r of rows) {
          if (!matchesOutcome(marketKey, outcome, r.american_odds)) continue;
          if (!passBounds(marketKey, outcome, r.american_odds)) continue;
          const key = `${pid}|${r.bookmaker}`;
          (acc[key] ||= []).push(r);
        }
      }

      Object.values(acc).forEach((arr) =>
        arr.sort((a, b) => new Date(a.captured_at).getTime() - new Date(b.captured_at).getTime())
      );

      if (!cancelled) setSeries(acc);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(gameIds), JSON.stringify(gameDates), JSON.stringify(players), marketKey, outcome, refreshTick]);

  const lines = useMemo(() => {
    const out: { key: string; book: "fanduel" | "betmgm"; points: { ts: number; american: number; implied: number }[] }[] =
      [];
    for (const [k, arr] of Object.entries(series)) {
      const book = k.split("|")[1] as "fanduel" | "betmgm";
      out.push({
        key: k,
        book,
        points: arr.map((r) => ({
          ts: new Date(r.captured_at).getTime(),
          american: r.american_odds,
          implied: toPct(r.american_odds),
        })),
      });
    }
    return out;
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
            <YAxis yAxisId="left" orientation="left" tickFormatter={(n) => AMERICAN(n as number)} domain={["auto", "auto"]} />
            <Tooltip
              labelFormatter={(ts) =>
                new Date(Number(ts)).toLocaleString(undefined, {
                  month: "numeric",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })
              }
              formatter={(val: any) => {
                const n = Number(val);
                const implied = (toPct(n) * 100).toFixed(1) + "%";
                return [`${AMERICAN(n)}  (${implied})`, "Odds"];
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
                stroke={BOOK_COLORS[L.book] ?? "#1E90FF"}
                strokeWidth={2}
                isAnimationActive={false}
              />
            ))}
            <Brush dataKey="ts" height={24} travellerWidth={8} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}