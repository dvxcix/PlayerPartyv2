// app/dashboard/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import RefreshButton from "@/components/RefreshButton";
import TeamLogo from "@/components/TeamLogo";
import HeadshotImg from "@/components/HeadshotImg";
import OddsChart from "@/components/OddsChart";

// ------- Minimal local types matching your APIs -------
type GameRow = {
  game_id: string;
  commence_time: string;
  home_team: string | null;
  away_team: string | null;
  home_team_abbr: string; // lowercase for /public/logos/{abbr}.png
  away_team_abbr: string; // lowercase for /public/logos/{abbr}.png
};

type PlayerRow = {
  player_id: string;
  full_name: string;
  team_abbr: string | null; // lowercase
  game_id: string;
  batting_order?: number | null;
};

// Aligns with components/OddsChart expected shape
type MarketKey = "home_run" | "first_home_run";
type PlayerPick = { player_id: string; full_name: string; game_id: string };

// ------------- Helpers -------------
function classNames(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

export default function DashboardPage() {
  // UI state
  const [games, setGames] = useState<GameRow[]>([]);
  const [gamesLoading, setGamesLoading] = useState(false);
  const [gamesError, setGamesError] = useState<string | null>(null);

  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [playersLoading, setPlayersLoading] = useState(false);
  const [playersError, setPlayersError] = useState<string | null>(null);

  const [selectedGameIds, setSelectedGameIds] = useState<Set<string>>(new Set());
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<Set<string>>(new Set());

  const [market, setMarket] = useState<MarketKey>("home_run");

  // Force manual reloads of data without a full page refresh
  const [reloadKey, setReloadKey] = useState(0);
  const reloadData = useCallback(() => setReloadKey((k) => k + 1), []);

  // --------- Load today's games ----------
  useEffect(() => {
    let alive = true;
    (async () => {
      setGamesLoading(true);
      setGamesError(null);
      try {
        const res = await fetch("/api/games", { cache: "no-store" });
        const text = await res.text();
        let json: any;
        try {
          json = JSON.parse(text);
        } catch {
          throw new Error(`Non-JSON from /api/games: ${text.slice(0, 180)}`);
        }
        if (!json.ok) throw new Error(json.error || "Failed to load games");
        if (!alive) return;
        const data = (json.data || []) as GameRow[];
        setGames(data);
        // Keep previously selected game ids if still present; otherwise none selected (means "show all")
        setSelectedGameIds((prev) => {
          const kept = new Set<string>();
          for (const g of data) if (prev.has(g.game_id)) kept.add(g.game_id);
          return kept;
        });
      } catch (e: any) {
        if (alive) setGamesError(String(e?.message ?? e));
      } finally {
        if (alive) setGamesLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  // --------- Load players for visible games ----------
  const visibleGameIds = useMemo(() => {
    // When none are selected, show ALL today's games
    if (!selectedGameIds.size) return games.map((g) => g.game_id);
    return Array.from(selectedGameIds);
  }, [games, selectedGameIds]);

  useEffect(() => {
    if (!games.length) {
      setPlayers([]);
      setPlayersError(null);
      return;
    }
    let alive = true;
    (async () => {
      setPlayersLoading(true);
      setPlayersError(null);
      try {
        const params =
          visibleGameIds.length > 0
            ? `?game_ids=${encodeURIComponent(visibleGameIds.join(","))}`
            : "";
        const res = await fetch(`/api/players${params}`, { cache: "no-store" });
        const text = await res.text();
        let json: any;
        try {
          json = JSON.parse(text);
        } catch {
          throw new Error(`Non-JSON from /api/players: ${text.slice(0, 180)}`);
        }
        if (!json.ok) throw new Error(json.error || "Failed to load players");
        if (!alive) return;
        const data = (json.data || []) as PlayerRow[];
        setPlayers(data);

        // Cull selected players that are no longer in the filtered list
        setSelectedPlayerIds((prev) => {
          const keep = new Set<string>();
          const allowed = new Set(data.map((p) => p.player_id));
          prev.forEach((id) => {
            if (allowed.has(id)) keep.add(id);
          });
          return keep;
        });
      } catch (e: any) {
        if (alive) setPlayersError(String(e?.message ?? e));
      } finally {
        if (alive) setPlayersLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [visibleGameIds.join(","), games.length, reloadKey]);

  // --------- Selection handlers ----------
  const toggleGame = (game_id: string) => {
    setSelectedGameIds((prev) => {
      const next = new Set(prev);
      if (next.has(game_id)) next.delete(game_id);
      else next.add(game_id);
      return next;
    });
  };

  const selectAllGames = () => setSelectedGameIds(new Set(games.map((g) => g.game_id)));
  const selectNoGames = () => setSelectedGameIds(new Set()); // none selected = show ALL (per spec)

  const togglePlayer = (player_id: string) => {
    setSelectedPlayerIds((prev) => {
      const next = new Set(prev);
      if (next.has(player_id)) next.delete(player_id);
      else next.add(player_id);
      return next;
    });
  };

  const selectedPicks: PlayerPick[] = useMemo(() => {
    const idset = selectedPlayerIds;
    return players
      .filter((p) => idset.has(p.player_id))
      .map((p) => ({ player_id: p.player_id, full_name: p.full_name, game_id: p.game_id }));
  }, [selectedPlayerIds, players]);

  // --------- Render ----------
  return (
    <div className="p-4 space-y-4">
      {/* Top bar */}
      <div className="flex items-center gap-3 justify-between">
        <h1 className="text-lg font-semibold">MLB HR / First HR Dashboard</h1>
        <div className="flex items-center gap-2">
          {/* Manual cron trigger */}
          <RefreshButton />
          {/* Local data reload (re-fetch lists immediately) */}
          <button
            type="button"
            onClick={reloadData}
            className="px-3 py-2 rounded-lg border bg-white hover:bg-gray-50"
            title="Re-fetch games and players now"
          >
            Reload Data
          </button>
          {/* Market picker */}
          <select
            value={market}
            onChange={(e) => setMarket(e.target.value as MarketKey)}
            className="px-2 py-2 border rounded-lg bg-white"
            title="Choose odds market"
          >
            <option value="home_run">Home Run (Anytime)</option>
            <option value="first_home_run">First Home Run</option>
          </select>
        </div>
      </div>

      {/* Two-column layout: Games & Players */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Games panel */}
        <div className="border rounded-xl bg-white">
          <div className="sticky top-0 z-10 bg-white border-b px-3 py-2 flex items-center justify-between">
            <div className="font-semibold">Games (Today)</div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={selectAllGames}
                className="text-xs px-2 py-1 rounded border bg-white hover:bg-gray-50"
              >
                All
              </button>
              <button
                type="button"
                onClick={selectNoGames}
                className="text-xs px-2 py-1 rounded border bg-white hover:bg-gray-50"
              >
                None
              </button>
            </div>
          </div>

          {gamesError && <div className="px-4 py-3 text-sm text-red-600">{gamesError}</div>}
          {!gamesError && gamesLoading && (
            <div className="px-4 py-3 text-sm text-gray-500">Loading games…</div>
          )}
          {!gamesError && !gamesLoading && !games.length && (
            <div className="px-4 py-3 text-sm text-gray-500">No games for today.</div>
          )}

          <div className="max-h-[360px] overflow-auto divide-y">
            {games.map((g) => {
              const checked = selectedGameIds.has(g.game_id);
              return (
                <button
                  key={g.game_id}
                  type="button"
                  onClick={() => toggleGame(g.game_id)}
                  className={classNames(
                    "w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-gray-50",
                    checked && "bg-blue-50/60"
                  )}
                  title={`${g.away_team ?? ""} @ ${g.home_team ?? ""}`}
                >
                  <TeamLogo abbr={g.away_team_abbr} size={18} />
                  <span className="uppercase text-xs text-gray-600">{g.away_team_abbr}</span>
                  <span className="mx-1 text-gray-400">@</span>
                  <TeamLogo abbr={g.home_team_abbr} size={18} />
                  <span className="uppercase text-xs text-gray-600">{g.home_team_abbr}</span>
                  <span className="ml-auto text-[11px] text-gray-400">
                    {new Date(g.commence_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <span
                    aria-hidden
                    className={classNames(
                      "ml-2 h-4 w-4 rounded border",
                      checked ? "bg-blue-500 border-blue-500" : "bg-white border-gray-300"
                    )}
                  />
                </button>
              );
            })}
          </div>
        </div>

        {/* Players panel (inline, no separate component required) */}
        <div className="border rounded-xl bg-white">
          <div className="sticky top-0 z-10 bg-white border-b px-3 py-2 font-semibold">Players</div>

          {playersError && <div className="px-4 py-3 text-sm text-red-600">{playersError}</div>}
          {!playersError && playersLoading && (
            <div className="px-4 py-3 text-sm text-gray-500">Loading players…</div>
          )}
          {!playersError && !playersLoading && !players.length && (
            <div className="px-4 py-3 text-sm text-gray-500">No players for today’s games.</div>
          )}

          <div className="max-h-[360px] overflow-auto divide-y">
            {players.map((p) => {
              const isChecked = selectedPlayerIds.has(p.player_id);
              return (
                <button
                  key={`${p.player_id}-${p.game_id}`}
                  type="button"
                  onClick={() => togglePlayer(p.player_id)}
                  className={classNames(
                    "w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-50",
                    isChecked && "bg-blue-50/60"
                  )}
                  title={`${p.full_name}${p.team_abbr ? ` (${p.team_abbr})` : ""}`}
                >
                  <HeadshotImg name={p.full_name} size={24} className="h-6 w-6 rounded-full border" />
                  <span className="text-sm truncate">{p.full_name}</span>
                  {p.team_abbr && (
                    <span className="ml-2 uppercase text-[11px] text-gray-500 flex items-center gap-1">
                      <TeamLogo abbr={p.team_abbr} size={16} />
                      {p.team_abbr}
                    </span>
                  )}
                  <span className="ml-auto text-[11px] text-gray-400">{p.game_id.slice(0, 6)}</span>
                  <span
                    aria-hidden
                    className={classNames(
                      "ml-2 h-4 w-4 rounded border",
                      isChecked ? "bg-blue-500 border-blue-500" : "bg-white border-gray-300"
                    )}
                  />
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Chart */}
      <OddsChart selected={selectedPicks} marketKey={market as any} outcome={"yes" as any} />
    </div>
  );
}
