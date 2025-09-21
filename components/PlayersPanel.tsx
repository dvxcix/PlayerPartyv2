// components/PlayersPanel.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import HeadshotImg from "@/components/HeadshotImg";

export type PlayerPick = {
  player_id: string;
  full_name: string;
  game_id: string;     // tie selection to a specific game
  team_abbr?: string | null;
};

type Props = {
  selectedGameIds: string[];
  value: PlayerPick[];
  onChange: (picks: PlayerPick[]) => void;
};

type ApiPlayer = {
  player_id: string;
  full_name: string;
  team_abbr?: string | null;
  game_id: string;
};

export default function PlayersPanel({ selectedGameIds, value, onChange }: Props) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [rows, setRows] = useState<ApiPlayer[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErr(null);
        const params = new URLSearchParams();
        if (selectedGameIds.length) params.set("game_ids", selectedGameIds.join(","));
        const res = await fetch(`/api/players?${params.toString()}`, { cache: "no-store" });
        const json = await res.json();
        if (!json?.ok) throw new Error(json?.error || "Players fetch failed");
        setRows(json.players ?? []);
      } catch (e: any) {
        setErr(e?.message ?? String(e));
        setRows([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [selectedGameIds.join(",")]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) => r.full_name.toLowerCase().includes(s));
  }, [rows, q]);

  function toggle(p: ApiPlayer) {
    const exists = value.find((v) => v.player_id === p.player_id && v.game_id === p.game_id);
    if (exists) {
      onChange(value.filter((v) => !(v.player_id === p.player_id && v.game_id === p.game_id)));
    } else {
      onChange([...value, { player_id: p.player_id, full_name: p.full_name, game_id: p.game_id, team_abbr: p.team_abbr }]);
    }
  }

  return (
    <div className="space-y-2">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search players…"
        className="w-full border rounded-md px-3 py-2 text-sm"
      />

      {loading ? (
        <div className="text-xs text-gray-500">Loading players…</div>
      ) : err ? (
        <div className="text-xs text-red-600">Failed to load players: {err}</div>
      ) : filtered.length === 0 ? (
        <div className="text-xs text-gray-500">No players match.</div>
      ) : (
        <div className="max-h-80 overflow-auto divide-y">
          {filtered.map((p) => {
            const active = !!value.find((v) => v.player_id === p.player_id && v.game_id === p.game_id);
            return (
              <button
                key={`${p.player_id}|${p.game_id}`}
                onClick={() => toggle(p)}
                className={`w-full flex items-center gap-3 px-2 py-2 text-left hover:bg-gray-50 ${
                  active ? "bg-blue-50" : ""
                }`}
              >
                <HeadshotImg fullName={p.full_name} className="w-8 h-8 rounded-full object-cover" />
                <div className="flex-1">
                  <div className="text-sm">{p.full_name}</div>
                  <div className="text-[11px] text-gray-500">Game: {p.game_id}</div>
                </div>
                <div className="text-[11px] uppercase text-gray-400">{p.team_abbr ?? ""}</div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
