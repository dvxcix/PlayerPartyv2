// components/BookBadge.tsx
import Image from "next/image";

type BookKey = "fanduel" | "betmgm";

function normalizeBook(book: string): BookKey {
  const k = (book || "").toLowerCase().replace(/[\s._-]/g, "");
  if (k === "fd" || k.includes("fanduel")) return "fanduel";
  if (k === "mgm" || k.includes("betmgm") || k.includes("mgmresorts")) return "betmgm";
  // default gracefully
  return "fanduel";
}

export default function BookBadge({ book }: { book: string }) {
  const b = normalizeBook(book);
  const src = b === "fanduel" ? "/logos/FD.png" : "/logos/MGM.png";
  const alt = b === "fanduel" ? "FanDuel" : "BetMGM";
  return (
    <span className="inline-flex items-center gap-1 align-middle">
      <Image src={src} alt={alt} width={16} height={16} />
      <span className="text-xs">{alt}</span>
    </span>
  );
}
