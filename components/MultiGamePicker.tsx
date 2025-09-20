// components/MultiGamePicker.tsx
"use client";

import Image from "next/image";
import { useMemo } from "react";

export type GameInput = {
  id?: string;
  game_id?: string;
  home_team_abbr?: string;
  away_team_abbr?: string;
  commence_time?: string;
};

type Props = {
  games: GameInput[];
  value: string[];
  onChange: (ids: string[]) => void;
};

function normId(g: GameInput): string {
  return String(g.id ?? g.game_id ?? "");
}

function teamLogoPath(abbr?: string) {
  const a = (abbr || "").toUpperCase();
  return a ? `/logos/${a}.svg` : "/logos/placeholder.svg";
}

export default function MultiGamePicker({ games, value, onChange }: Props) {
  const rows = useMemo(() => {
    return (games || []).map((g) => {
      const id = normId(g);
      const ct = g.commence_time ? new Date(g.commence_time) : null;
      return {
        id,
        home_abbr: (g.home_team_abbr || "").toUpperCase(),
        away_abbr: (g.away_team_abbr || "").toUpperCase(),
        commence_iso: g.commence_time || "",
        commence_label: ct
          ? ct.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
          : "",
      };
    });
  }, [games]);

  function toggle(id: string) {
    const set = new Set(value);
    if (set.has(id)) {
      set.delete(id);
    } else {
      set.add(id);
    }
    onChange(Array.from(set));
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="max-h-80 overflow-auto border rounded-md">
        {rows.length === 0 ? (
          <div className="p-3 text-sm text-gray-500">No games available.</div>
        ) : (
          <ul className="divide-y">
            {rows.map((r) => {
              const active = value.includes(r.id);
              return (
                <li
                  key={r.id}
                  className={`flex items-center justify-between gap-3 px-3 py-2 cursor-pointer ${
                    active ? "bg-blue-50" : "hover:bg-gray-50"
                  }`}
                  onClick={() => toggle(r.id)}
                >
                  <div className="flex items-center gap-3">
                    <Image
                      src={teamLogoPath(r.away_abbr)}
                      alt={r.away_abbr || "Away"}
                      width={20}
                      height={20}
                    />
                    <span className="text-sm font-medium">{r.away_abbr || "??"}</span>
                    <span className="text-xs text-gray-400">@</span>
                    <Image
                      src={teamLogoPath(r.home_abbr)}
                      alt={r.home_abbr || "Home"}
                      width={20}
                      height={20}
                    />
                    <span className="text-sm font-medium">{r.home_abbr || "??"}</span>
                  </div>
                  <div className="text-xs text-gray-500">{r.commence_label}</div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {value.length > 0 && (
        <div className="text-xs text-gray-600">
          Selected: {value.length} game{value.length === 1 ? "" : "s"}
        </div>
      )}
    </div>
  );
}
