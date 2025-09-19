"use client";
import { useEffect, useMemo, useState } from "react";
import { GamePicker } from "@/components/GamePicker";
import { PlayerMultiSelect } from "@/components/PlayerMultiSelect";
import { OddsChart } from "@/components/OddsChart";

export default function DashboardPage() {
  const [games, setGames] = useState<any[]>([]);
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [selectedPlayers, setSelectedPlayers] = useState<{ player_id: string; full_name: string }[]>([]);

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
          <div className="md:col-span-1">
            <GamePicker games={games} value={selectedGameId} onChange={setSelectedGameId} />
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
          <h2 className="text-lg font-semibold">Anytime HR Odds — Hourly History</h2>
        </div>
        <div className="p-4">
          <OddsChart gameId={selectedGameId} players={selectedPlayers} />
        </div>
      </div>
    </div>
  );
}
