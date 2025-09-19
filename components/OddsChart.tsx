"use client";
import { useEffect, useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { BOOK_COLORS } from "@/lib/odds";

function useSeries(gameId: string | null, players: { player_id: string; full_name: string }[]) {
  const [series, setSeries] = useState<Record<string, any[]>>({});

  useEffect(() => {
    (async () => {
      const out: Record<string, any[]> = {};
      await Promise.all(players.map(async (p) => {
        const res = await fetch(`/api/players/${p.player_id}/odds${gameId ? `?game_id=${gameId}` : ""}`, { cache: "no-store" });
        const json = await res.json();
        if (json.ok) out[p.player_id] = json.data; // [{captured_at, american_odds, bookmaker}]
      }));
      setSeries(out);
    })();
  }, [gameId, players.map(p => p.player_id).join(",")]);

  const merged = useMemo(() => {
    const timeMap: Record<string, any> = {};
    for (const p of players) {
      for (const row of series[p.player_id] ?? []) {
        const t = row.captured_at;
        timeMap[t] ||= { captured_at: t };
        const key = `${p.player_id}__${row.bookmaker}`; // 123__fanduel | 123__betmgm
        timeMap[t][key] = row.american_odds;
      }
    }
    return Object.values(timeMap).sort((a: any, b: any) => new Date(a.captured_at).getTime() - new Date(b.captured_at).getTime());
  }, [series, players.map(p => p.player_id).join(",")]);

  return { merged };
}

export function OddsChart({ gameId, players }: { gameId: string | null; players: { player_id: string; full_name: string }[] }) {
  const { merged } = useSeries(gameId, players);

  const lines = players.flatMap((p) => [
    <Line key={`${p.player_id}__fanduel`} type="monotone" dataKey={`${p.player_id}__fanduel`} name={`${p.full_name} — FanDuel`} dot={false} strokeWidth={2} stroke={BOOK_COLORS.fanduel} />,
    <Line key={`${p.player_id}__betmgm`} type="monotone" dataKey={`${p.player_id}__betmgm`} name={`${p.full_name} — BetMGM`} dot={false} strokeWidth={2} stroke={BOOK_COLORS.betmgm} />,
  ]);

  return (
    <div className="h-[460px] w-full bg-white rounded-2xl p-3 shadow-sm">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={merged}>
          <XAxis dataKey="captured_at" tickFormatter={(t) => new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} />
          <YAxis domain={["auto","auto"]} />
          <Tooltip formatter={(v: any) => `${v}`} labelFormatter={(l) => new Date(l).toLocaleString()} />
          <Legend wrapperStyle={{ paddingTop: 8 }} />
          {lines}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
