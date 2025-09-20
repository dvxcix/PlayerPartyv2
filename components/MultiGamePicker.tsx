// components/MultiGamePicker.tsx
"use client";

import Image from "next/image";

type Game = {
  game_id: string;
  home_team_abbr: string; // lowercased by API
  away_team_abbr: string; // lowercased by API
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
  function toggle(id: string) {
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  }

  const fmtTime = (iso?: string | null) => {
    if (!iso) return "";
    try {
      const d = new Date(iso);
      // local short time
      return d.toLocaleString(undefined, {
        month: "numeric",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  };

  const logo = (abbr: string) => {
    const a = (abbr || "").toLowerCase().trim();
    // All your logos live in /public/logos/{abbr}.png
    return `/logos/${a}.png`;
  };

  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
      {games.map((g) => {
        const id = g.game_id;
        const selected = value.includes(id);
        const home = (g.home_team_abbr || "").toLowerCase();
        const away = (g.away_team_abbr || "").toLowerCase();

        return (
          <button
            key={id}
            className={`w-full text-left border rounded-xl px-3 py-2 flex items-center justify-between transition ${
              selected ? "border-blue-400 bg-blue-50/50" : "border-gray-200 hover:bg-gray-50"
            }`}
            onClick={() => toggle(id)}
          >
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <Image
                  src={logo(home)}
                  alt={home.toUpperCase()}
                  width={20}
                  height={20}
                  onError={(e) => {
                    // fallback to a blank PNG if a team asset is missing
                    (e.target as HTMLImageElement).src = "/logos/_blank.png";
                  }}
                />
                <span className="font-medium uppercase">{home}</span>
              </div>
              <span className="text-gray-400">@</span>
              <div className="flex items-center gap-1">
                <Image
                  src={logo(away)}
                  alt={away.toUpperCase()}
                  width={20}
                  height={20}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "/logos/_blank.png";
                  }}
                />
                <span className="font-medium uppercase">{away}</span>
              </div>
            </div>

            <div className="text-xs text-gray-500">{fmtTime(g.commence_time)}</div>
          </button>
        );
      })}

      {games.length === 0 && (
        <div className="text-xs text-gray-500 px-1 py-2">No games in window. Try Refresh above.</div>
      )}
    </div>
  );
}
