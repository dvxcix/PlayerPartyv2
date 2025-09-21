// lib/types.ts
export type Game = {
  id: string;
  game_id: string;
  home_team_abbr: string;
  away_team_abbr: string;
  commence_time: string; // ISO
};

export type ApiGame = Game;

export type PlayerListItem = {
  player_id: string;
  full_name: string;
  team_abbr: string | null;
  game_id: string;
};

export type PlayerPick = {
  player_id: string;
  full_name: string;
  game_id: string;
};

export type OddsSnapshot = {
  captured_at: string;           // ISO
  american_odds: number;
  bookmaker: "fanduel" | "betmgm";
};

export type MarketKey = "batter_home_runs" | "batter_first_home_run";
export type OutcomeKey = "yes";
