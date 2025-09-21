import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "MLB Odds Dashboard",
  description: "Compare FanDuel vs BetMGM odds for MLB player home runs.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
