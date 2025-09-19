// app/dashboard/page.tsx
"use client";
import { useEffect, useMemo, useState } from "react";
import { GamePicker } from "@/components/GamePicker";
import { PlayerMultiSelect } from "@/components/PlayerMultiSelect";
import { OddsChart } from "@/components/OddsChart";

const MARKET_OPTIONS = [
  { key: "batter_home_runs", label: "Batter Home Runs (O/U)" },
  { key: "batter_first_home_run", label: "Batter First Home Run (Y/N)" },
] as const;
type MarketKey = typeof MARKET_OPTIONS[number]["key"];

export default function DashboardPage() {
  const [games, setGames] = useState<any[]>([]);
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [selectedPlayers, setSelectedPlayers] = useState<{ player_id: string; full_name: string }[]>([]);
  const [market, setMarket] = useState<MarketKey>("batter_home_runs");

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/games", { cache: "no-store" });
      const json = await res.json();
      if (json.ok) setGames(json.games);
    })();
  }, []);

  const selectedGame = useMemo(() => games.find((g) => g.game_id === selectedGameId), [games, selectedGameId]);

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="rounded-2xl border bg-white shadow-sm">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">MLB Odds Dashboard</h2>
        </div>
        <div className="p-4 grid gap-4 md:grid-cols-3">
          <div className="md:col-span-1 space-y-3">
            <GamePicker games={games} value={selectedGameId} onChange={setSelectedGameId} />
            <div className="space-y-1">
              <label className="text-sm font-medium">Market</label>
              <div className="grid grid-cols-1 gap-2">
                {MARKET_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    className={`px-3 py-2 border rounded-md text-sm text-left ${market === opt.key ? "bg-blue-50 border-blue-300" : "bg-white hover:bg-gray-50"}`}
                    onClick={() => setMarket(opt.key)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="md:col-span-2">
            <PlayerMultiSelect
              disabled={!selectedGame}
              participants={selectedGame?.participants ?? []}
              value={selectedPlayers}
              onChange={setSelectedPlayers}
            />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border bg-white shadow-sm">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">
            {MARKET_OPTIONS.find((m) => m.key === market)?.label} — Hourly History
          </h2>
        </div>
        <div className="p-4">
          <OddsChart gameId={selectedGameId} players={selectedPlayers} marketKey={market} />
        </div>
      </div>
    </div>
  );
}
