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

function matchesOutcome(market: MarketKey, outcome: OutcomeKey, american: number) {
  if (market === "batter_home_runs") {
    return outcome === "over" ? american >= 0 : outcome === "under" ? american < 0 : true;
  }
  return outcome === "yes" ? american >= 0 : outcome === "no" ? american < 0 : true;
}

function passBounds(market: MarketKey, outcome: OutcomeKey, american: number) {
  if (market === "batter_home_runs") {
    if (outcome === "over" && american > 2500) return false;
    if (outcome === "under" && american < -5000) return false;
  }
  return true;
}

const getPlayerId = (p: PlayerLike) => (p.player_id ?? p.id ?? "").toString();
const ymd = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// Market alias sets we’ll try in order
const MARKET_ALIASES: Record<MarketKey, string[]> = {
  batter_home_runs: ["batter_home_runs", "batter_home_run", "player_home_run"],
  batter_first_home_run: ["batter_first_home_run", "first_home_run"],
};

async function fetchOdds(playerId: string, marketKey?: string, gameId?: string) {
  const params = new URLSearchParams();
  if (marketKey) params.set("market_key", marketKey);
  if (gameId) params.set("game_id", gameId);
  const url = `/api/players/${encodeURIComponent(playerId)}/odds` + (params.toString() ? `?${params}` : "");
  const res = await fetch(url, { cache: "no-store" });
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

async function fetchHistorySmart(
  playerId: string,
  selectedGameId: string | undefined,
  selectedMarket: MarketKey,
  gameDates: Record<string, string>
): Promise<Snapshot[]> {
  const aliases = MARKET_ALIASES[selectedMarket];

  // 1) Try scoped by game_id with each alias
  if (selectedGameId) {
    for (const mk of aliases) {
      const scoped = await fetchOdds(playerId, mk, selectedGameId);
      if (scoped.length) return scoped;
    }
    // 2) If still empty, fetch unscoped but filter to the **selected game’s date**
    const targetDate = gameDates[selectedGameId];
    if (targetDate) {
      for (const mk of aliases) {
        const unscoped = await fetchOdds(playerId, mk, undefined);
        const filtered = unscoped.filter((r) => ymd(r.captured_at) === targetDate);
        if (filtered.length) return filtered;
      }
    }
    // 3) As a last resort when aliasing doesn’t match the API route, fetch NOTHING (we don’t want yesterday bleed)
    return [];
  }

  // No games selected → unscoped, try aliases
  for (const mk of aliases) {
    const rows = await fetchOdds(playerId, mk, undefined);
    if (rows.length) return rows;
  }
  return [];
}

export function OddsChart({
  gameIds,
  gameDates, // game_id -> 'YYYY-MM-DD'
  players,
  marketKey,
  outcome,
  refreshTick,
}: {
  gameIds: string[];
  gameDates: Record<string, string>;
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

      // Build (player, game?) pairs (no games → just per player)
      const pairs: Array<{ player_id: string; game_id?: string }> = [];
      if (gameIds.length > 0) {
        for (const gid of gameIds) {
          for (const p of players) {
            const pid = getPlayerId(p);
            if (pid) pairs.push({ player_id: pid, game_id: gid });
          }
        }
      } else {
        for (const p of players) {
          const pid = getPlayerId(p);
          if (pid) pairs.push({ player_id: pid });
        }
      }

      const acc: Record<string, Snapshot[]> = {};
      for (const item of pairs) {
        const rows = await fetchHistorySmart(item.player_id, item.game_id, marketKey, gameDates);
        for (const r of rows) {
          if (!matchesOutcome(marketKey, outcome, r.american_odds)) continue;
          if (!passBounds(marketKey, outcome, r.american_odds)) continue;
          const key = `${item.player_id}|${r.bookmaker}`;
          (acc[key] ||= []).push(r);
        }
      }

      // Sort time asc
      Object.values(acc).forEach((arr) =>
        arr.sort((a, b) => new Date(a.captured_at).getTime() - new Date(b.captured_at).getTime())
      );

      if (!cancelled) setSeries(acc);
    })();

    return () => {
      cancelled = true;
    };
  }, [JSON.stringify(gameIds), JSON.stringify(players), JSON.stringify(gameDates), marketKey, outcome, refreshTick]);

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
