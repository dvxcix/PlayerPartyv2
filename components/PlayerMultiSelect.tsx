"use client";
import { useMemo } from "react";

export function PlayerMultiSelect({ participants, value, onChange, disabled }: { participants: any[]; value: any[]; onChange: (v: any[]) => void; disabled?: boolean }) {
  const sorted = useMemo(() => (participants ?? []).slice().sort((a: any, b: any) => a.full_name.localeCompare(b.full_name)), [participants]);

  function toggle(p: any) {
    const exists = value.find((x: any) => x.player_id === p.player_id);
    if (exists) onChange(value.filter((x: any) => x.player_id !== p.player_id));
    else onChange([...value, { player_id: p.player_id, full_name: p.full_name }]);
  }

  return (
    <fieldset className={`border rounded-2xl p-3 bg-white ${disabled ? "opacity-50" : ""}`} disabled={disabled}>
      <legend className="px-1 text-sm font-medium">Players</legend>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-72 overflow-auto">
        {sorted.map((p: any) => (
          <label key={p.player_id} className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4" checked={!!value.find((v) => v.player_id === p.player_id)} onChange={() => toggle(p)} />
            <span>{p.full_name}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
