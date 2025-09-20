// components/PlayersPanel.tsx
"use client";

import { useMemo, useState } from "react";

type Participant = {
  player_id: string;
  full_name?: string;
  team_abbr?: string;
};

type Game = {
  game_id: string;
  // We expect participants to be included by /api/games for TODAY
  participants?: Participant[];
};

function getPlayerId(p: any): string {
  return (p?.player_id ?? p?.id ?? "").toString();
}
function getPlayerName(p: any): string {
  return (p?.full_name ?? p?.name ?? p?.player_name ?? getPlayerId(p)).toString();
}
function uniqueBy<T>(arr: T[], keyFn: (x: T) => string) {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const it of arr) {
    const k = keyFn(it);
    if (!k) continue;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(it);
  }
  return out;
}

export function PlayersPanel({
  games,
  selectedGameIds,
  value,
  onChange,
}: {
  games: Game[];
  selectedGameIds: string[];
  value: { player_id: string; full_name: string }[];
  onChange: (players: { player_id: string; full_name: string }[]) => void;
}) {
  const [q, setQ] = useState("");

  // Build the pool from selected games; if none selected, use ALL today's games (the page already filtered /api/games to today)
  const pool = useMemo(() => {
    const gamesToUse =
      selectedGameIds.length > 0
        ? games.filter((g) => selectedGameIds.includes(g.game_id))
        : games;

    const participants = gamesToUse.flatMap((g) => g.participants ?? []);
    // Dedupe by player_id across multiple selected games
    const unique = uniqueBy(participants, (p) => getPlayerId(p));

    // Sort name A→Z for easier scan
    unique.sort((a, b) => getPlayerName(a).localeCompare(getPlayerName(b)));

    // Apply search
    const needle = q.trim().toLowerCase();
    const filtered =
      needle.length === 0
        ? unique
        : unique.filter((p) => getPlayerName(p).toLowerCase().includes(needle));

    // Normalize to { player_id, full_name } shape that the dashboard/chart expects
    return filtered.map((p) => ({
      player_id: getPlayerId(p),
      full_name: getPlayerName(p),
    }));
  }, [JSON.stringify(games), JSON.stringify(selectedGameIds), q]);

  const selectedIds = useMemo(() => new Set(value.map((v) => v.player_id)), [value]);

  const toggle = (p: { player_id: string; full_name: string }) => {
    if (selectedIds.has(p.player_id)) {
      onChange(value.filter((v) => v.player_id !== p.player_id));
    } else {
      onChange([...value, p]);
    }
  };

  const allSelected = pool.length > 0 && pool.every((p) => selectedIds.has(p.player_id));
  const toggleAll = () => {
    if (allSelected) {
      // Unselect *only* the players that are in the current filtered pool
      const poolIds = new Set(pool.map((p) => p.player_id));
      onChange(value.filter((v) => !poolIds.has(v.player_id)));
    } else {
      // Add all filtered pool (dedupe with existing)
      const map = new Map<string, { player_id: string; full_name: string }>();
      for (const v of value) map.set(v.player_id, v);
      for (const p of pool) map.set(p.player_id, p);
      onChange(Array.from(map.values()));
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Controls */}
      <div className="flex items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search players…"
          className="w-full border rounded-md px-3 py-1.5 text-sm"
        />
        <button
          onClick={toggleAll}
          className="px-2 py-1.5 text-xs border rounded-md bg-white hover:bg-gray-50"
        >
          {allSelected ? "Unselect All" : "Select All"}
        </button>
      </div>

      {/* List — fixed height with internal scroll to match Games card */}
      <div className="max-h-80 overflow-y-auto pr-1 border rounded-md">
        {pool.length === 0 ? (
          <div className="text-xs text-gray-500 p-3">No players match your search.</div>
        ) : (
          <ul className="divide-y">
            {pool.map((p) => {
              const checked = selectedIds.has(p.player_id);
              return (
                <li key={p.player_id}>
                  <label className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-gray-50">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-blue-600"
                        checked={checked}
                        onChange={() => toggle(p)}
                      />
                      <span className="text-sm">{p.full_name}</span>
                    </div>
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
