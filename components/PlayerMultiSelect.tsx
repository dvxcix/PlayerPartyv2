// components/PlayerMultiSelect.tsx
interface Player {
  player_id: string;
  full_name: string;
  game_id: string;
}

interface Props {
  players: Player[];
  selectedPlayers: string[];
  onChange: (ids: string[]) => void;
}

export default function PlayerMultiSelect({ players, selectedPlayers, onChange }: Props) {
  function toggle(id: string) {
    if (selectedPlayers.includes(id)) {
      onChange(selectedPlayers.filter((p) => p !== id));
    } else {
      onChange([...selectedPlayers, id]);
    }
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
      {players.map((p) => (
        <button
          key={p.player_id}
          onClick={() => toggle(p.player_id)}
          className={`p-2 rounded border ${
            selectedPlayers.includes(p.player_id)
              ? "bg-green-500 text-white"
              : "bg-white hover:bg-gray-100"
          }`}
        >
          {p.full_name}
        </button>
      ))}
    </div>
  );
}
