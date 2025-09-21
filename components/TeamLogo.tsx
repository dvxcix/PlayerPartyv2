// components/TeamLogo.tsx
import Image from "next/image";

export default function TeamLogo({
  abbr,
  size = 20,
  className = "",
}: { abbr: string; size?: number; className?: string }) {
  const src = `/logos/${(abbr || "").toLowerCase()}.png`;
  return (
    <Image
      src={src}
      alt={abbr}
      width={size}
      height={size}
      className={`inline-block align-middle ${className}`}
      onError={(e) => {
        (e.target as HTMLImageElement).src = "/logos/_default.png";
      }}
    />
  );
}
