// components/PlayersPanel.tsx
"use client";

import { useMemo, useState } from "react";
import HeadshotImg from "@/components/HeadshotImg";

type Game = {
  id?: string;
  game_id?: string;
  home_team_abbr?: string;
  away_team_abbr?: string;
  commence_time?: string;
  participants?: Array<{
    player_id: string; // your API uses player name as id in participants
    team_abbr?: string;
    players?: { full_name?: string };
  }>;
};

type PlayerLike = { player_id: string; full_name: string };

type Props = {
  games: Game[];
  selectedGameIds: string[];
  value: PlayerLike[];
  onChange: (players: PlayerLike[]) => void;
};

function uniqBy<T, K extends string>(arr: T[], key: (t: T) => K): T[] {
  const seen = new Set<K>();
  const out: T[] = [];
  for (const x of arr) {
    const k = key(x);
    if (!seen.has(k)) {
      seen.add(k);
      out.push(x);
    }
  }
  return out;
}

export function PlayersPanel({ games, selectedGameIds, value, onChange }: Props) {
  const [q, setQ] = useState("");

  const visiblePlayers: PlayerLike[] = useMemo(() => {
    // Build a list of players from selected games; if none selected, use ALL games
    const chosen = (selectedGameIds?.length
      ? games.filter((g) => selectedGameIds.includes(String(g.id ?? g.game_id)))
      : games) as Game[];

    const all: PlayerLike[] = [];
    for (const g of chosen) {
      for (const p of g.participants ?? []) {
        const full = p.players?.full_name || p.player_id || "";
        if (!full) continue;
        all.push({ player_id: p.player_id, full_name: full });
      }
    }
    // Deduplicate by player_id (which in your data equals the name)
    const deduped = uniqBy(all, (x) => x.player_id);
    if (!q.trim()) return deduped;
    const needle = q.toLowerCase();
    return deduped.filter((p) => p.full_name.toLowerCase().includes(needle));
  }, [games, selectedGameIds, q]);

  const selectedMap = useMemo(() => {
    const m = new Map<string, boolean>();
    value.forEach((p) => m.set(p.player_id, true));
    return m;
  }, [value]);

  function toggle(p: PlayerLike) {
    const exists = selectedMap.get(p.player_id);
    if (exists) {
      onChange(value.filter((v) => v.player_id !== p.player_id));
    } else {
      onChange([...value, p]);
    }
  }

  function selectAllVisible() {
    const map = new Map(value.map((v) => [v.player_id, true]));
    const merged = [...value];
    for (const p of visiblePlayers) {
      if (!map.has(p.player_id)) merged.push(p);
    }
    onChange(merged);
  }

  function clearAll() {
    onChange([]);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <input
          className="w-full border rounded-md px-3 py-2 text-sm"
          placeholder="Search players…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button
          className="text-xs px-2 py-1 border rounded-md bg-white hover:bg-gray-50"
          onClick={selectAllVisible}
        >
          Select all
        </button>
        <button
          className="text-xs px-2 py-1 border rounded-md bg-white hover:bg-gray-50"
          onClick={clearAll}
        >
          Clear
        </button>
      </div>

      <div className="max-h-80 overflow-auto border rounded-md">
        {visiblePlayers.length === 0 ? (
          <div className="p-3 text-sm text-gray-500">No players match your search.</div>
        ) : (
          <ul className="divide-y">
            {visiblePlayers.map((p) => {
              const active = !!selectedMap.get(p.player_id);
              return (
                <li
                  key={p.player_id}
                  className={`flex items-center gap-2 px-3 py-2 cursor-pointer ${
                    active ? "bg-blue-50" : "hover:bg-gray-50"
                  }`}
                  onClick={() => toggle(p)}
                >
                  <HeadshotImg
                    name={p.full_name}
                    size={20}
                    className="rounded-full object-cover"
                  />
                  <span className="text-sm">{p.full_name}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

// Also default-export so either style works in your page.
export default PlayersPanel;
