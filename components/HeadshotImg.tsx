// components/HeadshotImg.tsx
"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { buildHeadshotCandidates, getIdForName } from "@/lib/headshots";

type Props = {
  fullName: string;
  // Display sizing:
  size?: number; // width & height (square)
  className?: string;
  rounded?: boolean; // rounded-full avatar
  priority?: boolean;
};

export function HeadshotImg({ fullName, size = 28, className = "", rounded = true, priority = false }: Props) {
  const [candidates, setCandidates] = useState<string[]>(["/_default.avif"]);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const id = await getIdForName(fullName);
      const list = buildHeadshotCandidates(id);
      if (!cancelled) {
        setCandidates(list);
        setIdx(0);
      }
    })();
    return () => { cancelled = true; };
  }, [fullName]);

  const src = candidates[Math.min(idx, candidates.length - 1)];
  const radius = rounded ? "rounded-full" : "rounded-md";

  return (
    <Image
      src={src}
      alt={fullName}
      width={size}
      height={size}
      className={`${radius} ${className} object-cover bg-gray-100 border`}
      onError={() => setIdx((i) => Math.min(i + 1, candidates.length - 1))}
      priority={priority}
    />
  );
}
