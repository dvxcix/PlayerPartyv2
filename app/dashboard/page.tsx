// app/dashboard/page.tsx
"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import MultiGamePicker, { Game } from "@/components/MultiGamePicker";
import PlayersPanel from "@/components/PlayersPanel";
import OddsChart from "@/components/OddsChart";

type MarketKey = "batter_home_runs" | "batter_first_home_run";
type OutcomeKey = "over" | "under" | "yes" | "no";
type PlayerMin = { player_id: string; full_name: string };

const MARKETS: { key: MarketKey; label: string; outcomes: OutcomeKey[]; defaultOutcome: OutcomeKey }[] = [
  { key: "batter_home_runs", label: "Batter Home Runs (0.5)", outcomes: ["over", "under"], defaultOutcome: "over" },
  { key: "batter_first_home_run", label: "Batter First Home Run", outcomes: ["yes", "no"], defaultOutcome: "yes" },
];

export default function DashboardPage() {
  const [games, setGames] = useState<Game[]>([]);
  const [gamesErr, setGamesErr] = useState<string | null>(null);
  const [selectedGameIds, setSelectedGameIds] = useState<string[]>([]);
  const [selectedPlayers, setSelectedPlayers] = useState<PlayerMin[]>([]);
  const [market, setMarket] = useState<MarketKey>("batter_home_runs");
  const [outcome, setOutcome] = useState<OutcomeKey>("over");

  // Panels
  const [showGames, setShowGames] = useState(true);
  const [showPlayers, setShowPlayers] = useState(true);

  // Refresh
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        setGamesErr(null);
        const res = await fetch("/api/games", { cache: "no-store" });
        const json = await res.json();
        if (json?.ok && Array.isArray(json.data)) setGames(json.data);
        else setGamesErr(`Failed to load games: ${json?.error ?? "Unknown error"}`);
      } catch (e: any) {
        setGamesErr(`Failed to load games: ${e?.message ?? e}`);
      }
    })();
  }, []);

  useEffect(() => {
    const def = MARKETS.find((m) => m.key === market)?.defaultOutcome;
    if (def) setOutcome(def);
  }, [market]);

  const selectedSummary = useMemo(() => {
    const countPlayers = selectedPlayers.length;
    const countGames = selectedGameIds.length;
    return `${countGames} game${countGames === 1 ? "" : "s"} · ${countPlayers} player${countPlayers === 1 ? "" : "s"}`;
  }, [selectedPlayers, selectedGameIds]);

  async function manualRefresh() {
    try {
      setRefreshing(true);
      setRefreshMsg(null);
      const res = await fetch("/api/cron/odds", { method: "GET", cache: "no-store" });
      const json = await res.json();
      if (json.ok) {
        setRefreshMsg(`Refreshed: ${json.snapshots ?? 0} points`);
        setRefreshTick((n) => n + 1);
      } else {
        setRefreshMsg(`Refresh error: ${json.error ?? "Unknown error"}`);
      }
    } catch (e: any) {
      setRefreshMsg(`Refresh error: ${e.message ?? e}`);
    } finally {
      setRefreshing(false);
      setTimeout(() => setRefreshMsg(null), 3500);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* STATIC header */}
      <div className="sticky top-0 z-30 bg-white border-b">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-3">
              <Image
                src="/miscimg/playerpartylogo.png"
                alt="PlayerParty"
                width={128}
                height={32}
                priority
              />
              <span className="hidden sm:inline text-xs text-gray-500">{selectedSummary}</span>
            </div>

            <div className="hidden md:flex items-center gap-2">
              {/* Market */}
              <div className="flex items-center gap-1">
                {MARKETS.map((m) => (
                  <button
                    key={m.key}
                    className={`px-3 py-1.5 border rounded-md text-sm ${
                      market === m.key ? "bg-blue-50 border-blue-300" : "bg-white hover:bg-gray-50"
                    }`}
                    onClick={() => setMarket(m.key)}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              {/* Outcome */}
              <div className="flex items-center gap-1">
                {MARKETS.find((m) => m.key === market)!.outcomes.map((o) => (
                  <button
                    key={o}
                    className={`px-3 py-1.5 border rounded-md text-sm ${
                      outcome === o ? "bg-blue-50 border-blue-300" : "bg-white hover:bg-gray-50"
                    }`}
                    onClick={() => setOutcome(o)}
                  >
                    {o.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={manualRefresh}
                disabled={refreshing}
                className={`px-3 py-1.5 rounded-md text-xs border ${
                  refreshing ? "opacity-60 cursor-not-allowed" : "bg-white hover:bg-gray-50"
                }`}
                title="Fetch latest odds now"
              >
                {refreshing ? "Refreshing…" : "Refresh"}
              </button>
            </div>
          </div>
        </div>

        {refreshMsg && (
          <div className="bg-white/80 backdrop-blur border-t">
            <div className="max-w-7xl mx-auto px-4 py-2 text-xs text-gray-700">{refreshMsg}</div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Games */}
          <div className="rounded-2xl border bg-white shadow-sm">
            <div className="p-3 border-b flex items-center justify-between">
              <div>
                <div className="font-medium">Games</div>
                <div className="text-xs text-gray-500">Pick any games; compare players across them.</div>
              </div>
              <button
                className="text-xs px-2 py-1 border rounded-md bg-white hover:bg-gray-50"
                onClick={() => setShowGames((v) => !v)}
              >
                {showGames ? "Minimize" : "Expand"}
              </button>
            </div>
            {showGames && (
              <div className="p-3">
                {gamesErr ? (
                  <div className="text-sm text-red-600">{gamesErr}</div>
                ) : (
                  <MultiGamePicker games={games} value={selectedGameIds} onChange={setSelectedGameIds} />
                )}
              </div>
            )}
          </div>

          {/* Players */}
          <div className="rounded-2xl border bg-white shadow-sm">
            <div className="p-3 border-b flex items-center justify-between">
              <div>
                <div className="font-medium">Players</div>
                <div className="text-xs text-gray-500">Search, select all, or pick specific players.</div>
              </div>
              <button
                className="text-xs px-2 py-1 border rounded-md bg-white hover:bg-gray-50"
                onClick={() => setShowPlayers((v) => !v)}
              >
                {showPlayers ? "Minimize" : "Expand"}
              </button>
            </div>
            {showPlayers && (
              <div className="p-3">
                <PlayersPanel
                  selectedGameIds={selectedGameIds}
                  value={selectedPlayers}
                  onChange={setSelectedPlayers}
                />
              </div>
            )}
          </div>
        </div>

        {/* Full-width Chart */}
        <div className="rounded-2xl border bg-white shadow-sm">
          <div className="p-3 border-b">
            <div className="font-medium">
              Price History — {market === "batter_home_runs" ? "Over/Under 0.5 HR" : "First HR Yes/No"} — {outcome.toUpperCase()}
            </div>
            <div className="text-xs text-gray-500">Hover a line or dot for details. Zoom, pan, brush. Export CSV.</div>
          </div>
          <div className="p-3">
            <OddsChart
              gameIds={selectedGameIds}
              players={selectedPlayers}
              marketKey={market}
              outcome={outcome}
              refreshTick={refreshTick}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
