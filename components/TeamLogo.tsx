// components/TeamLogo.tsx
"use client";

import Image from "next/image";
import { useMemo, useState } from "react";

// Canonical file keys you actually have in /public/logos:
// ari, atl, bal, bos, chc, chw, cin, cle, col, det, hou, kc, laa, lad, mia, mil, min,
// nym, nyy, oak, phi, pit, sd, sea, sf, stl, tb, tex, tor, wsh
const CANONICAL_MAP: Record<string, string> = {
  // NL West
  "ari": "ari", "arz": "ari", "diamondbacks": "ari",
  "lad": "lad", "lan": "lad", "la": "lad", "dodgers": "lad",
  "sd": "sd", "sdp": "sd", "padres": "sd",
  "sf": "sf", "sfg": "sf", "giants": "sf",
  "col": "col", "rockies": "col",

  // NL Central
  "chc": "chc", "chn": "chc", "cubs": "chc",
  "cin": "cin", "reds": "cin",
  "mil": "mil", "brewers": "mil",
  "pit": "pit", "pirates": "pit",
  "stl": "stl", "cardinals": "stl",

  // NL East
  "atl": "atl", "braves": "atl",
  "mia": "mia", "fla": "mia", "marlins": "mia",
  "nym": "nym", "nyn": "nym", "mets": "nym",
  "phi": "phi", "phl": "phi", "phillies": "phi",
  "wsh": "wsh", "was": "wsh", "wsn": "wsh", "nationals": "wsh",

  // AL West
  "hou": "hou", "astros": "hou",
  "laa": "laa", "ana": "laa", "angels": "laa",
  "oak": "oak", "athletics": "oak",
  "sea": "sea", "mariners": "sea",
  "tex": "tex", "rangers": "tex",

  // AL Central
  "chw": "chw", "cws": "chw", "cha": "chw", "white sox": "chw",
  "cle": "cle", "guardians": "cle",
  "det": "det", "tigers": "det",
  "kc": "kc", "kcr": "kc", "royals": "kc",
  "min": "min", "twins": "min",

  // AL East
  "bal": "bal", "orioles": "bal",
  "bos": "bos", "red sox": "bos",
  "nyy": "nyy", "nya": "nyy", "yankees": "nyy",
  "tor": "tor", "blue jays": "tor",
  "tb":  "tb",  "tba": "tb",  "tam": "tb", "rays": "tb",
};

function abbrCandidates(raw?: string | null) {
  const a = (raw || "").toString().trim().toLowerCase();
  if (!a) return ["_default"];
  const canon = CANONICAL_MAP[a];
  const list = new Set<string>();

  // 1) Best guess via canonical mapping
  if (canon) list.add(canon);

  // 2) Common transforms (handle sfg->sf, sdp->sd, nya->nyy, lan->lad, was->wsh)
  if (!canon) {
    if (a === "sfg") list.add("sf");
    if (a === "sdp") list.add("sd");
    if (a === "nya") list.add("nyy");
    if (a === "nyn") list.add("nym");
    if (a === "lan") list.add("lad");
    if (a === "was") list.add("wsh");
  }

  // 3) Try the raw abbr itself
  list.add(a);

  // 4) Strip a trailing letter if 3-char and last char in {a,g,p} (e.g., sfg->sf, sdp->sd, nya->ny)
  if (a.length === 3 && /[agp]$/.test(a)) list.add(a.slice(0, 2));

  // 5) Last resort default
  list.add("_default");

  return Array.from(list);
}

export default function TeamLogo({
  abbr,
  size = 20,
  className = "",
  title,
}: { abbr?: string | null; size?: number; className?: string; title?: string }) {
  const candidates = useMemo(() => abbrCandidates(abbr), [abbr]);
  const [idx, setIdx] = useState(0);
  const key = candidates[Math.min(idx, candidates.length - 1)];
  const src = `/logos/${key}.png`;

  return (
    <Image
      src={src}
      alt={(abbr || key || "team").toUpperCase()}
      width={size}
      height={size}
      title={title || (abbr || key).toUpperCase()}
      className={`inline-block align-middle ${className}`}
      onError={() => setIdx((i) => Math.min(i + 1, candidates.length - 1))}
    />
  );
}
