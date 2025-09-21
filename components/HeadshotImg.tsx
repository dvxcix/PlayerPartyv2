// components/HeadshotImg.tsx
"use client";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

// map.csv => columns: Name,MLBAMID (header case-insensitive OK)
async function loadMap(): Promise<Record<string, string>> {
  const res = await fetch("/map.csv", { cache: "force-cache" });
  const text = await res.text();
  const lines = text.trim().split(/\r?\n/);
  const header = lines.shift() || "";
  const idxName = header.split(",").findIndex(h => h.trim().toLowerCase() === "name");
  const idxId = header.split(",").findIndex(h => h.trim().toLowerCase() === "mlbamid");
  const map: Record<string, string> = {};
  for (const line of lines) {
    const parts = line.split(",");
    const nm = (parts[idxName] || "").trim().toLowerCase();
    const id = (parts[idxId] || "").trim();
    if (nm && id) map[nm] = id;
  }
  return map;
}

function normName(s: string) {
  return s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

export default function HeadshotImg({
  name,
  size = 24,
  className = "",
}: { name: string; size?: number; className?: string }) {
  const [src, setSrc] = useState<string>("/logos/_default.png");
  const [tried, setTried] = useState<number>(0);
  const key = useMemo(() => normName(name), [name]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const map = await loadMap();
        const id = map[key];
        if (alive && id) setSrc(`/headshots2/${id}.png`);
        else if (alive) setSrc(`/logos/_default.png`);
      } catch {
        if (alive) setSrc(`/logos/_default.png`);
      }
    })();
    return () => { alive = false; };
  }, [key]);

  function onErr(e: any) {
    if (tried === 0) { setSrc(src.replace("/headshots2/", "/headshots/")); setTried(1); return; }
    if (tried === 1) { setSrc("/logos/_default.png"); setTried(2); return; }
  }

  return (
    <Image
      src={src}
      alt={name}
      width={size}
      height={size}
      className={`inline-block align-middle rounded-full ${className}`}
      onError={onErr}
    />
  );
}
