// components/RefreshButton.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type JobResult = { path: string; ok: boolean; status?: number; error?: string; body?: any };

export default function RefreshButton({
  showLog = true,
  token, // optional: pass REFRESH_TOKEN here if you enabled it
}: { showLog?: boolean; token?: string }) {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<JobResult[]>([]);
  const router = useRouter();

  async function run() {
    setLoading(true);
    setResults([]);
    try {
      const res = await fetch("/api/refresh", {
        method: "POST",
        cache: "no-store",
        headers: token ? { "x-refresh-token": token } : {},
      });
      const json = await res.json();
      setResults(json.results || []);
    } catch (e: any) {
      setResults([{ path: "/api/refresh", ok: false, status: 0, error: String(e?.message ?? e) }]);
    } finally {
      setLoading(false);
      // Force client components that fetch with no-store to re-run; also refresh any RSC.
      router.refresh();
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={run}
        disabled={loading}
        className="px-3 py-2 rounded-lg border bg-white hover:bg-gray-50 disabled:opacity-60"
        title="Run events, participants, odds, cleanup now"
      >
        {loading ? "Refreshing…" : "Refresh Today (Events + Participants + Odds)"}
      </button>

      {showLog && results.length > 0 && (
        <div className="text-xs text-gray-600 border rounded-md p-2 bg-gray-50">
          {results.map((r, i) => (
            <div key={i}>
              {r.ok ? "✅" : "❌"} {r.path} {r.status ? `(${r.status})` : ""}{" "}
              {r.error ? `– ${r.error}` : r.body?.error ? `– ${r.body.error}` : ""}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
