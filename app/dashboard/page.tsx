"use client";

import { useEffect, useState } from "react";
import OddsChart from "@/components/OddsChart";
import MultiGamePicker from "@/components/MultiGamePicker";
import MultiPlayerPicker from "@/components/MultiPlayerPicker";

type Game = {
  game_id: string;
  home_team_abbr: string;
  away_team_abbr: string;
  commence_time: string;
  participants: {
    player_id: string;
    team_abbr: string;
    players: { full_name: string };
  }[];
};

export default function DashboardPage() {
  const [games, setGames] = useState<Game[]>([]);
  const [selectedGameIds, setSelectedGameIds] = useState<string[]>([]);
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [marketKey, setMarketKey] = useState("batter_home_runs");
  const [oddsData, setOddsData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Load today's games
  useEffect(() => {
    async function fetchGames() {
      try {
        const res = await fetch("/api/games");
        const json = await res.json();
        if (json.ok && Array.isArray(json.data)) {
          setGames(json.data);
        } else {
          console.error("Failed to load games:", json.error || "Unknown error");
        }
      } catch (e) {
        console.error("Error loading games:", e);
      }
    }
    fetchGames();
  }, []);

  // Load odds when players or games change
  useEffect(() => {
    async function fetchOdds() {
      if (!selectedPlayers.length || !selectedGameIds.length) return;

      setLoading(true);
      try {
        const res = await fetch(
          `/api/odds/history?player_ids=${selectedPlayers.join(",")}&market_key=${marketKey}&game_id=${selectedGameIds[0]}`
        );
        const json = await res.json();
        if (json.ok) {
          setOddsData(json.data);
        } else {
          console.error("Failed to load odds:", json.error || "Unknown error");
        }
      } catch (e) {
        console.error("Error loading odds:", e);
      } finally {
        setLoading(false);
      }
    }
    fetchOdds();
  }, [selectedPlayers, selectedGameIds, marketKey]);

  // Get players from selected games
  const playersForSelectedGames = games
    .filter((g) => selectedGameIds.includes(g.game_id))
    .flatMap((g) => g.participants.map((p) => ({
      id: p.player_id,
      full_name: p.players.full_name,
      team: p.team_abbr,
      game_id: g.game_id
    })));

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white border-b">
        <div className="max-w-7xl mx-auto px-4">
          <h1 className="text-2xl font-bold py-4">MLB Odds Dashboard</h1>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Game Picker */}
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="text-lg font-semibold mb-2">Select Games</h2>
          <MultiGamePicker
            games={games}
            value={selectedGameIds}
            onChange={setSelectedGameIds}
          />
        </div>

        {/* Player Picker */}
        {selectedGameIds.length > 0 && (
          <div className="bg-white rounded-lg shadow p-4">
            <h2 className="text-lg font-semibold mb-2">Select Players</h2>
            <MultiPlayerPicker
              players={playersForSelectedGames}
              value={selectedPlayers}
              onChange={setSelectedPlayers}
            />
          </div>
        )}

        {/* Odds Chart */}
        {selectedPlayers.length > 0 && (
          <div className="bg-white rounded-lg shadow p-4">
            <h2 className="text-lg font-semibold mb-2">Odds History</h2>
            {loading ? (
              <p>Loading odds...</p>
            ) : oddsData.length > 0 ? (
              <OddsChart data={oddsData} />
            ) : (
              <p>No odds data available for this selection.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
