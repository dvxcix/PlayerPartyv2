// components/PlayersPanel.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { HeadshotImg } from "./HeadshotImg";

type Game = {
  id: string;
  home_abbr: string;
  away_abbr: string;
  start_time?: string;
  participants?: { player_id: string; full_name: string; team_abbr?: string }[];
};

type Player = { player_id: string; full_name: string };

export function PlayersPanel({
  games,
  selectedGameIds,
  value,
  onChange,
}: {
  games: Game[];
  selectedGameIds: string[];
  value: Player[];
  onChange: (players: Player[]) => void;
}) {
  const [query, setQuery] = useState("");

  // Build the list of players from selected games (unique by player_id)
  const availablePlayers: Player[] = useMemo(() => {
    const selectedSet = new Set(selectedGameIds);
    const map = new Map<string, Player>();
    for (const g of games) {
      if (selectedSet.size && !selectedSet.has(g.id)) continue;
      for (const p of g.participants ?? []) {
        if (!map.has(p.player_id)) {
          map.set(p.player_id, { player_id: p.player_id, full_name: p.full_name });
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => a.full_name.localeCompare(b.full_name));
  }, [games, selectedGameIds.join(",")]);

  // Filter by search
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return availablePlayers;
    return availablePlayers.filter((p) => p.full_name.toLowerCase().includes(q));
  }, [availablePlayers, query]);

  // Selection helpers
  const selectedIds = useMemo(() => new Set(value.map((v) => v.player_id)), [value]);

  function togglePlayer(p: Player) {
    if (selectedIds.has(p.player_id)) {
      onChange(value.filter((v) => v.player_id !== p.player_id));
    } else {
      onChange([...value, p]);
    }
  }

  function selectAllShown() {
    const merged = new Map<string, Player>();
    for (const v of value) merged.set(v.player_id, v);
    for (const p of filtered) merged.set(p.player_id, p);
    onChange(Array.from(merged.values()));
  }

  function clearAll() {
    onChange([]);
  }

  return (
    <div className="space-y-3">
      {/* Search & bulk actions */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          placeholder="Search players…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full px-3 py-2 border rounded-md text-sm"
        />
        <button className="px-2 py-2 border rounded-md text-xs hover:bg-gray-50" onClick={selectAllShown}>
          Select All
        </button>
        <button className="px-2 py-2 border rounded-md text-xs hover:bg-gray-50" onClick={clearAll}>
          Clear
        </button>
      </div>

      {/* List */}
      <div className="max-h-[360px] overflow-auto rounded-md border">
        {filtered.length === 0 ? (
          <div className="p-3 text-sm text-gray-500">No players match your search.</div>
        ) : (
          <ul className="divide-y">
            {filtered.map((p) => {
              const checked = selectedIds.has(p.player_id);
              return (
                <li key={p.player_id} className="p-2 hover:bg-gray-50">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => togglePlayer(p)}
                      className="mt-0.5"
                    />
                    {/* Headshot next to the name */}
                    <HeadshotImg fullName={p.full_name} size={28} />
                    <span className="text-sm">{p.full_name}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
