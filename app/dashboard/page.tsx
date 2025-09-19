// app/dashboard/page.tsx
"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { MultiGamePicker } from "@/components/MultiGamePicker";
import { PlayersPanel } from "@/components/PlayersPanel";
import { OddsChart } from "@/components/OddsChart";

type MarketKey = "batter_home_runs" | "batter_first_home_run";
type OutcomeKey = "over" | "under" | "yes" | "no";

const MARKETS: { key: MarketKey; label: string; outcomes: OutcomeKey[]; defaultOutcome: OutcomeKey }[] = [
  { key: "batter_home_runs", label: "Batter Home Runs (0.5)", outcomes: ["over", "under"], defaultOutcome: "over" },
  { key: "batter_first_home_run", label: "Batter First Home Run", outcomes: ["yes", "no"], defaultOutcome: "yes" },
];

export default function DashboardPage() {
  const [games, setGames] = useState<any[]>([]);
  const [selectedGameIds, setSelectedGameIds] = useState<string[]>([]);
  const [selectedPlayers, setSelectedPlayers] = useState<{ player_id: string; full_name: string }[]>([]);
  const [market, setMarket] = useState<MarketKey>("batter_home_runs");
  const [outcome, setOutcome] = useState<OutcomeKey>("over");

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/games", { cache: "no-store" });
      const json = await res.json();
      if (json.ok) setGames(json.games);
    })();
  }, []);

  useEffect(() => {
    const def = MARKETS.find((m) => m.key === market)?.defaultOutcome;
    if (def) setOutcome(def);
  }, [market]);

  const selectedSummary = useMemo(() => {
    const countPlayers = selectedPlayers.length;
    const countGames = selectedGameIds.length;
    return `${countPlayers} player${countPlayers === 1 ? "" : "s"} · ${countGames} game${countGames === 1 ? "" : "s"}`;
  }, [selectedPlayers, selectedGameIds]);

  return (
    <div className="min-h-screen">
      {/* Sticky header with centered logo */}
      <div className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col items-center gap-2">
          <Image
            src="/miscimg/playerpartylogo.png"
            alt="PlayerParty"
            width={180}
            height={48}
            priority
          />
          <div className="flex w-full items-center flex-wrap gap-2 justify-between">
            <div className="text-xs text-gray-500">{selectedSummary}</div>
            <div className="flex flex-wrap items-center gap-2">
              {/* Market switcher */}
              <div className="flex items-center gap-1">
                {MARKETS.map((m) => (
                  <button
                    key={m.key}
                    className={`px-3 py-1.5 border rounded-md text-sm ${market === m.key ? "bg-blue-50 border-blue-300" : "bg-white hover:bg-gray-50"}`}
                    onClick={() => setMarket(m.key)}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              {/* Outcome switcher */}
              <div className="flex items-center gap-1">
                {MARKETS.find((m) => m.key === market)!.outcomes.map((o) => (
                  <button
                    key={o}
                    className={`px-3 py-1.5 border rounded-md text-sm ${outcome === o ? "bg-blue-50 border-blue-300" : "bg-white hover:bg-gray-50"}`}
                    onClick={() => setOutcome(o)}
                  >
                    {o.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-7xl mx-auto p-4 grid gap-4 lg:grid-cols-3">
        {/* Games */}
        <div className="lg:col-span-1 space-y-4">
          <div className="rounded-2xl border bg-white shadow-sm">
            <div className="p-3 border-b">
              <div className="font-medium">Games</div>
              <div className="text-xs text-gray-500">Pick any games; players from all selected games can show together.</div>
            </div>
            <div className="p-3">
              <MultiGamePicker games={games} value={selectedGameIds} onChange={setSelectedGameIds} />
            </div>
          </div>
        </div>

        {/* Players + Chart */}
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-2xl border bg-white shadow-sm">
            <div className="p-3 border-b">
              <div className="font-medium">Players</div>
              <div className="text-xs text-gray-500">Search, select all, or pick specific players across chosen games.</div>
            </div>
            <div className="p-3">
              <PlayersPanel
                games={games}
                selectedGameIds={selectedGameIds}
                value={selectedPlayers}
                onChange={setSelectedPlayers}
              />
            </div>
          </div>

          <div className="rounded-2xl border bg-white shadow-sm">
            <div className="p-3 border-b">
              <div className="font-medium">
                Price History — {market === "batter_home_runs" ? "Over/Under 0.5 HR" : "First HR Yes/No"} — {outcome.toUpperCase()}
              </div>
              <div className="text-xs text-gray-500">
                Hover a line for details. Zoom/pan/brush. Toggle sportsbooks. Export CSV.
              </div>
            </div>
            <div className="p-3">
              <OddsChart
                gameIds={selectedGameIds}
                players={selectedPlayers}
                marketKey={market}
                outcome={outcome}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
