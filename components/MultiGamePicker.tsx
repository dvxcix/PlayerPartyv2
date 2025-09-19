// components/MultiGamePicker.tsx
"use client";

import Image from "next/image";
import { useMemo, useState } from "react";

export function MultiGamePicker({
  games,
  value,
  onChange,
}: {
  games: any[];
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const arr = games ?? [];
    if (!q.trim()) return arr;
    const t = q.toLowerCase();
    return arr.filter(
      (g: any) =>
        `${g.away_team} @ ${g.home_team}`.toLowerCase().includes(t) ||
        new Date(g.commence_time).toLocaleString().toLowerCase().includes(t)
    );
  }, [games, q]);

  function toggle(id: string) {
    const set = new Set(value);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    onChange([...set]);
  }

  function selectAllVisible() {
    const set = new Set(value);
    for (const g of filtered) set.add(g.game_id);
    onChange([...set]);
  }

  function clearAll() {
    onChange([]);
  }

  const logo = (abbr?: string) =>
    abbr ? `/logos/${String(abbr).toLowerCase()}.png` : "/logos/placeholder.png";

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search games..."
          className="w-full border rounded-md px-3 py-2 text-sm"
        />
        <button
          className="px-3 py-2 border rounded-md text-sm bg-white hover:bg-gray-50"
          onClick={selectAllVisible}
        >
          Select all
        </button>
        <button
          className="px-3 py-2 border rounded-md text-sm bg-white hover:bg-gray-50"
          onClick={clearAll}
        >
          Clear
        </button>
      </div>

      <div className="max-h-96 overflow-auto divide-y">
        {filtered.map((g: any) => {
          const checked = value.includes(g.game_id);
          return (
            <label
              key={g.game_id}
              className={`flex items-center justify-between gap-2 px-2 py-2 text-sm cursor-pointer ${
                checked ? "bg-blue-50" : ""
              }`}
              onClick={() => toggle(g.game_id)}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex items-center gap-2 shrink-0">
                  <Image
                    src={logo(g.away_team)}
                    alt={g.away_team}
                    width={20}
                    height={20}
                    className="rounded"
                  />
                  <span className="font-medium">{g.away_team}</span>
                </div>
                <span className="text-gray-400 shrink-0">@</span>
                <div className="flex items-center gap-2 shrink-0">
                  <Image
                    src={logo(g.home_team)}
                    alt={g.home_team}
                    width={20}
                    height={20}
                    className="rounded"
                  />
                  <span className="font-medium">{g.home_team}</span>
                </div>
                <span className="text-xs text-gray-500 truncate">
                  {new Date(g.commence_time).toLocaleString()}
                </span>
              </div>
              <input type="checkbox" className="h-4 w-4" readOnly checked={checked} />
            </label>
          );
        })}
        {!filtered.length && (
          <div className="text-sm text-gray-500 p-4">No games match your search.</div>
        )}
      </div>
    </div>
  );
}
