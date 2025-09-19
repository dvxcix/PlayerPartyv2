import Link from "next/link";

export default function Home() {
  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold mb-3">MLB Odds Dashboard</h1>
      <p className="mb-4">Go to the dashboard to compare FanDuel & BetMGM odds.</p>
      <Link className="underline text-blue-600" href="/dashboard">Open Dashboard →</Link>
    </main>
  );
}
