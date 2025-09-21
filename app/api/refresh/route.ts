// app/api/refresh/route.ts
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// If you want to lock this down, set REFRESH_TOKEN in Vercel.
// Then call with header x-refresh-token or ?token=...
function checkAuth(req: NextRequest) {
  const secret = process.env.REFRESH_TOKEN;
  if (!secret) return true;
  const header = req.headers.get("x-refresh-token");
  const token = header || new URL(req.url).searchParams.get("token");
  return token === secret;
}

// Adjust these if your cron endpoints use different paths.
const JOB_PATHS = [
  "/api/cron/events",
  "/api/cron/participants",
  "/api/cron/odds",
  "/api/cron/cleanup",
];

async function runJob(origin: string, path: string) {
  const url = new URL(path, origin).toString();
  try {
    // Most cron routes are GET; if yours are POST, swap method.
    const res = await fetch(url, { method: "GET", cache: "no-store", headers: { "x-internal": "1" } });
    const text = await res.text();
    let body: any;
    try { body = JSON.parse(text); } catch { body = { raw: text }; }
    return { path, ok: res.ok, status: res.status, body };
  } catch (e: any) {
    return { path, ok: false, status: 0, error: String(e?.message ?? e) };
  }
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const origin = new URL(req.url).origin;
  const results = [];
  for (const p of JOB_PATHS) results.push(await runJob(origin, p));
  const ok = results.every((r) => r.ok);
  return NextResponse.json({ ok, results });
}

// Allow GET too so you can hit it from the browser if desired.
export const GET = POST;
