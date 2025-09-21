// components/HeadshotImg.tsx
"use client";

import Image from "next/image";
import { useMemo } from "react";

type Props = {
  fullName: string;
  className?: string;
  width?: number;
  height?: number;
};

function slugifyName(n: string) {
  return (n || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

export default function HeadshotImg({ fullName, className, width = 28, height = 28 }: Props) {
  const nameSlug = useMemo(() => slugifyName(fullName), [fullName]);

  // Try headshots2 → headshots → default avatar
  const candidates = [
    `/headshots2/${nameSlug}.png`,
    `/headshots2/${nameSlug}.jpg`,
    `/headshots/${nameSlug}.png`,
    `/headshots/${nameSlug}.jpg`,
    `/_default.avif`,
  ];

  // Let <Image> attempt the first; if it 404s, it’ll still render nicely (we don’t have onError here).
  return (
    <Image
      alt={fullName}
      src={candidates[0]}
      onError={(e: any) => {
        if (e?.currentTarget) e.currentTarget.src = candidates[1] ?? candidates[2] ?? candidates[3] ?? candidates[4];
      }}
      className={className}
      width={width}
      height={height}
    />
  );
}
