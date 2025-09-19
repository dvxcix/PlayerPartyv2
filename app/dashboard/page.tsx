// app/dashboard/page.tsx
"use client";

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

  // Reset outcome to the market’s default when switching market
  useEffect(() => {
    const def = MARKETS.find((m) => m.key === market)?.defaultOutcome;
    if (def) setOutcome(def);
  }, [market]);

  // Build a flattened list of participants limited to selected games (for the right panel)
  const visibleParticipants = useMemo(() => {
    const picked = new Set(selectedGameIds);
    const list: Array<{ game_id: string; player_id: string; full_name: string; team_abbr: string }> = [];
    for (const g of games) {
      if (!picked.has(g.game_id)) continue;
      for (const p of g.participants ?? []) {
        list.push({ game_id: g.game_id, player_id: p.player_id, full_name: p.full_name, team_abbr: p.team_abbr });
      }
    }
    return list;
  }, [games, selectedGameIds]);

  // Derive a compact “selected pills” summary
  const selectedSummary = useMemo(() => {
    const countPlayers = selectedPlayers.length;
    const countGames = selectedGameIds.length;
    return `${countPlayers} player${countPlayers === 1 ? "" : "s"} · ${countGames} game${countGames === 1 ? "" :
