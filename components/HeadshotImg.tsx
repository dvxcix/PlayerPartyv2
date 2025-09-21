// components/HeadshotImg.tsx
"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

// ---- map.csv loader ---------------------------------------------------------
// Expect a CSV at /public/map.csv with headers: Name,MLBAMID
// We'll map lowercased normalized name -> MLBAMID
async function loadMap(): Promise<Record<string, string>> {
  const res = await fetch("/map.csv", { cache: "force-cache" });
  const text = await res.text();

  const lines = text.trim().split(/\r?\n/);
  if (!lines.length) return {};

  const header = lines.shift() || "";
  const headers = header.split(",").map((h) => h.trim().toLowerCase());

  const idxName = headers.findIndex((h) => h === "name");
  const idxId = headers.findIndex((h) => h === "mlbamid");

  if (idxName === -1 || idxId === -1) return {};

  const map: Record<string, string> = {};
  for (const line of lines) {
    if (!line.trim()) continue;
    const parts = line.split(",");
    const nm = (parts[idxName] || "").trim();
    const id = (parts[idxId] || "").trim();
    if (!nm || !id) continue;
    map[normName(nm)] = id;
  }
  return map;
}

function normName(s: string) {
  return s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .toLowerCase()
    .trim();
}

// ---- Component --------------------------------------------------------------
// Backward-compatible props: supports both old (fullName, width/height) and new (name, size)
export default function HeadshotImg(props: {
  name?: string;
  fullName?: string;     // alias for name
  size?: number;         // square size
  width?: number;        // alias for size
  height?: number;       // alias for size
  className?: string;
}) {
  const {
    name,
    fullName,
    size,
    width,
    height,
    className = "",
  } = props;

  // Resolve name and pixel size from various aliases
  const resolvedName = (fullName ?? name ?? "").toString();
  const pixelSize = (size ?? width ?? height ?? 24) as number;

  const [src, setSrc] = useState<string>("/logos/_default.png");
  const [tried, setTried] = useState<number>(0);
  const key = useMemo(() => normName(resolvedName), [resolvedName]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const map = await loadMap();
        const id = map[key];
        if (alive && id) {
          // Try headshots2 first (your second thousand)
          setSrc(`/headshots2/${id}.png`);
        } else if (alive) {
          setSrc(`/logos/_default.png`);
        }
      } catch {
        if (alive) setSrc(`/logos/_default.png`);
      }
    })();
    return () => {
      alive = false;
    };
  }, [key]);

  // Fallback chain: headshots2 -> headshots -> default
  function onErr() {
    if (tried === 0 && src.includes("/headshots2/")) {
      setSrc(src.replace("/headshots2/", "/headshots/"));
      setTried(1);
      return;
    }
    if (tried === 1) {
      setSrc("/logos/_default.png");
      setTried(2);
      return;
    }
  }

  return (
    <Image
      src={src}
      alt={resolvedName || "player"}
      width={pixelSize}
      height={pixelSize}
      className={`inline-block align-middle rounded-full ${className}`}
      onError={onErr}
    />
  );
}
