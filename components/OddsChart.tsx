// components/OddsChart.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import type { MarketKey, OutcomeKey, PlayerPick } from "@/lib/types";
import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";
import Image from "next/image";

type BookKey = "fanduel" | "betmgm";
function normalizeBook(book: string): BookKey {
  const k = (book || "").toLowerCase().replace(/[\s._-]/g, "");
  if (k === "fd" || k.includes("fanduel")) return "fanduel";
  if (k === "mgm" || k.includes("betmgm") || k.includes("mgmresorts")) return "betmgm";
  return "fanduel";
}

const BOOK_COLORS: Record<BookKey, string> = { fanduel: "#1E90FF", betmgm: "#8B4513" };

type Props = { selected: PlayerPick[]; marketKey: MarketKey; outcome: OutcomeKey };
type OddsRow = { player_id: string; game_id: string; bookmaker: string; american_odds: number; captured_at: string };
type SeriesMap = Record<string, OddsRow[]>; // `${player_id}|${bookmakerRaw}`

function etDateString(d: Date) { return d.toLocaleDateString("en-US", { timeZone: "America/New_York" }); }

function BookBadge({ book }: { book: string }) {
  const b = normalizeBook(book);
  const src = b === "fanduel" ? "/logos/FD.png" : "/logos/MGM.png";
  const alt = b === "fanduel" ? "FanDuel" : "BetMGM";
  return <Image src={src} alt={alt} width={18} height={18} className="inline-block align-middle mr-1" />;
}
function Head({ name }: { name: string }) {
  return <Image src={"/logos/_default.png"} alt={name} width={20} height={20} className="inline-block align-middle rounded-full mr-1" />;
}

function CustomTip(props: any) {
  const { active, payload, label } = props;
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="bg-white/95 backdrop-blur-sm border rounded-md shadow px-2 py-2 text-[12px]">
      <div className="font-semibold mb-1">{label} ET</div>
      {payload.map((p: any) => {
        const key = p.dataKey as string; // "playerId|bookRaw"
        const [playerId, bookRaw] = key.split("|");
        const name = (props.playerNameMap && props.playerNameMap[playerId]) || playerId;
        return (
          <div key={key} className="flex items-center gap-2">
            <Head name={name} />
            <span className="truncate max-w-[160px]">{name}</span>
            <span className="ml-1">·</span>
            <BookBadge book={bookRaw} />
            <span className="tabular-nums ml-1">{p.value}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function OddsChart({ selected, marketKey }: Props) {
  const [series, setSeries] = useState<SeriesMap>({});
  const [error, setError] = useState<string | null>(null);

  const todayET = useMemo(() => etDateString(new Date()), []);
  const playerNameMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const s of selected) m[s.player_id] = s.full_name;
    return m;
  }, [selected]);

  useEffect(() => {
    let cancelled = false;

    async function loadAll() {
      setError(null);
      setSeries({});
      try {
        const group = new Map<string, PlayerPick[]>();
        for (const row of selected) {
          const k = `${row.player_id}|${row.game_id}`;
          (group.get(k) || group.set(k, []).get(k)!).push(row);
        }
        const keys = Array.from(group.keys());
        const allSeries: SeriesMap = {};

        await Promise.all(
          keys.map(async (key) => {
            const [player_id, game_id] = key.split("|");
            const params = new URLSearchParams({ market_key: marketKey, game_id, date: todayET });
            const res = await fetch(`/api/players/${encodeURIComponent(player_id)}/odds?${params}`, { cache: "no-store" });
            if (!res.ok) throw new Error(await res.text());
            const json = await res.json() as { ok: boolean; data?: OddsRow[]; error?: string };
            if (!json.ok) throw new Error(json.error || "odds fetch failed");

            const rows = (json.data ?? []).slice().sort(
              (a, b) => new Date(a.captured_at).getTime() - new Date(b.captured_at).getTime()
            );
            for (const r of rows) {
              const skey = `${player_id}|${r.bookmaker}`; // keep raw; we normalize only for color/tooltips
              (allSeries[skey] ||= []).push(r);
            }
          })
        );

        if (!cancelled) setSeries(allSeries);
      } catch (e: any) {
        if (!cancelled) setError(String(e?.message ?? e));
      }
    }

    if (selected.length) loadAll(); else { setSeries({}); setError(null); }
    return () => { cancelled = true; };
  }, [selected.map((s) => `${s.player_id}|${s.game_id}`).join(","), marketKey, todayET]);

  const chartData = useMemo(() => {
    const times = new Set<number>();
    for (const arr of Object.values(series)) for (const r of arr) times.add(new Date(r.captured_at).getTime());
    const sortedTs = Array.from(times).sort((a, b) => a - b);

    const rows = sortedTs.map((tms) => {
      const row: any = { captured_at: new Date(tms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) };
      for (const [key, arr] of Object.entries(series)) {
        const exact = arr.find((r) => new Date(r.captured_at).getTime() === tms);
        row[key] = exact ? exact.american_odds : null;
      }
      return row;
    });

    return { rows, keys: Object.keys(series) };
  }, [series]);

  const hasData = (chartData.keys?.length ?? 0) > 0;

  return (
    <div className="border rounded-xl bg-white">
      <div className="sticky top-0 z-10 bg-white border-b px-3 py-2 font-semibold">Odds History</div>

      {error && <div className="px-4 py-3 text-sm text-red-600">{error}</div>}
      {!error && !hasData && (
        <div className="px-4 py-3 text-sm text-gray-500">
          {selected.length ? "No odds for this selection yet." : "Pick a game and player to get started."}
        </div>
      )}

      <div className="w-full h-[420px]">
        <ResponsiveContainer>
          <LineChart data={chartData.rows as any} margin={{ top: 10, right: 12, bottom: 12, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="captured_at" />
            <YAxis domain={["auto", "auto"]} />
            <Tooltip content={<CustomTip playerNameMap={playerNameMap} />} />
            <Legend />
            {(chartData.keys || []).map((key: string) => {
              const book = normalizeBook((key.split("|")[1] ?? ""));
              return (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  name={key.replace("|", " · ")}
                  stroke={BOOK_COLORS[book]}
                  dot={false}
                  strokeWidth={2}
                  connectNulls
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
