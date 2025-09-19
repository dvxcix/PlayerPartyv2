alter table teams enable row level security;
alter table players enable row level security;
alter table games enable row level security;
alter table game_participants enable row level security;
alter table markets enable row level security;
alter table odds enable row level security;
alter table odds_history enable row level security;

create policy if not exists "public read teams" on teams for select using (true);
create policy if not exists "public read players" on players for select using (true);
create policy if not exists "public read games" on games for select using (true);
create policy if not exists "public read gp" on game_participants for select using (true);
create policy if not exists "public read markets" on markets for select using (true);
create policy if not exists "public read odds" on odds for select using (true);
create policy if not exists "public read odds_history" on odds_history for select using (true);
