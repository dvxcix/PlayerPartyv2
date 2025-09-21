// components/MultiGamePicker.tsx
"use client";

import Image from "next/image";
import { useMemo } from "react";

export type Game = {
  // Sometimes you only have game_id; keep id optional so either works.
  id?: string;
  game_id: string;
  commence_time: string; // ISO
  // These can be missing/nullable from your API; make them optional.
  home_team_abbr?: string;
  away_team_abbr?: string;
  status?: string | null;
};

type Props = {
  games: Game[];
  value: string[]; // selected game_ids
  onChange: (next: string[]) => void;
};

function teamLogoSrc(abbr?: string) {
  // fallback: blank/placeholder if missing
  const a = (abbr ?? "").toLowerCase();
  return a ? `/logos/${a}.png` : "/logos/_blank.png";
}

function safeAbbr(s?: string) {
  return (s ?? "").toUpperCase();
}

export default function MultiGamePicker({ games, value, onChange }: Props) {
  const sorted = useMemo(() => {
    const safe = (games ?? []).filter((g) => (g.id || g.game_id) && g.commence_time);
    return safe.slice().sort((a, b) => {
      const ta = Date.parse(a.commence_time);
      const tb = Date.parse(b.commence_time);
      if (ta !== tb) return ta - tb;
      const ga = String(a.id ?? a.game_id);
      const gb = String(b.id ?? b.game_id);
      return ga.localeCompare(gb);
    });
  }, [games]);

  function toggle(gid: string) {
    const has = value.includes(gid);
    if (has) onChange(value.filter((v) => v !== gid));
    else onChange([...value, gid]);
  }

  if (!sorted.length) {
    return <div className="text-sm text-gray-500">No games found.</div>;
    }

  return (
    <div className="grid gap-2">
      {sorted.map((g) => {
        const gid = String(g.id ?? g.game_id);
        const sel = value.includes(gid);

        const homeAbbr = safeAbbr(g.home_team_abbr);
        const awayAbbr = safeAbbr(g.away_team_abbr);

        const start = new Date(g.commence_time);
        const timeStr = isNaN(start.getTime())
          ? ""
          : start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
        const dateStr = isNaN(start.getTime()) ? "" : start.toLocaleDateString();

        return (
          <button
            key={gid}
            onClick={() => toggle(gid)}
            className={`w-full flex items-center justify-between rounded-lg border px-3 py-2 text-left transition-colors ${
              sel ? "border-blue-400 bg-blue-50" : "border-gray-200 hover:bg-gray-50"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="flex -space-x-1">
                <Image
                  src={teamLogoSrc(homeAbbr)}
                  alt={homeAbbr || "HOME"}
                  width={24}
                  height={24}
                  className="rounded-full border"
                />
                <Image
                  src={teamLogoSrc(awayAbbr)}
                  alt={awayAbbr || "AWAY"}
                  width={24}
                  height={24}
                  className="rounded-full border"
                />
              </div>
              <div>
                <div className="text-sm font-medium">
                  {(awayAbbr || "AWAY")} @ {(homeAbbr || "HOME")}
                </div>
                <div className="text-xs text-gray-500">
                  {timeStr && dateStr ? `${timeStr} • ${dateStr}` : ""}
                </div>
              </div>
            </div>

            <div
              className={`ml-3 h-5 w-5 shrink-0 rounded border ${
                sel ? "bg-blue-500 border-blue-500" : "bg-white border-gray-300"
              }`}
              aria-hidden
            />
          </button>
        );
      })}
    </div>
  );
}
