create table if not exists teams (
  team_id text primary key,
  name text,
  abbr text unique,
  league text,
  created_at timestamptz not null default now()
);

create table if not exists players (
  player_id text primary key,
  mlbam_id text unique,
  full_name text not null,
  team_abbr text references teams(abbr) on update cascade,
  position text,
  bats text,
  throws text,
  status text,
  active boolean default true,
  headshot text,
  updated_at timestamptz not null default now()
);
create index if not exists players_team_abbr_idx on players(team_abbr);

create table if not exists games (
  game_id text primary key,
  sport_key text not null,
  game_date date,
  commence_time timestamptz not null,
  home_team text references teams(abbr) on update cascade,
  away_team text references teams(abbr) on update cascade,
  created_at timestamptz not null default now()
);
create index if not exists games_date_idx on games(game_date);
create index if not exists games_commence_idx on games(commence_time);

create table if not exists game_participants (
  game_id text references games(game_id) on delete cascade,
  player_id text references players(player_id) on delete cascade,
  team_abbr text references teams(abbr) on update cascade,
  batting_order int,
  primary key (game_id, player_id)
);
create index if not exists gp_team_idx on game_participants(team_abbr);

create table if not exists markets (
  market_key text primary key,
  description text
);
insert into markets (market_key, description)
values ('player_home_run', 'Anytime Home Run (O 0.5)')
on conflict (market_key) do nothing;

create table if not exists odds (
  market_key text references markets(market_key) on delete cascade,
  player_id text references players(player_id) on delete cascade,
  game_id text references games(game_id) on delete cascade,
  bookmaker text not null,
  american_odds int not null,
  decimal_odds numeric(10,4),
  updated_at timestamptz not null default now(),
  primary key (market_key, player_id, game_id, bookmaker)
);
create index if not exists odds_player_idx on odds(player_id);

create table if not exists odds_history (
  id bigserial primary key,
  market_key text references markets(market_key) on delete cascade,
  player_id text references players(player_id) on delete cascade,
  game_id text references games(game_id) on delete cascade,
  bookmaker text not null,
  american_odds int not null,
  decimal_odds numeric(10,4),
  captured_at timestamptz not null default now()
);
create index if not exists odds_history_player_time_idx on odds_history(player_id, captured_at);
create index if not exists odds_history_game_idx on odds_history(game_id);

create or replace function touch_updated_at()
returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;$$ language plpgsql;

create trigger players_touch
before update on players
for each row execute function touch_updated_at();

create or replace view v_games_today as
select * from games
where (commence_time at time zone 'UTC')::date = (now() at time zone 'UTC')::date;
