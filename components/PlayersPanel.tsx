// components/PlayersPanel.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import type { PlayerListItem, PlayerPick } from "@/lib/types";
import HeadshotImg from "./HeadshotImg";

type Props = {
  selectedGameIds: string[];
  value: PlayerPick[];
  onChange(next: PlayerPick[]): void;
};

type ApiResp = { ok: boolean; data?: PlayerListItem[]; error?: string };

export default function PlayersPanel({ selectedGameIds, value, onChange }: Props) {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<PlayerListItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const selected = useMemo(() => new Map(value.map((p) => [`${p.game_id}|${p.player_id}`, p])), [value]);

  useEffect(() => {
    let isCancelled = false;

    async function run() {
      setLoading(true);
      setError(null);
      setRows([]);

      try {
        const params = new URLSearchParams();
        if (selectedGameIds.length) params.set("game_ids", selectedGameIds.join(","));
        const res = await fetch(`/api/players?${params.toString()}`, { cache: "no-store" });

        if (!res.ok) {
          const text = await res.text();
          throw new Error(`Non-JSON from /api/players: ${text.slice(0, 120)}`);
        }
        const json: ApiResp = await res.json();
        if (!json.ok) throw new Error(json.error || "Unknown error");
        if (!Array.isArray(json.data)) throw new Error("No players array in response");

        if (!isCancelled) setRows(json.data);
      } catch (e: any) {
        if (!isCancelled) setError(String(e?.message ?? e));
      } finally {
        if (!isCancelled) setLoading(false);
      }
    }

    run();
    return () => {
      isCancelled = true;
    };
  }, [selectedGameIds.join(",")]);

  const toggle = (row: PlayerListItem) => {
    const key = `${row.game_id}|${row.player_id}`;
    const copy = new Map(selected);
    if (copy.has(key)) copy.delete(key);
    else copy.set(key, { player_id: row.player_id, full_name: row.full_name, game_id: row.game_id });
    onChange(Array.from(copy.values()));
  };

  return (
    <div className="border rounded-xl bg-white">
      <div className="sticky top-0 z-10 bg-white border-b px-3 py-2 font-semibold">Players</div>
      <div className="max-h-80 overflow-auto divide-y">
        {error && (
          <div className="px-3 py-3 text-sm text-red-600">Failed to load players: {error}</div>
        )}
        {!error && loading && (
          <div className="px-3 py-3 text-sm text-gray-500">Loading…</div>
        )}
        {!error && !loading && !rows.length && (
          <div className="px-3 py-3 text-sm text-gray-500">No Players Match</div>
        )}

        {rows.map((p) => {
          const key = `${p.game_id}|${p.player_id}`;
          const on = selected.has(key);
          return (
            <button
              key={key}
              className={`w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-2 ${
                on ? "bg-blue-50" : ""
              }`}
              onClick={() => toggle(p)}
              title={`${p.full_name} (${p.team_abbr ?? ""})`}
            >
              <HeadshotImg fullName={p.full_name} className="h-6 w-6 rounded-full border" width={24} height={24} />
              <span className="text-sm">{p.full_name}</span>
              {p.team_abbr && <span className="uppercase text-[11px] ml-2 text-gray-500">{p.team_abbr}</span>}
              <span className="ml-auto text-[11px] text-gray-400">{p.game_id.slice(0, 6)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
