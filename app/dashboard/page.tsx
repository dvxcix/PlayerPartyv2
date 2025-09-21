// app/dashboard/page.tsx
"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import MultiGamePicker from "@/components/MultiGamePicker";
import PlayersPanel from "@/components/PlayersPanel";
import OddsChart from "@/components/OddsChart";
import type { ApiGame, Game, MarketKey, OutcomeKey, PlayerPick } from "@/lib/types";

type ApiGamesResp = { ok: boolean; data?: ApiGame[]; error?: string };

export default function DashboardPage() {
  const [games, setGames] = useState<Game[]>([]);
  const [gamesErr, setGamesErr] = useState<string | null>(null);
  const [selectedGameIds, setSelectedGameIds] = useState<string[]>([]);
  const [selectedPlayers, setSelectedPlayers] = useState<PlayerPick[]>([]);
  const [market, setMarket] = useState<MarketKey>("batter_home_runs");
  const [outcome] = useState<OutcomeKey>("yes");

  // Load games (today ET only) via API
  useEffect(() => {
    let cancelled = false;
    async function run() {
      setGamesErr(null);
      try {
        const res = await fetch("/api/games", { cache: "no-store" });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`Non-JSON from /api/games: ${text.slice(0, 120)}`);
        }
        const json: ApiGamesResp = await res.json();
        if (!json.ok) throw new Error(json.error || "Unknown error");
        if (!Array.isArray(json.data)) throw new Error("No games array in response");

        const rows: Game[] = (json.data ?? []).map((g) => ({
          game_id: g.game_id,
          commence_time: g.commence_time,
          home_team: (g.home_team ?? "").toUpperCase(),
          away_team: (g.away_team ?? "").toUpperCase(),
        }));
        if (!cancelled) setGames(rows);
      } catch (e: any) {
        if (!cancelled) setGamesErr(String(e?.message ?? e));
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, []);

  // Keep player selections valid when games are toggled
  const filteredPlayers = useMemo(() => {
    if (!selectedGameIds.length) return selectedPlayers;
    return selectedPlayers.filter((p) => selectedGameIds.includes(p.game_id));
  }, [selectedPlayers, selectedGameIds]);

  useEffect(() => {
    if (filteredPlayers.length !== selectedPlayers.length) {
      setSelectedPlayers(filteredPlayers);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGameIds.join(",")]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white border-b">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center gap-3 py-2">
            <Image src="/miscimg/playerpartylogo.png" alt="PlayerParty" width={40} height={40} />
            <div className="font-semibold text-lg">MLB Player Odds — Today</div>
            <div className="ml-auto flex items-center gap-2">
              <label className="text-sm text-gray-500">Market</label>
              <select
                className="border rounded px-2 py-1 text-sm"
                value={market}
                onChange={(e) => setMarket(e.target.value as MarketKey)}
              >
                <option value="batter_home_runs">Home Run</option>
                <option value="batter_first_home_run">First HR</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Main grid */}
      <div className="max-w-7xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1 space-y-4">
          {/* Games */}
          <div>
            {gamesErr ? (
              <div className="border rounded-xl bg-white px-3 py-3 text-sm text-red-600">
                Failed to load games: {gamesErr}
              </div>
            ) : (
              <div className="p-0">
                <MultiGamePicker games={games} value={selectedGameIds} onChange={setSelectedGameIds} />
              </div>
            )}
          </div>

          {/* Players */}
          <div>
            <PlayersPanel
              selectedGameIds={selectedGameIds}
              value={selectedPlayers}
              onChange={setSelectedPlayers}
            />
          </div>
        </div>

        {/* Chart */}
        <div className="lg:col-span-2 relative">
          <OddsChart selected={selectedPlayers} marketKey={market} outcome={"yes"} />

          {/* Center-right watermark */}
          <div className="pointer-events-none absolute top-1/2 right-6 -translate-y-1/2 opacity-20">
            <Image src="/miscimg/playerpartylogo.png" alt="logo" width={120} height={120} />
          </div>
        </div>
      </div>
    </div>
  );
}
