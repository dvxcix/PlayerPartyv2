// components/HeadshotImg.tsx
"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

type Props = {
  fullName: string;
  className?: string;
  width?: number;
  height?: number;
};

// lazy module-level cache
let nameToId: Record<string, string> | null = null;
let mapLoading: Promise<Record<string, string>> | null = null;

async function loadMap(): Promise<Record<string, string>> {
  if (nameToId) return nameToId;
  if (!mapLoading) {
    mapLoading = fetch("/map.csv", { cache: "reload" })
      .then(async (r) => {
        const text = await r.text();
        const lines = text.split(/\r?\n/).filter((l) => l.trim().length);
        const out: Record<string, string> = {};
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i];
          const [name, id] = line.split(",");
          if (name && id) out[name.trim().toLowerCase()] = id.trim();
        }
        nameToId = out;
        return out;
      })
      .catch(() => (nameToId = {} as any));
  }
  return mapLoading;
}

export default function HeadshotImg({ fullName, className, width = 28, height = 28 }: Props) {
  const [mlbamId, setMlbamId] = useState<string | null>(null);

  useEffect(() => {
    let on = true;
    loadMap().then((map) => {
      const id = map[(fullName || "").toLowerCase()] || null;
      if (on) setMlbamId(id);
    });
    return () => { on = false; };
  }, [fullName]);

  const candidates = useMemo(() => {
    const arr: string[] = [];
    if (mlbamId) {
      arr.push(`/headshots2/${mlbamId}.png`);
      arr.push(`/headshots/${mlbamId}.png`);
    }
    // fallback: legacy slug-based files if present
    const slug = (fullName || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "");
    arr.push(`/headshots2/${slug}.png`);
    arr.push(`/headshots/${slug}.png`);
    arr.push(`/logos/_default.png`);
    return arr;
  }, [mlbamId, fullName]);

  return (
    <Image
      alt={fullName}
      src={candidates[0]}
      onError={(e: any) => {
        if (e?.currentTarget) {
          const el = e.currentTarget as HTMLImageElement;
          // rotate through candidates until one loads
          const idx = candidates.indexOf(el.src.replace(window.location.origin, ""));
          const next = candidates[idx + 1] ?? candidates[candidates.length - 1];
          el.src = next;
        }
      }}
      className={className}
      width={width}
      height={height}
    />
  );
}
