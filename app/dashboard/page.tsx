// app/dashboard/page.tsx
"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { MultiGamePicker } from "@/components/MultiGamePicker";
import { PlayersPanel } from "@/components/PlayersPanel";
import { OddsChart } from "@/components/OddsChart";

type MarketKey = "batter_home_runs" | "batter_first_home_run";
type OutcomeKey = "over" | "under" | "yes" | "no";

type Participant = {
  player_id?: string;
  full_name?: string;
  team_abbr?: string;
  players?: { full_name?: string };
};

type Game = {
  game_id: string;
  commence_time: string; // ISO
  home_team?: string;
  away_team?: string;
  home_team_abbr?: string;
  away_team_abbr?: string;
  home_abbr?: string;
  away_abbr?: string;
  participants?: Participant[];
};

// YYYY-MM-DD in America/New_York
function ymdET(iso: string | undefined | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  if (!y || !m || !day) return null;
  return `${y}-${m}-${day}`;
}

const MARKETS: { key: MarketKey; label: string; outcomes: OutcomeKey[]; defaultOutcome: OutcomeKey }[] = [
  { key: "batter_home_runs", label: "Batter Home Runs (0.5)", outcomes: ["over", "under"], defaultOutcome: "over" },
  { key: "batter_first_home_run", label: "Batter First Home Run", outcomes: ["yes", "no"], defaultOutcome: "yes" },
];

async function fetchJson(url: string): Promise<any | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    const txt = await res.text();
    return JSON.parse(txt);
  } catch {
    return null;
  }
}

export default function DashboardPage() {
  const [games, setGames] = useState<Game[]>([]);
  const [gamesError, setGamesError] = useState<string | null>(null);

  const [selectedGameIds, setSelectedGameIds] = useState<string[]>([]);
  const [selectedPlayers, setSelectedPlayers] = useState<{ player_id: string; full_name: string }[]>([]);

  const [market, setMarket] = useState<MarketKey>("batter_home_runs");
  const [outcome, setOutcome] = useState<OutcomeKey>("over");

  // Panels
  const [showGames, setShowGames] = useState(true);
  const [showPlayers, setShowPlayers] = useState(true);

  // Refresh
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  // ROBUST GAMES FETCH (stays on /api/games)
  useEffect(() => {
    let alive = true;
    (async () => {
      setGamesError(null);

      // Try with participants hint first, then without
      const candidates = ["/api/games?with_participants=1", "/api/games"];

      let list: any[] | null = null;
      let lastErr = "No games array in response";

      for (const url of candidates) {
        const payload = await fetchJson(url);
        if (!payload) {
          lastErr = `Non-JSON from ${url}`;
          continue;
        }
        if (Array.isArray(payload)) {
          list = payload;
          break;
        }
        if (payload.games && Array.isArray(payload.games)) {
          list = payload.games;
          break;
        }
        if (payload.ok && Array.isArray(payload.games)) {
          list = payload.games;
          break;
        }
        lastErr = `No games array in response`;
      }

      if (!alive) return;

      if (!list) {
        setGames([]);
        setGamesError(lastErr);
        return;
      }

      const norm: Game[] = list
        .filter((g) => g && (g.game_id || g.id) && g.commence_time)
        .map((g) => {
          const game_id = String(g.game_id ?? g.id);
          const home_abbr = (g.home_team_abbr ?? g.home_abbr ?? g.home_team ?? g.home ?? "").toString().toLowerCase();
          const away_abbr = (g.away_team_abbr ?? g.away_abbr ?? g.away_team ?? g.away ?? "").toString().toLowerCase();

          let parts: Participant[] | undefined = undefined;
          if (Array.isArray(g.participants)) {
            parts = g.participants.map((p: any) => ({
              player_id: p.player_id ?? p.id ?? p.players?.full_name ?? undefined,
              full_name: p.full_name ?? p.players?.full_name ?? p.player_name ?? undefined,
              team_abbr: p.team_abbr ?? undefined,
            }));
          }

          return {
            game_id,
            commence_time: g.commence_time,
            home_team: g.home_team ?? g.home ?? undefined,
            away_team: g.away_team ?? g.away ?? undefined,
            home_team_abbr: home_abbr || undefined,
            away_team_abbr: away_abbr || undefined,
            home_abbr: home_abbr || undefined,
            away_abbr: away_abbr || undefined,
            participants: parts,
          } as Game;
        });

      setGames(norm);
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Keep outcome synced with market
  useEffect(() => {
    const def = MARKETS.find((m) => m.key === market)?.defaultOutcome;
    if (def) setOutcome(def);
  }, [market]);

  const selectedSummary = useMemo(() => {
    const countPlayers = selectedPlayers.length;
    const countGames = selectedGameIds.length;
    return `${countGames} game${countGames === 1 ? "" : "s"} · ${countPlayers} player${countPlayers === 1 ? "" : "s"}`;
  }, [selectedPlayers, selectedGameIds]);

  // ET date map for games
  const gameDates: Record<string, string> = useMemo(() => {
    const map: Record<string, string> = {};
    for (const g of games) {
      const d = ymdET(g.commence_time);
      if (g.game_id && d) map[g.game_id] = d;
    }
    return map;
  }, [games]);

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
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white border-b">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-3">
              <Image src="/miscimg/playerpartylogo.png" alt="PlayerParty" width={128} height={32} priority />
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
                {gamesError ? (
                  <div className="text-xs text-red-600 break-words">Failed to load games: {gamesError}</div>
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
                  games={games}
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
            <div className="text-xs text-gray-500">Hover for details. Zoom, pan, brush. Export CSV.</div>
          </div>
          <div className="p-3">
            <OddsChart
              gameIds={selectedGameIds}
              gameDates={useMemo(() => {
                const map: Record<string, string> = {};
                for (const g of games) {
                  const d = ymdET(g.commence_time);
                  if (g?.game_id && d) map[g.game_id] = d;
                }
                return map;
              }, [games])}
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
