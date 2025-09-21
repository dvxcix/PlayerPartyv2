// components/OddsChart.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import type { MarketKey, OutcomeKey, PlayerPick, OddsSnapshot } from "@/lib/types";
import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";

const BOOK_COLORS: Record<"fanduel" | "betmgm", string> = {
  fanduel: "#1E90FF",
  betmgm: "#8B4513",
};

type Props = {
  selected: PlayerPick[];
  marketKey: MarketKey;
  outcome: OutcomeKey;
};

type SeriesMap = Record<string, OddsSnapshot[]>; // key = `${player_id}|${bookmaker}`

function etDateString(d: Date) {
  return d.toLocaleDateString("en-US", { timeZone: "America/New_York" });
}

export default function OddsChart({ selected, marketKey }: Props) {
  const [series, setSeries] = useState<SeriesMap>({});
  const [error, setError] = useState<string | null>(null);
  const [loadingKey, setLoadingKey] = useState<string>("");

  const todayET = useMemo(() => etDateString(new Date()), []);

  useEffect(() => {
    let cancelled = false;

    async function loadAll() {
      setError(null);
      setSeries({});
      setLoadingKey(selected.map((s) => `${s.game_id}|${s.player_id}`).join(","));

      try {
        const groupByPlayerGame = new Map<string, PlayerPick[]>();
        for (const row of selected) {
          const k = `${row.player_id}|${row.game_id}`;
          const arr = groupByPlayerGame.get(k) || [];
          arr.push(row);
          groupByPlayerGame.set(k, arr);
        }

        const entries = Array.from(groupByPlayerGame.keys());
        const allSeries: SeriesMap = {};

        await Promise.all(
          entries.map(async (key) => {
            const [player_id, game_id] = key.split("|");
            const params = new URLSearchParams();
            params.set("market_key", marketKey);
            params.set("game_id", game_id);
            params.set("date", todayET); // force “today” filter (ET) server-side

            const res = await fetch(`/api/players/${encodeURIComponent(player_id)}/odds?${params.toString()}`, {
              cache: "no-store",
            });

            if (!res.ok) {
              const text = await res.text();
              throw new Error(`Non-JSON from /api/players/:id/odds: ${text.slice(0, 120)}`);
            }
            const json = (await res.json()) as { ok: boolean; data?: OddsSnapshot[]; error?: string };
            if (!json.ok) throw new Error(json.error || "odds fetch failed");

            const snaps = (json.data ?? []).slice().sort((a, b) => {
              return new Date(a.captured_at).getTime() - new Date(b.captured_at).getTime();
            });

            for (const s of snaps) {
              const skey = `${player_id}|${s.bookmaker}`;
              (allSeries[skey] ||= []).push(s);
            }
          })
        );

        if (!cancelled) setSeries(allSeries);
      } catch (e: any) {
        if (!cancelled) setError(String(e?.message ?? e));
      } finally {
        if (!cancelled) setLoadingKey("");
      }
    }

    if (selected.length) loadAll();
    else {
      setSeries({});
      setError(null);
    }

    return () => {
      cancelled = true;
    };
  }, [selected.map((s) => `${s.player_id}|${s.game_id}`).join(","), marketKey, todayET]);

  // Build a merged time-axis for Recharts
  const chartData = useMemo(() => {
    const times = new Set<number>();
    for (const arr of Object.values(series)) {
      for (const r of arr) times.add(new Date(r.captured_at).getTime());
    }
    const sortedTs = Array.from(times).sort((a, b) => a - b);

    const rows = sortedTs.map((tms) => {
      const row: any = { captured_at: new Date(tms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) };
      for (const [key, arr] of Object.entries(series)) {
        // find point with closest timestamp (or exact)
        const exact = arr.find((r) => new Date(r.captured_at).getTime() === tms);
        row[key] = exact ? exact.american_odds : null;
      }
      return row;
    });

    const seriesKeys = Object.keys(series);
    return { rows, seriesKeys };
  }, [series]);

  return (
    <div className="border rounded-xl bg-white">
      <div className="sticky top-0 z-10 bg-white border-b px-3 py-2 font-semibold">Odds History</div>

      {error && <div className="px-4 py-3 text-sm text-red-600">{error}</div>}
      {!error && !Object.keys(series).length && (
        <div className="px-4 py-3 text-sm text-gray-500">
          {selected.length ? "No snapshots for this selection yet." : "Pick a game and player to get started."}
        </div>
      )}

      <div className="w-full h-[420px]">
        <ResponsiveContainer>
          <LineChart data={(chartData as any).rows} margin={{ top: 10, right: 12, bottom: 12, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="captured_at" />
            <YAxis domain={["auto", "auto"]} />
            <Tooltip />
            <Legend />
            {(chartData as any).seriesKeys?.map((key: string) => {
              const book = key.split("|")[1] as "fanduel" | "betmgm";
              return (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  name={key.replace("|", " · ")}
                  stroke={BOOK_COLORS[book]}
                  dot={false}
                  strokeWidth={2}
                  isAnimationActive={false}
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
