// components/OddsChart.tsx
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

interface OddsRow {
  captured_at: string;
  american_odds: number;
  bookmaker: string;
  player_id: string;
  game_id: string;
}

export default function OddsChart({ data }: { data: OddsRow[] }) {
  if (!data || data.length === 0) {
    return <p>No odds data yet.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={400}>
      <LineChart data={data}>
        <XAxis dataKey="captured_at" />
        <YAxis />
        <Tooltip />
        <Line type="monotone" dataKey="american_odds" stroke="#8884d8" />
      </LineChart>
    </ResponsiveContainer>
  );
}
