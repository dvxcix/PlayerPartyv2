// components/MultiGamePicker.tsx
"use client";

import Image from "next/image";

export type Game = {
  game_id: string;
  home_team_abbr: string;
  away_team_abbr: string;
  commence_time: string;
  participants?: { player_id: string; players: { full_name: string } }[];
};

type Props = {
  games: Game[];
  value: string[]; // selected game_ids
  onChange: (ids: string[]) => void;
};

export default function MultiGamePicker({ games, value, onChange }: Props) {
  const toggle = (id: string) => {
    const has = value.includes(id);
    onChange(has ? value.filter(x => x !== id) : [...value, id]);
  };

  return (
    <div className="max-h-80 overflow-auto divide-y">
      {games.map((g) => {
        const selected = value.includes(g.game_id);
        const t = new Date(g.commence_time);
        const time = t.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
        const home = g.home_team_abbr?.toLowerCase() || "";
        const away = g.away_team_abbr?.toLowerCase() || "";
        return (
          <button
            key={g.game_id}
            onClick={() => toggle(g.game_id)}
            className={`w-full text-left flex items-center gap-3 px-3 py-2 hover:bg-gray-50 ${selected ? "bg-blue-50" : ""}`}
          >
            <Image src={`/logos/${away}.png`} alt={away} width={22} height={22} />
            <span className="uppercase">{away}</span>
            <span className="text-gray-400">@</span>
            <Image src={`/logos/${home}.png`} alt={home} width={22} height={22} />
            <span className="uppercase">{home}</span>
            <span className="ml-auto text-xs text-gray-500">{time}</span>
          </button>
        );
      })}
      {!games.length && (
        <div className="p-3 text-sm text-gray-500">No games for today.</div>
      )}
    </div>
  );
}
