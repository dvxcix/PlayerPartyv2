// lib/headshots.ts

// Very lightweight mapper that tries (in order):
// 1) /headshots2/<slug>.png
// 2) /headshots/<slug>.png
// 3) /_default.avif
//
// If you later want to add a map.csv lookup, you can expand `slugFor`.

function slugFor(name: string): string {
  return (name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Returns a static asset URL for a player's headshot.
 * We keep it synchronous and static (no fetch) so it works in both SSR/CSR.
 */
export function headshotSrcFor(name: string, mlbamId?: string | number | null): string {
  // If you later add a strict id-based naming, keep this here
  const slug = slugFor(name);
  // Prefer headshots2 (your newer set), then headshots (older), then default
  return `/headshots2/${slug}.png`;
}

/** Fallback list you might want to probe in the component if 404s are an issue. */
export const HEADSHOT_FALLBACKS = (name: string) => [
  `/headshots2/${slugFor(name)}.png`,
  `/headshots/${slugFor(name)}.png`,
  `/_default.avif`,
];
