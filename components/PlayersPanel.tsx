// components/PlayersPanel.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import HeadshotImg from "@/components/HeadshotImg";

export type PlayerItem = {
  player_id: string;
  full_name: string;
  team_abbr: string | null;
  game_id: string;
};

// Must match your page's PlayerPick shape
export type PlayerPick = {
  player_id: string;
  full_name: string;
  game_id: string;
};

type Props = {
  selectedGameIds: string[];
  value: PlayerPick[];
  onChange: (next: PlayerPick[]) => void;
};

export default function PlayersPanel({ selectedGameIds, value, onChange }: Props) {
  const [players, setPlayers] = useState<PlayerItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  // Fetch players for current selected games
  useEffect(() => {
    let stop = false;
    async function run() {
      setLoading(true);
      setErr(null);
      try {
        if (!selectedGameIds.length) {
          setPlayers([]);
          return;
        }
        const qs = new URLSearchParams({ game_ids: selectedGameIds.join(",") }).toString();
        const res = await fetch(`/api/players?${qs}`, { cache: "no-store" });
        const text = await res.text();
        let json: any;
        try {
          json = JSON.parse(text);
        } catch {
          throw new Error(`Non-JSON from /api/players: ${text.slice(0, 80)}…`);
        }
        if (!json?.ok) throw new Error(json?.error || "Unknown players error");
        if (!Array.isArray(json.data)) throw new Error("No players array in response");
        if (!stop) setPlayers(json.data as PlayerItem[]);
      } catch (e: any) {
        if (!stop) {
          setErr(e?.message ?? String(e));
          setPlayers([]);
        }
      } finally {
        if (!stop) setLoading(false);
      }
    }
    run();
    return () => {
      stop = true;
    };
  }, [selectedGameIds]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return players;
    return players.filter((p) => p.full_name.toLowerCase().includes(q));
  }, [players, query]);

  function isSelected(p: PlayerItem) {
    return value.some((v) => v.player_id === p.player_id && v.game_id === p.game_id);
  }

  function toggle(p: PlayerItem) {
    const exists = isSelected(p);
    if (exists) {
      onChange(value.filter((v) => !(v.player_id === p.player_id && v.game_id === p.game_id)));
    } else {
      onChange([...value, { player_id: p.player_id, full_name: p.full_name, game_id: p.game_id }]);
    }
  }

  function selectAllVisible() {
    // Merge without duplicating (keyed by player_id+game_id)
    const merged = [...value];
    for (const p of filtered) {
      const exists = merged.some((v) => v.player_id === p.player_id && v.game_id === p.game_id);
      if (!exists) merged.push({ player_id: p.player_id, full_name: p.full_name, game_id: p.game_id });
    }
    onChange(merged);
  }

  function clearAll() {
    onChange([]);
  }

  return (
    <div className="space-y-3">
      {/* Controls */}
      <div className="flex items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search players…"
          className="w-full px-3 py-1.5 border rounded-md text-sm"
        />
        <button
          onClick={selectAllVisible}
          disabled={!filtered.length}
          className="px-2 py-1 border rounded-md text-xs bg-white hover:bg-gray-50 disabled:opacity-50"
          title="Select all visible"
        >
          Select all
        </button>
        <button
          onClick={clearAll}
          disabled={!value.length}
          className="px-2 py-1 border rounded-md text-xs bg-white hover:bg-gray-50 disabled:opacity-50"
        >
          Clear
        </button>
      </div>

      {/* Status */}
      {loading && <div className="text-xs text-gray-500">Loading players…</div>}
      {err && <div className="text-xs text-red-600">Failed to load players: {err}</div>}

      {/* List */}
      {!loading && !err && (
        <>
          {!filtered.length ? (
            <div className="text-sm text-gray-500">No players match.</div>
          ) : (
            <ul className="divide-y">
              {filtered.map((p) => {
                const sel = isSelected(p);
                return (
                  <li key={`${p.game_id}|${p.player_id}`}>
                    <button
                      onClick={() => toggle(p)}
                      className={`w-full flex items-center gap-3 px-2 py-2 text-left ${
                        sel ? "bg-blue-50" : "hover:bg-gray-50"
                      }`}
                    >
                      <HeadshotImg
                        name={p.full_name}
                        className="h-6 w-6 rounded-full border"
                        width={24}
                        height={24}
                      />
                      <div className="flex-1">
                        <div className="text-sm">{p.full_name}</div>
                        <div className="text-[11px] text-gray-500">
                          {(p.team_abbr ?? "").toUpperCase()} • {p.game_id}
                        </div>
                      </div>
                      <div
                        className={`ml-3 h-5 w-5 shrink-0 rounded border ${
                          sel ? "bg-blue-500 border-blue-500" : "bg-white border-gray-300"
                        }`}
                        aria-hidden
                      />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
