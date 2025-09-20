// components/MultiGamePicker.tsx
interface Game {
  game_id: string;
  home_team_abbr: string;
  away_team_abbr: string;
  commence_time: string;
}

interface Props {
  games: Game[];
  value: string[];
  onChange: (ids: string[]) => void;
}

export default function MultiGamePicker({ games, value, onChange }: Props) {
  function toggle(id: string) {
    if (value.includes(id)) {
      onChange(value.filter((g) => g !== id));
    } else {
      onChange([...value, id]);
    }
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
      {games.map((g) => (
        <button
          key={g.game_id}
          onClick={() => toggle(g.game_id)}
          className={`p-2 rounded border ${
            value.includes(g.game_id)
              ? "bg-blue-500 text-white"
              : "bg-white hover:bg-gray-100"
          }`}
        >
          {g.away_team_abbr} @ {g.home_team_abbr} <br />
          <span className="text-xs">{new Date(g.commence_time).toLocaleTimeString()}</span>
        </button>
      ))}
    </div>
  );
}
