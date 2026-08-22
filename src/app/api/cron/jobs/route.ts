import { timingSafeEqual } from "crypto";
import { jsonError, jsonOk } from "@/lib/api-response";
import { runDueJobs } from "@/lib/jobs/run";

/**
 * Safety-net sweep for the job queue. Most jobs run inline via `after()`
 * right when they're enqueued (see the HubSpot callback and manual sync
 * routes) — this only picks up what that path missed: a crashed/timed-out
 * invocation, or a job that's mid-retry backoff. Point a scheduler (e.g.
 * Vercel Cron) at this route with an `Authorization: Bearer <CRON_SECRET>`
 * header.
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

  const processed = await runDueJobs();
  return jsonOk({ processed });
}
