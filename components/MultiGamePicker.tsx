// components/MultiGamePicker.tsx
"use client";

import Image from "next/image";

type Game = {
  game_id: string;
  home_team_abbr: string;
  away_team_abbr: string;
  commence_time?: string | null;
};

export function MultiGamePicker({
  games,
  value,
  onChange,
}: {
  games: Game[];
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const toggle = (id: string) => {
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  };

  const fmt = (iso?: string | null) => {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleString(undefined, { month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit" });
  };

  const logoSrc = (abbr: string) => `/logos/${(abbr || "").toLowerCase().trim()}.png`;

  return (
    <div className="space-y-2">
      {games.map((g) => {
        const id = g.game_id;
        const selected = value.includes(id);
        const home = (g.home_team_abbr || "").toLowerCase();
        const away = (g.away_team_abbr || "").toLowerCase();

        return (
          <label
            key={id}
            className={`flex items-center justify-between w-full border rounded-xl px-3 py-2 cursor-pointer transition ${
              selected ? "border-blue-400 bg-blue-50/50" : "border-gray-200 hover:bg-gray-50"
            }`}
          >
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={selected}
                onChange={() => toggle(id)}
                className="h-4 w-4 accent-blue-600 cursor-pointer"
              />
              <div className="flex items-center gap-1">
                <Image
                  src={logoSrc(home)}
                  alt={home.toUpperCase()}
                  width={20}
                  height={20}
                  onError={(e) => ((e.target as HTMLImageElement).src = "/logos/_blank.png")}
                />
                <span className="font-medium uppercase">{home}</span>
              </div>
              <span className="text-gray-400">@</span>
              <div className="flex items-center gap-1">
                <Image
                  src={logoSrc(away)}
                  alt={away.toUpperCase()}
                  width={20}
                  height={20}
                  onError={(e) => ((e.target as HTMLImageElement).src = "/logos/_blank.png")}
                />
                <span className="font-medium uppercase">{away}</span>
              </div>
            </div>
            <div className="text-xs text-gray-500">{fmt(g.commence_time)}</div>
          </label>
        );
      })}
      {games.length === 0 && <div className="text-xs text-gray-500 px-1 py-2">No games for today.</div>}
    </div>
  );
}
