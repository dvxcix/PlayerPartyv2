// components/MultiGamePicker.tsx
"use client";

import Image from "next/image";
import { useMemo } from "react";

export type Game = {
  id: string;                // mirrors game_id
  game_id: string;
  home_team_abbr: string;    // lowercase (e.g., "det")
  away_team_abbr: string;    // lowercase (e.g., "atl")
  commence_time: string;     // ISO
};

export default function MultiGamePicker({
  games,
  value,
  onChange,
}: {
  games: Game[];
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const sorted = useMemo(
    () => [...(games ?? [])].sort((a, b) => new Date(a.commence_time).getTime() - new Date(b.commence_time).getTime()),
    [games]
  );

  function toggle(id: string) {
    if (value.includes(id)) onChange(value.filter((x) => x !== id));
    else onChange([...value, id]);
  }

  function fmtET(iso: string) {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      timeZone: "America/New_York",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  }

  return (
    <div className="max-h-80 overflow-auto pr-1">
      <div className="grid gap-2 sm:grid-cols-2">
        {sorted.map((g) => {
          const checked = value.includes(g.id);
          return (
            <button
              key={g.id}
              onClick={() => toggle(g.id)}
              className={`w-full text-left border rounded-lg px-3 py-2 hover:bg-gray-50 flex items-center justify-between ${
                checked ? "ring-2 ring-blue-300 bg-blue-50/40" : ""
              }`}
            >
              <div className="flex items-center gap-2">
                <Image
                  src={`/logos/${g.away_team_abbr}.png`}
                  alt={g.away_team_abbr.toUpperCase()}
                  width={22}
                  height={22}
                />
                <span className="font-medium uppercase">{g.away_team_abbr}</span>
                <span className="text-gray-400">@</span>
                <Image
                  src={`/logos/${g.home_team_abbr}.png`}
                  alt={g.home_team_abbr.toUpperCase()}
                  width={22}
                  height={22}
                />
                <span className="font-medium uppercase">{g.home_team_abbr}</span>
              </div>
              <div className="text-xs text-gray-500">{fmtET(g.commence_time)}</div>
            </button>
          );
        })}
        {sorted.length === 0 && (
          <div className="text-sm text-gray-500">No games for today yet.</div>
        )}
      </div>
    </div>
  );
}
