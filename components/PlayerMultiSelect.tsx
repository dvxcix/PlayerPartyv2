"use client";
import { useMemo } from "react";

interface PlayerMultiSelectProps {
  players: {
    player_id: string;
    full_name: string;
    game_id: string;
  }[];
  selectedPlayers: string[];
  onChange: (players: string[]) => void;
}

export default function PlayerMultiSelect({
  players,
  selectedPlayers,
  onChange,
}: PlayerMultiSelectProps) {
  // Sort players alphabetically so it's easier to find
  const sortedPlayers = useMemo(() => {
    return [...players].sort((a, b) => a.full_name.localeCompare(b.full_name));
  }, [players]);

  // Toggle a player on/off
  function togglePlayer(id: string) {
    if (selectedPlayers.includes(id)) {
      onChange(selectedPlayers.filter((p) => p !== id));
    } else {
      onChange([...selectedPlayers, id]);
    }
  }

  return (
    <div className="max-h-64 overflow-y-auto border rounded p-2 bg-white space-y-1">
      {sortedPlayers.map((p) => (
        <div
          key={p.player_id}
          onClick={() => togglePlayer(p.player_id)}
          className={`p-2 rounded cursor-pointer ${
            selectedPlayers.includes(p.player_id)
              ? "bg-green-500 text-white"
              : "bg-gray-100 hover:bg-gray-200"
          }`}
        >
          {p.full_name}
        </div>
      ))}
    </div>
  );
}
