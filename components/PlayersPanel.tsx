// components/PlayersPanel.tsx
"use client";

import HeadshotImg from "@/components/HeadshotImg";
import type { Game } from "./MultiGamePicker";

type Player = { player_id: string; full_name: string };

type Props = {
  games: Game[];
  selectedGameIds: string[];
  value: Player[]; // selected players
  onChange: (players: Player[]) => void;
};

export function PlayersPanel({ games, selectedGameIds, value, onChange }: Props) {
  // Build list: if games selected → players from selected games; else all unique players
  const set = new Map<string, string>(); // player_id -> full_name
  if (selectedGameIds.length) {
    for (const g of games) {
      if (!selectedGameIds.includes(g.game_id)) continue;
      for (const p of g.participants ?? []) {
        set.set(p.player_id, p.players?.full_name ?? p.player_id);
      }
    }
  } else {
    for (const g of games) {
      for (const p of g.participants ?? []) {
        set.set(p.player_id, p.players?.full_name ?? p.player_id);
      }
    }
  }
  const list: Player[] = Array.from(set.entries())
    .map(([player_id, full_name]) => ({ player_id, full_name }))
    .sort((a, b) => a.full_name.localeCompare(b.full_name));

  const toggle = (p: Player) => {
    const has = value.some(v => v.player_id === p.player_id);
    onChange(has ? value.filter(v => v.player_id !== p.player_id) : [...value, p]);
  };

  return (
    <div className="max-h-80 overflow-auto divide-y">
      {list.map((p) => {
        const selected = value.some(v => v.player_id === p.player_id);
        return (
          <button
            key={p.player_id}
            onClick={() => toggle(p)}
            className={`w-full px-3 py-2 flex items-center gap-3 hover:bg-gray-50 ${selected ? "bg-blue-50" : ""}`}
          >
            <HeadshotImg name={p.full_name} className="w-6 h-6 rounded-full shrink-0" />
            <span className="truncate">{p.full_name}</span>
          </button>
        );
      })}
      {!list.length && (
        <div className="p-3 text-sm text-gray-500">No players match your selection.</div>
      )}
    </div>
  );
}

export type { Player };
