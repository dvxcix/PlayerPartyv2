// components/MultiGamePicker.tsx
"use client";

import Image from "next/image";

type Game = {
  game_id: string;
  commence_time: string; // ISO
  home_team?: string;
  away_team?: string;
  home_team_abbr?: string;
  away_team_abbr?: string;
  home_abbr?: string;
  away_abbr?: string;
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
  const selected = new Set(value);

  const toggle = (id: string) => {
    const next = new Set(value);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(Array.from(next));
  };

  // Fixed height with internal scroll; compact items; logos when abbr is available
  return (
    <div className="max-h-80 overflow-y-auto pr-1 border rounded-md">
      {(!games || games.length === 0) ? (
        <div className="text-xs text-gray-500 p-3">No games found.</div>
      ) : (
        <ul className="divide-y">
          {games.map((g) => {
            const id = g.game_id;
            const isChecked = selected.has(id);

            const homeAbbr =
              (g.home_team_abbr || g.home_abbr || "").toLowerCase();
            const awayAbbr =
              (g.away_team_abbr || g.away_abbr || "").toLowerCase();

            const homeLogo = homeAbbr ? `/logos/${homeAbbr}.png` : null;
            const awayLogo = awayAbbr ? `/logos/${awayAbbr}.png` : null;

            const t = new Date(g.commence_time);
            const timeLabel = t.toLocaleString(undefined, {
              month: "numeric",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            });

            return (
              <li key={id}>
                <label
                  className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-gray-50"
                  onClick={() => toggle(id)}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-blue-600"
                      checked={isChecked}
                      onChange={() => toggle(id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div className="flex items-center gap-2">
                      {homeLogo ? (
                        <Image
                          src={homeLogo}
                          alt={homeAbbr || "home"}
                          width={20}
                          height={20}
                          className="rounded"
                        />
                      ) : (
                        <div className="w-5 h-5 rounded bg-gray-200" />
                      )}
                      <span className="text-sm">
                        {(g.home_team ?? homeAbbr?.toUpperCase() ?? "HOME")} @{" "}
                        {(g.away_team ?? awayAbbr?.toUpperCase() ?? "AWAY")}
                      </span>
                      {awayLogo ? (
                        <Image
                          src={awayLogo}
                          alt={awayAbbr || "away"}
                          width={20}
                          height={20}
                          className="rounded"
                        />
                      ) : (
                        <div className="w-5 h-5 rounded bg-gray-200" />
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">{timeLabel}</div>
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
