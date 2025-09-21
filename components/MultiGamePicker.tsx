// components/MultiGamePicker.tsx
"use client";

import type { ApiGame } from "@/lib/types";
import Image from "next/image";

export type Game = ApiGame;

type Props = {
  games: Game[];
  value: string[];
  onChange(next: string[]): void;
};

function logoSrc(abbr: string | null | undefined) {
  const up = (abbr || "").toUpperCase();
  return `/logos/${up}.png`;
}

export default function MultiGamePicker({ games, value, onChange }: Props) {
  const selected = new Set(value);

  return (
    <div className="border rounded-xl bg-white">
      <div className="sticky top-0 z-10 bg-white border-b px-3 py-2 font-semibold"> <span className="font-semibold">Games (Today Only)</span><div className="space-x-2 text-xs"><button className="underline" onClick={() => onChange(games.map(g=>g.game_id))}>All</button><button className="underline" onClick={() => onChange([])}>None</button></div></div>
      <div className="max-h-80 overflow-auto divide-y">
        {games.map((g) => {
          const isOn = selected.has(g.game_id);
          const dt = new Date(g.commence_time);
          const timeLabel = dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
          return (
            <button
              key={g.game_id}
              className={`w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-2 ${
                isOn ? "bg-blue-50" : ""
              }`}
              onClick={() => {
                const copy = new Set(selected);
                if (copy.has(g.game_id)) copy.delete(g.game_id);
                else copy.add(g.game_id);
                onChange(Array.from(copy));
              }}
            >
              <Image
                src={logoSrc(g.away_team)}
                alt={g.away_team ?? ""}
                width={20}
                height={20}
                className="rounded-full border"
              />
              <span className="uppercase text-sm">{g.away_team ?? "??"}</span>
              <span className="text-xs text-gray-400">@</span>
              <Image
                src={logoSrc(g.home_team)}
                alt={g.home_team ?? ""}
                width={20}
                height={20}
                className="rounded-full border"
              />
              <span className="uppercase text-sm">{g.home_team ?? "??"}</span>
              <span className="ml-auto text-xs text-gray-500">{timeLabel}</span>
            </button>
          );
        })}
        {!games.length && (
          <div className="px-3 py-4 text-sm text-gray-500">No games found for today.</div>
        )}
      </div>
    </div>
  );
}
