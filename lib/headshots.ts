// lib/headshots.ts
"use client";

/**
 * Headshot loader for client-side usage.
 *
 * Requirements:
 * - /public/map.csv with two columns (header row required):
 *     full_name,MLBAMID
 * - Headshot images stored in:
 *     /public/headshots/<MLBAMID>.png
 *     /public/headshots2/<MLBAMID>.png
 * - Fallback image:
 *     /public/_default.avif
 */

let _mapPromise: Promise<Map<string, string>> | null = null;

function normalizeName(name: string) {
  return name.trim().toLowerCase();
}

/** Parse CSV text into a Map<normalized full_name, id> */
function parseCsvToMap(csv: string): Map<string, string> {
  const map = new Map<string, string>();
  const lines = csv.split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return map;

  // header
  const header = lines[0].split(",").map((s) => s.trim().toLowerCase());
  const nameIdx = header.findIndex((h) => h === "full_name" || h === "name");
  const idIdx = header.findIndex((h) => h === "mlbamid" || h === "id");
  if (nameIdx === -1 || idIdx === -1) return map;

  for (let i = 1; i < lines.length; i++) {
    const row = lines[i].split(","); // names shouldn't contain commas typically; if they do, switch to a stronger CSV parser later
    if (row.length <= Math.max(nameIdx, idIdx)) continue;
    const fullName = row[nameIdx]?.trim();
    const id = row[idIdx]?.trim();
    if (!fullName || !id) continue;
    map.set(normalizeName(fullName), id);
  }
  return map;
}

/** Lazy-load and cache the CSV map */
export async function loadHeadshotMap(): Promise<Map<string, string>> {
  if (_mapPromise) return _mapPromise;
  _mapPromise = fetch("/map.csv", { cache: "force-cache" })
    .then(async (r) => {
      if (!r.ok) throw new Error(`Failed to fetch /map.csv (${r.status})`);
      const text = await r.text();
      return parseCsvToMap(text);
    })
    .catch((err) => {
      console.error("headshots: failed to load map.csv", err);
      return new Map<string, string>();
    });
  return _mapPromise;
}

export async function getIdForName(fullName: string): Promise<string | null> {
  const map = await loadHeadshotMap();
  return map.get(normalizeName(fullName)) ?? null;
}

/**
 * Build the ordered candidate src list for a given id.
 * We try /headshots, then /headshots2, then default.
 */
export function buildHeadshotCandidates(id: string | null): string[] {
  const list: string[] = [];
  if (id && id.length) {
    list.push(`/headshots/${id}.png`);
    list.push(`/headshots2/${id}.png`);
  }
  list.push("/_default.avif");
  return list;
}
