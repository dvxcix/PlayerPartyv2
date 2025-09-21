// app/api/refresh/route.ts
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Optional protection for THIS refresh endpoint (the button).
 * If REFRESH_TOKEN is set in Vercel, requests must include it either as:
 *   - header: x-refresh-token: <REFRESH_TOKEN>
 *   - query:  /api/refresh?token=<REFRESH_TOKEN>
 */
function allowRefresh(req: NextRequest) {
  const secret = process.env.REFRESH_TOKEN;
  if (!secret) return true;
  const header = req.headers.get("x-refresh-token");
  const token = header || new URL(req.url).searchParams.get("token");
  return token === secret;
}

/**
 * Your cron routes often require either the Vercel cron header
 *   (x-vercel-cron: 1)
 * or a custom bearer token. We'll send BOTH.
 * Set CRON_TOKEN in Vercel (recommended) if your cron routes check Authorization.
 */
const CRON_HEADERS = (): HeadersInit => {
  const h: Record<string, string> = {
    "x-vercel-cron": "1",            // mimics scheduled runs
    "cache-control": "no-store",
  };
  const token = process.env.CRON_TOKEN;
  if (token) h["authorization"] = `Bearer ${token}`;
  return h;
};

// Order matters if your jobs depend on one another.
const JOBS: Array<{ path: string; prefer: "POST" | "GET" }> = [
  { path: "/api/cron/events",        prefer: "POST" },
  { path: "/api/cron/participants",  prefer: "POST" },
  { path: "/api/cron/odds",          prefer: "POST" },
  { path: "/api/cron/cleanup",       prefer: "POST" },
];

async function runJob(origin: string, job: { path: string; prefer: "POST" | "GET" }) {
  const url = new URL(job.path, origin).toString();
  const headers = CRON_HEADERS();

  // Try preferred method first
  let res = await fetch(url, { method: job.prefer, headers });
  // Fallback if route only supports the other verb
  if (res.status === 405) {
    res = await fetch(url, { method: job.prefer === "POST" ? "GET" : "POST", headers });
  }
  const status = res.status;
  let body: any;
  try {
    body = await res.json();
  } catch {
    body = { raw: await res.text() };
  }
  return { path: job.path, ok: res.ok, status, body };
}

async function handler(req: NextRequest) {
  if (!allowRefresh(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const origin = new URL(req.url).origin;

  const results = [];
  for (const job of JOBS) {
    // Run sequentially to keep order deterministic
    // (change to Promise.all if jobs are independent)
    results.push(await runJob(origin, job));
  }
  const ok = results.every(r => r.ok);
  return NextResponse.json({ ok, results });
}

export const POST = handler;
export const GET  = handler;
