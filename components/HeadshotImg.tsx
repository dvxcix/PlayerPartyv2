// components/HeadshotImg.tsx
"use client";

import Image from "next/image";
import { headshotSrcFor } from "@/lib/headshots";

export default function HeadshotImg({
  fullName,
  className,
}: {
  fullName: string;
  className?: string;
}) {
  const src = headshotSrcFor(fullName);
  return (
    <Image
      src={src}
      alt={fullName}
      width={40}
      height={40}
      className={className}
      onError={(e) => {
        const img = e.target as HTMLImageElement;
        if (!img?.src?.includes("_default.avif")) {
          img.src = "/_default.avif";
        }
      }}
    />
  );
}
