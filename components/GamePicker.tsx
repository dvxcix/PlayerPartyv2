"use client";
import { useEffect } from "react";

type Props = {
  games: any[];
  value: string | null;
  onChange: (v: string) => void;
};

export function GamePicker({ games, value, onChange }: Props) {
  // simple custom-event wiring to keep code light without shadcn setup
  useEffect(() => {
    const handler = (e: any) => onChange(e.detail);
    window.addEventListener("select:value", handler);
    return () => window.removeEventListener("select:value", handler);
  }, [onChange]);

  return (
    <div className="space-y-1">
      <label className="text-sm font-medium">Game</label>
      <div className="relative">
        <div className="border rounded-md px-3 py-2 bg-white">{value ? games.find(g=>g.game_id===value)?.away_team + " @ " + games.find(g=>g.game_id===value)?.home_team : "Select a game"}</div>
        <div className="mt-2 border rounded-md bg-white p-2 max-h-64 overflow-auto shadow-sm">
          {games.map((g) => (
            <div
              key={g.game_id}
              className="cursor-pointer px-2 py-1 rounded hover:bg-gray-100 text-sm"
              onClick={() => onChange(g.game_id)}
            >
              {g.away_team} @ {g.home_team} — {new Date(g.commence_time).toLocaleString()}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
