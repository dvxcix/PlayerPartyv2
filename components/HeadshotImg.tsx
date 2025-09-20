// components/HeadshotImg.tsx
"use client";

import Image from "next/image";

export default function HeadshotImg({
  name,
  className,
  src,
}: {
  name: string;
  className?: string;
  src?: string;
}) {
  // If you already resolved ID→file elsewhere, pass `src`.
  // Otherwise we default to /_default.avif
  const safeSrc = src ?? "/_default.avif";
  return (
    <Image
      src={safeSrc}
      alt={name}
      width={32}
      height={32}
      className={className}
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).src = "/_default.avif";
      }}
    />
  );
}
