// app/dashboard/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { GamePicker } from "@/components/GamePicker";
import { PlayerMultiSelect } from "@/components/PlayerMultiSelect";
import { OddsChart } from "@/components/OddsChart";

type MarketKey = "batter_home_runs" | "batter_first_home_run";
type OutcomeKey = "over" | "under" | "yes" | "no";

const MARKETS: { key: MarketKey; label: string; outcomes: OutcomeKey[]; defaultOutcome: OutcomeKey }[] = [
  { key: "batter_home_runs", label: "Batter Home Runs (0.5)", outcomes: ["over", "under"], defaultOutcome: "over" },
  { key: "batter_first_home_run", label: "Batter First Home Run", outcomes: ["yes", "no"], defaultOutcome: "yes" },
];

export default function DashboardPage() {
  const [games, setGames] = useState<any[]>([]);
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [selectedPlayers, setSelectedPlayers] = useState<{ player_id: string; full_name: string }[]>([]);
  const [market, setMarket] = useState<MarketKey>("batter_home_runs");
  const [outcome, setOutcome] = useState<OutcomeKey>("over");
  const [query, setQuery] = useState("");

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/games", { cache: "no-store" });
      const json = await res.json();
      if (json.ok) setGames(json.games);
    })();
  }, []);

  // Reset outcome to the market's default when switching market
  useEffect(() => {
    const def = MARKETS.find((m) => m.key === market)?.defaultOutcome;
    if (def) setOutcome(def);
  }, [market]);

  const selectedGame = useMemo(
    () => games.find((g) => g.game_id === selectedGameId),
    [games, selectedGameId]
  );

  const filteredParticipants = useMemo(() => {
    const list = selectedGame?.participants ?? [];
    if (!query.trim()) return list;
    const q = query.toLowerCase();
    return list.filter((p: any) => p.full_name.toLowerCase().includes(q));
  }, [selectedGame, query]);

  const thisMarket = MARKETS.find((m) => m.key === market)!;

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="rounded-2xl border bg-white shadow-sm">
        <div className="p-4 border-b flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">MLB Odds Dashboard</h2>
        </div>

        <div className="p-4 grid gap-5 md:grid-cols-3">
          {/* Left column: game + market + outcome */}
          <div className="space-y-4">
            <GamePicker games={games} value={selectedGameId} onChange={setSelectedGameId} />

            <div className="space-y-1">
              <label className="text-sm font-medium">Market</label>
              <div className="grid grid-cols-1 gap-2">
                {MARKETS.map((opt) => (
                  <button
                    key={opt.key}
                    className={`px-3 py-2 border rounded-md text-sm text-left ${
                      market === opt.key ? "bg-blue-50 border-blue-300" : "bg-white hover:bg-gray-50"
                    }`}
                    onClick={() => setMarket(opt.key)}
                    aria-pressed={market === opt.key}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Outcome</label>
              <div className="flex gap-2">
                {thisMarket.outcomes.map((o) => (
                  <button
                    key={o}
                    className={`px-3 py-2 border rounded-md text-sm ${
                      outcome === o ? "bg-blue-50 border-blue-300" : "bg-white hover:bg-gray-50"
                    }`}
                    onClick={() => setOutcome(o)}
                  >
                    {o.toUpperCase()}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-500">
                If the selected outcome has no snapshots in your DB yet, the chart will show an empty state.
              </p>
            </div>
          </div>

          {/* Right column: players */}
          <div className="md:col-span-2 space-y-3">
            <div className="flex items-center gap-2">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search players…"
                className="w-full border rounded-md px-3 py-2 text-sm"
              />
              <button
                className="px-3 py-2 border rounded-md text-sm bg-white hover:bg-gray-50"
                onClick={() => {
                  if (!filteredParticipants?.length) return;
                  // Select all filtered (avoid duplicates)
                  const existing = new Set(selectedPlayers.map((p) => p.player_id));
                  const merged = [
                    ...selectedPlayers,
                    ...filteredParticipants
                      .filter((p: any) => !existing.has(p.player_id))
                      .map((p: any) => ({ player_id: p.player_id, full_name: p.full_name })),
                  ];
                  setSelectedPlayers(merged);
                }}
              >
                Select all
              </button>
              <button
                className="px-3 py-2 border rounded-md text-sm bg-white hover:bg-gray-50"
                onClick={() => setSelectedPlayers([])}
              >
                Clear
              </button>
            </div>

            <PlayerMultiSelect
              disabled={!selectedGame}
              participants={filteredParticipants}
              value={selectedPlayers}
              onChange={setSelectedPlayers}
            />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border bg-white shadow-sm">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">
            {MARKETS.find((m) => m.key === market)?.label} — {outcome.toUpperCase()} — Price History
          </h2>
          <p className="text-sm text-gray-500">
            Hover to see each snapshot’s American odds and implied probability. Click legend items to hide/show a series.
          </p>
        </div>
        <div className="p-4">
          <OddsChart
            gameId={selectedGameId}
            players={selectedPlayers}
            marketKey={market}
            outcome={outcome}
          />
        </div>
      </div>
    </div>
  );
}
