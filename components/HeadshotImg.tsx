// components/HeadshotImg.tsx
"use client";

type Props = {
  fullName: string;
  className?: string;
  width?: number;
  height?: number;
};

/**
 * Lightweight headshot helper:
 * - Looks for /public/headshots2/<slug>.png (you already have these)
 * - Falls back to /miscimg/_default.avif on error
 */
export default function HeadshotImg({
  fullName,
  className,
  width = 24,
  height = 24,
}: Props) {
  const slug = fullName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  const src = `/headshots2/${slug}.png`;

  return (
    // Using <img> to keep it simple and avoid Image domain/config issues
    <img
      src={src}
      alt={fullName}
      className={className}
      width={width}
      height={height}
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).src = "/miscimg/_default.avif";
      }}
    />
  );
}
