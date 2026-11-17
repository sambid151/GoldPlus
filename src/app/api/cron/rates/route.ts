import { connection, NextResponse } from "next/server";
import { runIngest } from "@/lib/ingest/ingest";
import { getRateProvider } from "@/lib/providers";
import { getRepository } from "@/lib/repo";
import { isHosted, isLocalHost, isPublishedMode } from "@/lib/runtime";

/**
 * Scheduled ingest. Vercel Cron sends `Authorization: Bearer $CRON_SECRET`.
 * On hosted deployments a missing secret fails closed instead of leaving this open.
 */
export async function GET(request: Request) {
  // Mark the route dynamic before any side effect so `next build` never triggers an ingest.
  await connection();
  // Published (read-only) mode has no store or live source: this endpoint does not exist for visitors.
  if (isPublishedMode()) return new Response("Not found", { status: 404 });

  const secret = process.env.CRON_SECRET;
  if (!secret && isHosted()) {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 500 });
  }
  if (!secret && !isLocalHost(request.headers.get("host"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const outcome = await runIngest({ provider: getRateProvider(), repo: getRepository() });
    return NextResponse.json(outcome, { status: outcome.status === "failed" ? 502 : 200 });
  } catch (e) {
    // Misconfiguration (e.g. bad provider env) surfaces here, not inside runIngest.
    console.error("ingest crashed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ status: "failed", reasons: [e instanceof Error ? e.message : "unknown error"] }, { status: 500 });
  }
}
