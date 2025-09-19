export type Team = { team_id: string; name?: string | null; abbr: string; league?: string | null };
export type Player = { player_id: string; mlbam_id?: string | null; full_name: string; team_abbr?: string | null; position?: string | null; headshot?: string | null };
export type Game = { game_id: string; sport_key: string; game_date: string | null; commence_time: string; home_team: string; away_team: string };
export type Participant = { game_id: string; player_id: string; team_abbr: string; batting_order?: number | null; full_name: string };
export type OddsPoint = { market_key: string; player_id: string; game_id: string; bookmaker: string; american_odds: number; decimal_odds?: number | null; captured_at: string };
