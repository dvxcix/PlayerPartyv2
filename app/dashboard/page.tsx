"use client";
import { useState, useEffect } from "react";
import MultiGamePicker from "@/components/MultiGamePicker";
import PlayerMultiSelect from "@/components/PlayerMultiSelect";
import OddsChart from "@/components/OddsChart";

export default function DashboardPage() {
  const [games, setGames] = useState<any[]>([]);
  const [selectedGameIds, setSelectedGameIds] = useState<string[]>([]);
  const [players, setPlayers] = useState<any[]>([]);
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [oddsData, setOddsData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch today's games only
  useEffect(() => {
    async function fetchGames() {
      try {
        const res = await fetch("/api/games");
        const json = await res.json();

        if (json.ok && Array.isArray(json.data)) {
          const today = new Date().toISOString().split("T")[0];
          const todaysGames = json.data
            .filter((g: any) => g.commence_time.startsWith(today))
            .sort((a: any, b: any) =>
              a.commence_time.localeCompare(b.commence_time)
            );

          setGames(todaysGames);
        }
      } catch (err) {
        console.error("Failed to load games:", err);
      }
    }
    fetchGames();
  }, []);

  // Fetch players when games change
  useEffect(() => {
    if (!selectedGameIds.length) {
      setPlayers([]);
      return;
    }

    const selectedGames = games.filter((g) =>
      selectedGameIds.includes(g.game_id)
    );

    const allPlayers = selectedGames.flatMap((g) =>
      (g.participants || []).map((p: any) => ({
        player_id: p.player_id,
        full_name: p.players?.full_name || p.player_id,
        game_id: g.game_id,
      }))
    );

    setPlayers(allPlayers);
  }, [selectedGameIds, games]);

  // Fetch odds when players change
  useEffect(() => {
    async function fetchOdds() {
      if (!selectedPlayers.length || !selectedGameIds.length) {
        setOddsData([]);
        return;
      }

      setLoading(true);
      try {
        const params = new URLSearchParams();
        selectedPlayers.forEach((p) => params.append("player_ids", p));
        selectedGameIds.forEach((g) => params.append("game_ids", g));

        const res = await fetch(`/api/odds/history?${params.toString()}`);
        const json = await res.json();

        if (json.ok && Array.isArray(json.data)) {
          setOddsData(json.data);
        } else {
          setOddsData([]);
        }
      } catch (err) {
        console.error("Failed to load odds history:", err);
        setOddsData([]);
      }
      setLoading(false);
    }

    fetchOdds();
  }, [selectedPlayers, selectedGameIds]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-4">
        {/* Games Panel */}
        <div className="mb-4">
          <h2 className="text-lg font-semibold mb-2">Games (Today Only)</h2>
          <MultiGamePicker
            games={games}
            value={selectedGameIds}
            onChange={setSelectedGameIds}
          />
        </div>

        {/* Players Panel */}
        {selectedGameIds.length > 0 && (
          <div className="mb-4">
            <h2 className="text-lg font-semibold mb-2">Players</h2>
            <PlayerMultiSelect
              players={players}
              selectedPlayers={selectedPlayers}
              onChange={setSelectedPlayers}
            />
          </div>
        )}

        {/* Odds Chart */}
        <div className="mt-6">
          <h2 className="text-lg font-semibold mb-2">Odds History</h2>
          {loading ? (
            <p>Loading odds...</p>
          ) : (
            <OddsChart data={oddsData} />
          )}
        </div>
      </div>
    </div>
  );
}
