const THEODDSAPI_BASE = "https://api.the-odds-api.com/v4";

export const ALLOWED_BOOKS = ["fanduel", "betmgm"];
export const BOOK_COLORS: Record<string, string> = {
  fanduel: "#1E90FF",
  betmgm: "#8B4513",
};

export type OddsApiBookmaker = {
  key: string; title: string; markets: Array<{ key: string; outcomes: any[] }>;
};

export async function fetchMlbEvents(): Promise<any[]> {
  const url = new URL(`${THEODDSAPI_BASE}/sports/baseball_mlb/events`);
  url.searchParams.set("apiKey", process.env.THEODDSAPI_KEY!);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Events fetch failed: ${res.status}`);
  return res.json();
}

export async function fetchMlbPlayerHomeRunOdds(): Promise<any[]> {
  const url = new URL(`${THEODDSAPI_BASE}/sports/baseball_mlb/odds`);
  url.searchParams.set("markets", "player_home_run");
  url.searchParams.set("regions", "us");
  url.searchParams.set("oddsFormat", "american");
  url.searchParams.set("dateFormat", "iso");
  url.searchParams.set("apiKey", process.env.THEODDSAPI_KEY!);
  const res = await fetch(url.toString(), { next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`Odds fetch failed: ${res.status}`);
  return res.json();
}

export function normalizeTeamAbbr(nameOrAbbr: string): string {
  const map: Record<string, string> = {
    "Arizona Diamondbacks": "ARI",
    "Atlanta Braves": "ATL",
    "Baltimore Orioles": "BAL",
    "Boston Red Sox": "BOS",
    "Chicago Cubs": "CHC",
    "Chicago White Sox": "CWS",
    "Cincinnati Reds": "CIN",
    "Cleveland Guardians": "CLE",
    "Colorado Rockies": "COL",
    "Detroit Tigers": "DET",
    "Houston Astros": "HOU",
    "Kansas City Royals": "KC",
    "Los Angeles Angels": "LAA",
    "Los Angeles Dodgers": "LAD",
    "Miami Marlins": "MIA",
    "Milwaukee Brewers": "MIL",
    "Minnesota Twins": "MIN",
    "New York Mets": "NYM",
    "New York Yankees": "NYY",
    "Oakland Athletics": "OAK",
    "Philadelphia Phillies": "PHI",
    "Pittsburgh Pirates": "PIT",
    "San Diego Padres": "SD",
    "San Francisco Giants": "SF",
    "Seattle Mariners": "SEA",
    "St. Louis Cardinals": "STL",
    "Tampa Bay Rays": "TB",
    "Texas Rangers": "TEX",
    "Toronto Blue Jays": "TOR",
    "Washington Nationals": "WSH",
  };
  const trimmed = (nameOrAbbr || "").trim();
  return map[trimmed] ?? trimmed.toUpperCase();
}

export function americanToDecimal(american: number): number {
  return american > 0 ? 1 + american / 100 : 1 + 100 / Math.abs(american);
}
