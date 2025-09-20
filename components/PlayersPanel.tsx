// components/PlayersPanel.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import HeadshotImg from "@/components/HeadshotImg";

export type PlayerMin = { player_id: string; full_name: string };

export default function PlayersPanel({
  selectedGameIds,
  value,
  onChange,
}: {
  selectedGameIds: string[];
  value: PlayerMin[];
  onChange: (players: PlayerMin[]) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [players, setPlayers] = useState<PlayerMin[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    let stop = false;
    (async () => {
      try {
        setLoading(true);
        const qs =
          selectedGameIds.length > 0
            ? `?game_ids=${encodeURIComponent(selectedGameIds.join(","))}`
            : "";
        const res = await fetch(`/api/players${qs}`, { cache: "no-store" });
        const json = await res.json();
        if (!stop) {
          if (json?.ok && Array.isArray(json.data)) setPlayers(json.data);
          else setPlayers([]);
        }
      } finally {
        if (!stop) setLoading(false);
      }
    })();
    return () => {
      stop = true;
    };
  }, [selectedGameIds]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return players;
    return players.filter((p) => p.full_name.toLowerCase().includes(s));
  }, [players, q]);

  function toggle(p: PlayerMin) {
    const exists = value.some((x) => x.player_id === p.player_id);
    if (exists) onChange(value.filter((x) => x.player_id !== p.player_id));
    else onChange([...value, p]);
  }

  function selectAll() {
    const ids = new Set(value.map((v) => v.player_id));
    const merged = [...value, ...filtered.filter((p) => !ids.has(p.player_id))];
    onChange(merged);
  }

  function clearAll() {
    onChange(value.filter((v) => !filtered.some((p) => p.player_id === v.player_id)));
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <input
          className="w-full border rounded-md px-2 py-1 text-sm"
          placeholder="Search players…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button onClick={selectAll} className="text-xs border rounded-md px-2 py-1 bg-white hover:bg-gray-50">
          Select all
        </button>
        <button onClick={clearAll} className="text-xs border rounded-md px-2 py-1 bg-white hover:bg-gray-50">
          Clear
        </button>
      </div>

      <div className="max-h-80 overflow-auto pr-1">
        <ul className="space-y-1">
          {loading && <li className="text-sm text-gray-500">Loading…</li>}
          {!loading && filtered.length === 0 && (
            <li className="text-sm text-gray-500">No players match.</li>
          )}
          {!loading &&
            filtered.map((p) => {
              const selected = value.some((v) => v.player_id === p.player_id);
              return (
                <li key={p.player_id}>
                  <button
                    onClick={() => toggle(p)}
                    className={`w-full flex items-center gap-2 border rounded-lg px-2 py-1.5 hover:bg-gray-50 ${
                      selected ? "ring-2 ring-blue-300 bg-blue-50/40" : ""
                    }`}
                  >
                    <HeadshotImg name={p.full_name} className="w-6 h-6 rounded-full" />
                    <span className="text-sm">{p.full_name}</span>
                  </button>
                </li>
              );
            })}
        </ul>
      </div>
    </div>
  );
}
