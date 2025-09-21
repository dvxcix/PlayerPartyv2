// lib/headshots.ts
const MAP_CSV = "/map.csv"; // already in /public

// Very lightweight map cache (client-side)
let mem: Record<string, string> | null = null;

async function loadMap(): Promise<Record<string, string>> {
  if (mem) return mem;
  try {
    const res = await fetch(MAP_CSV, { cache: "force-cache" });
    const txt = await res.text();
    const map: Record<string, string> = {};
    // Expect CSV: "full_name,MLBAMID"
    txt
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .forEach((line) => {
        const [name, id] = line.split(",").map((s) => s?.trim());
        if (name && id) map[name] = id;
      });
    mem = map;
    return map;
  } catch {
    mem = {};
    return mem;
  }
}

export function headshotSrcFor(fullName: string): string {
  // Synchronous best-effort: derive filename by name if map not yet loaded
  // We keep the same convention you set: /public/headshots + /headshots2 by MLBAMID.png
  // Since dynamic fetch isn't guaranteed here, we optimistically build by "best guess":
  const safe = (fullName || "").trim();
  // No MLBAMID? fall back immediately
  // The UI's onError will fall back to _default.avif if the image isn't present
  return `/headshots/${safe}.png`;
}

// Optional: expose an async helper if you want to pre-resolve MLBAMID somewhere else
export async function resolveHeadshot(fullName: string): Promise<string> {
  const map = await loadMap();
  const id = map[fullName];
  if (!id) return "/_default.avif";
  // Try headshots/, then headshots2/
  return `/headshots/${id}.png`;
}
