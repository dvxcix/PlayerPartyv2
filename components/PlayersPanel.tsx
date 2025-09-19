// components/PlayersPanel.tsx
"use client";

import { useMemo, useState } from "react";
import { HeadshotImg } from "./HeadshotImg";

type AnyParticipant =
  | { player_id: string; full_name?: string; team_abbr?: string; players?: { full_name?: string } }
  | Record<string, any>;

type AnyGame = {
  id?: string;
  game_id?: string;
  participants?: AnyParticipant[];
  game_participants?: AnyParticipant[];
  [k: string]: any;
};

type Player = { player_id: string; full_name: string };

function getGameId(g: AnyGame): string | undefined {
  return (g.id ?? g.game_id)?.toString();
}

function getParticipants(g: AnyGame): AnyParticipant[] {
  return (g.participants ?? g.game_participants ?? []) as AnyParticipant[];
}

function normalizePlayer(p: AnyParticipant | null | undefined): Player | null {
  if (!p) return null;
  const player_id = (p as any).player_id ?? (p as any).playerId ?? (p as any).id;
  if (!player_id) return null;

  const full_name =
    (p as any).full_name ??
    (p as any).players?.full_name ??
    String(player_id);

  return { player_id: String(player_id), full_name: String(full_name) };
}

export function PlayersPanel({
  games,
  selectedGameIds,
  value,
  onChange,
}: {
  games: AnyGame[];
  selectedGameIds: string[];
  value: Player[];
  onChange: (players: Player[]) => void;
}) {
  const [query, setQuery] = useState("");

  // Build the source player list:
  // - If no games selected: all players from all games
  // - Else: players only from selected games (union)
  const availablePlayers: Player[] = useMemo(() => {
    const filterToSelected = selectedGameIds && selectedGameIds.length > 0;
    const selectedSet = new Set((selectedGameIds ?? []).map(String));
    const map = new Map<string, Player>();

    for (const g of games ?? []) {
      const gid = getGameId(g);
      if (filterToSelected && (!gid || !selectedSet.has(String(gid)))) continue;

      const parts = getParticipants(g);
      for (const raw of parts) {
        const p = normalizePlayer(raw);
        if (!p) continue;
        if (!map.has(p.player_id)) map.set(p.player_id, p);
      }
    }

    return Array.from(map.values()).sort((a, b) => a.full_name.localeCompare(b.full_name));
  }, [games, selectedGameIds.map(String).join(",")]);

  // Filter by search text
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return availablePlayers;
    return availablePlayers.filter((p) => p.full_name.toLowerCase().includes(q));
  }, [availablePlayers, query]);

  // Current selection set for fast lookups
  const selectedIds = useMemo(() => new Set(value.map((v) => v.player_id)), [value]);

  function togglePlayer(p: Player) {
    if (selectedIds.has(p.player_id)) {
      onChange(value.filter((v) => v.player_id !== p.player_id));
    } else {
      onChange([...value, p]);
    }
  }

  function selectAllShown() {
    if (filtered.length === 0) return;
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
        <button
          className="px-2 py-2 border rounded-md text-xs hover:bg-gray-50 disabled:opacity-50"
          onClick={selectAllShown}
          disabled={filtered.length === 0}
        >
          Select All
        </button>
        <button
          className="px-2 py-2 border rounded-md text-xs hover:bg-gray-50 disabled:opacity-50"
          onClick={clearAll}
          disabled={value.length === 0}
        >
          Clear
        </button>
      </div>

      {/* List */}
      <div className="max-h-[360px] overflow-auto rounded-md border">
        {filtered.length === 0 ? (
          <div className="p-3 text-sm text-gray-500">
            {games?.length ? "No players match your search." : "No games loaded."}
          </div>
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
