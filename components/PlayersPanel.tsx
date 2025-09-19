// components/PlayersPanel.tsx
"use client";

import { useMemo, useState } from "react";

export function PlayersPanel({
  games,
  selectedGameIds,
  value,
  onChange,
}: {
  games: any[];
  selectedGameIds: string[];
  value: { player_id: string; full_name: string }[];
  onChange: (v: { player_id: string; full_name: string }[]) => void;
}) {
  const [q, setQ] = useState("");

  // Build grouped players by game for the selected games
  const grouped = useMemo(() => {
    const picked = new Set(selectedGameIds);
    const map: Record<string, { game: any; players: any[] }> = {};
    for (const g of games ?? []) {
      if (!picked.has(g.game_id)) continue;
      const plist = (g.participants ?? []).slice().sort((a: any, b: any) => a.full_name.localeCompare(b.full_name));
      map[g.game_id] = { game: g, players: plist };
    }
    return map;
  }, [games, selectedGameIds]);

  // Flatten + filter by search
  const allPlayers = useMemo(() => {
    const arr: Array<{ game_id: string; player_id: string; full_name: string }> = [];
    for (const gid of Object.keys(grouped)) {
      for (const p of grouped[gid].players) arr.push({ game_id: gid, player_id: p.player_id, full_name: p.full_name });
    }
    if (!q.trim()) return arr;
    const t = q.toLowerCase();
    return arr.filter((p) => p.full_name.toLowerCase().includes(t));
  }, [grouped, q]);

  const selectedIds = useMemo(() => new Set(value.map((v) => v.player_id)), [value]);

  function togglePlayer(p: { player_id: string; full_name: string }) {
    if (selectedIds.has(p.player_id)) onChange(value.filter((x) => x.player_id !== p.player_id));
    else onChange([...value, p]);
  }

  function selectAllVisible() {
    const set = new Set(selectedIds);
    const merged = [...value];
    for (const p of allPlayers) {
      if (!set.has(p.player_id)) {
        set.add(p.player_id);
        merged.push({ player_id: p.player_id, full_name: p.full_name });
      }
    }
    onChange(merged);
  }

  function clearAll() {
    onChange([]);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search players…"
          className="w-full border rounded-md px-3 py-2 text-sm"
        />
        <button className="px-3 py-2 border rounded-md text-sm bg-white hover:bg-gray-50" onClick={selectAllVisible}>
          Select all
        </button>
        <button className="px-3 py-2 border rounded-md text-sm bg-white hover:bg-gray-50" onClick={clearAll}>
          Clear
        </button>
      </div>

      {/* Grouped list by game */}
      <div className="space-y-4 max-h-[28rem] overflow-auto pr-1">
        {Object.keys(grouped).map((gid) => {
          const g = grouped[gid].game;
          const players = grouped[gid].players.filter((p: any) =>
            !q.trim() ? true : p.full_name.toLowerCase().includes(q.toLowerCase())
          );
          return (
            <div key={gid} className="border rounded-xl">
              <div className="px-3 py-2 bg-gray-50 border-b flex items-center justify-between">
                <div className="text-sm font-medium">
                  {g.away_team} @ {g.home_team}
                </div>
                <div className="text-xs text-gray-500">{new Date(g.commence_time).toLocaleString()}</div>
              </div>
              <div className="p-2 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {players.map((p: any) => {
                  const checked = selectedIds.has(p.player_id);
                  return (
                    <label
                      key={p.player_id}
                      className={`flex items-center gap-2 text-sm px-2 py-1 rounded-md border ${
                        checked ? "bg-blue-50 border-blue-300" : "bg-white hover:bg-gray-50"
                      }`}
                      onClick={() => togglePlayer({ player_id: p.player_id, full_name: p.full_name })}
                    >
                      <input type="checkbox" className="h-4 w-4" readOnly checked={checked} />
                      <span className="truncate">{p.full_name}</span>
                    </label>
                  );
                })}
                {!players.length && <div className="text-sm text-gray-500 px-2 py-1">No players match.</div>}
              </div>
            </div>
          );
        })}
        {!Object.keys(grouped).length && <div className="text-sm text-gray-500 px-2">Pick at least one game to list players.</div>}
      </div>
    </div>
  );
}
