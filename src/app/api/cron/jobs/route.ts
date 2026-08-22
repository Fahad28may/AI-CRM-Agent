import { timingSafeEqual } from "crypto";
import { jsonError, jsonOk } from "@/lib/api-response";
import { runDueJobs, scheduleDueAnalysis } from "@/lib/jobs/run";

/**
 * Two jobs in one sweep, both meant to be safety nets rather than the
 * primary path:
 *  1. Retry queue: most jobs run inline via `after()` right when they're
 *     enqueued (see the HubSpot callback and manual sync routes) — this
 *     picks up what that path missed (a crashed/timed-out invocation, or
 *     a job mid-retry backoff).
 *  2. Scheduled analysis (section 17/Phase 7): re-syncs any connected
 *     workspace that hasn't synced in the last day, so deals that cross a
 *     staleness/stagnation threshold purely from time passing still get
 *     re-flagged even if nobody clicks "Sync now".
 * Point a scheduler (e.g. Vercel Cron) at this route with an
 * `Authorization: Bearer <CRON_SECRET>` header — no schedule is wired up
 * by default.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return jsonError("CRON_SECRET is not configured", 500);

  const provided = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  const expected = Buffer.from(secret);
  const actual = Buffer.from(provided);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return jsonError("Unauthorized", 401);
  }

  const scheduled = await scheduleDueAnalysis();
  const processed = await runDueJobs();
  return jsonOk({ scheduled, processed });
}
