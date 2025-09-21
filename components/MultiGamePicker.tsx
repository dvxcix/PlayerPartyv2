// components/MultiGamePicker.tsx
"use client";

import Image from "next/image";
import { useMemo } from "react";

export type Game = {
  // Your API returns game_id; some older code referenced id.
  id?: string;
  game_id: string;
  commence_time: string; // ISO
  home_team_abbr: string; // e.g. "det" | "DET"
  away_team_abbr: string; // e.g. "atl" | "ATL"
  status?: string | null;
};

type Props = {
  games: Game[];
  value: string[]; // array of selected game_ids
  onChange: (next: string[]) => void;
};

function teamLogoSrc(abbr: string) {
  // logos live in /public/logos and are lowercase in your repo
  const a = (abbr || "").toLowerCase();
  return `/logos/${a}.png`;
}

export default function MultiGamePicker({ games, value, onChange }: Props) {
  const sorted = useMemo(() => {
    // Defensive: filter out anything missing essential fields
    const safe = (games ?? []).filter(
      (g) => (g.id || g.game_id) && g.commence_time && g.home_team_abbr && g.away_team_abbr
    );
    // sort by commence_time asc, then by game_id for stability
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

        const homeAbbr = (g.home_team_abbr || "").toUpperCase();
        const awayAbbr = (g.away_team_abbr || "").toUpperCase();

        const start = new Date(g.commence_time);
        const timeStr = start.toLocaleTimeString(undefined, {
          hour: "numeric",
          minute: "2-digit",
        });

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
                  alt={homeAbbr}
                  width={24}
                  height={24}
                  className="rounded-full border"
                />
                <Image
                  src={teamLogoSrc(awayAbbr)}
                  alt={awayAbbr}
                  width={24}
                  height={24}
                  className="rounded-full border"
                />
              </div>
              <div>
                <div className="text-sm font-medium">
                  {awayAbbr} @ {homeAbbr}
                </div>
                <div className="text-xs text-gray-500">
                  {timeStr} • {start.toLocaleDateString()}
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
