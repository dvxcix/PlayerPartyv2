// components/HeadshotImg.tsx
"use client";

import Image from "next/image";
import { headshotSrcFor } from "@/lib/headshots";

type Props = {
  name: string;
  mlbamId?: string | number | null;
  size?: number;
  className?: string;
  title?: string;
};

export function HeadshotImg({ name, mlbamId, size = 20, className = "", title }: Props) {
  const src = headshotSrcFor(name, mlbamId);
  return (
    <Image
      src={src}
      alt={name}
      width={size}
      height={size}
      className={className}
      title={title ?? name}
    />
  );
}

// Also export default so either import style works:
//   import HeadshotImg from "@/components/HeadshotImg"
//   import { HeadshotImg } from "@/components/HeadshotImg"
export default HeadshotImg;
