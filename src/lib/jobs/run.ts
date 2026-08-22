import { db } from "@/lib/db";
import { HANDLERS } from "@/lib/jobs/dispatch";
import { claimJob, completeJob, enqueueJob, failJob, listDueJobIds } from "@/lib/jobs/queue";
import { findFindingsNeedingRecommendation } from "@/lib/ai/service";
import { CRMConnectionStatus, JobType, NotificationType } from "@/generated/prisma/enums";
import type { Job } from "@/generated/prisma/client";
import type { JobPayloadMap } from "@/lib/jobs/types";

// Section 17/Phase 7 "scheduled analysis": deals can cross a staleness/
// stagnation threshold purely because time passed, with no new CRM
// activity to trigger a sync. Once a day per connected workspace is
// plenty for day-granularity thresholds and keeps this cheap.
const SCHEDULED_SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000;

// Bounds how many AI recommendation calls happen inline (blocking the
// after() continuation that triggered them) per pipeline analysis run —
// keeps onboarding/sync responsive and cost-bounded per request. Anything
// beyond this is still enqueued, just left PENDING for the cron sweep
// (see /api/cron/jobs) to pick up instead of running synchronously here.
const MAX_INLINE_RECOMMENDATIONS_PER_RUN = 10;

/**
 * Claims and executes one job. Safe to call concurrently for the same
 * jobId (e.g. the inline `after()` run racing the cron sweep) — the
 * atomic claim in `claimJob` means only one caller actually runs it.
 */
export async function runJob(jobId: string): Promise<void> {
  const job = await claimJob(jobId);
  if (!job) return;

  try {
    // Each handler's payload type is guaranteed to match its job type by
    // construction (enqueueJob is generic over JobType); indexing HANDLERS
    // with the runtime `job.type` loses that per-branch link statically,
    // so this cast just restores what's already true at runtime.
    const handler = HANDLERS[job.type] as (payload: unknown) => Promise<void>;
    await handler(job.payload);
    await completeJob(job.id);

    // A sync just landed fresh data — re-run pipeline analysis so findings
    // reflect it, without the caller having to know that indirection exists.
    if (job.type === JobType.CRM_SYNC) {
      await enqueueAndRun(job.workspaceId, JobType.PIPELINE_ANALYSIS, {
        workspaceId: job.workspaceId,
      });
    }

    // Fresh/changed findings need AI recommendations. Run the highest-
    // severity ones inline for immediate feedback; the rest are enqueued
    // PENDING for the cron sweep, not run here, so a workspace with a lot
    // of open findings can't turn one sync into dozens of sequential paid
    // AI calls inside a single request.
    if (job.type === JobType.PIPELINE_ANALYSIS) {
      const findingIds = await findFindingsNeedingRecommendation(job.workspaceId, 100);
      const inline = findingIds.slice(0, MAX_INLINE_RECOMMENDATIONS_PER_RUN);
      const deferred = findingIds.slice(MAX_INLINE_RECOMMENDATIONS_PER_RUN);

      for (const findingId of inline) {
        await enqueueAndRun(job.workspaceId, JobType.DEAL_ANALYSIS, { findingId });
      }
      for (const findingId of deferred) {
        await enqueueJob(job.workspaceId, JobType.DEAL_ANALYSIS, { findingId });
      }
    }
  } catch (error) {
    const { terminal } = await failJob(job, error);
    if (terminal) {
      await notifyTerminalFailure(job, error);
    }
  }
}

/**
 * Surfaces a job's terminal failure (retries exhausted) as a
 * Notification. Every job type gets one — a DEAL_ANALYSIS job that
 * silently exhausts its retries (e.g. the AI provider is down or
 * rate-limited past the retry window) would otherwise leave a Finding
 * stuck OPEN with no recommendation and zero explanation of why,
 * violating rule 7 (every important AI action must be explainable).
 * EXECUTE_ACTION is exhaustively listed but never reaches here — see
 * src/lib/actions/execute.ts, which handles and notifies its own
 * failures without rethrowing.
 */
async function notifyTerminalFailure(job: Job, error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : "Job failed";

  switch (job.type) {
    case JobType.CRM_SYNC:
      await db.notification.create({
        data: {
          workspaceId: job.workspaceId,
          type: NotificationType.SYNC_FAILURE,
          title: "HubSpot sync failed",
          body: message,
        },
      });
      return;

    case JobType.DEAL_ANALYSIS: {
      const { findingId } = job.payload as JobPayloadMap["DEAL_ANALYSIS"];
      const finding = await db.finding.findUnique({
        where: { id: findingId },
        select: { deal: { select: { name: true } } },
      });
      await db.notification.create({
        data: {
          workspaceId: job.workspaceId,
          type: NotificationType.ANALYSIS_FAILED,
          title: `AI analysis failed for ${finding?.deal?.name ?? "a deal"}`,
          body: message,
          relatedType: "finding",
          relatedId: findingId,
        },
      });
      return;
    }

    case JobType.PIPELINE_ANALYSIS:
      await db.notification.create({
        data: {
          workspaceId: job.workspaceId,
          type: NotificationType.ANALYSIS_FAILED,
          title: "Pipeline analysis failed",
          body: message,
        },
      });
      return;

    case JobType.EXECUTE_ACTION:
      return;
  }
}

/** Enqueues (or reuses a pending/running) job and runs it inline in the same tick. */
export async function enqueueAndRun<T extends JobType>(
  workspaceId: string,
  type: T,
  payload: JobPayloadMap[T],
): Promise<void> {
  const job = await enqueueJob(workspaceId, type, payload);
  await runJob(job.id);
}

/** Processes up to `limit` due jobs — the cron-triggered safety net for retries. */
export async function runDueJobs(limit = 20): Promise<number> {
  const ids = await listDueJobIds(limit);
  for (const id of ids) {
    await runJob(id);
  }
  return ids.length;
}

/**
 * Enqueues a CRM_SYNC for every connected workspace that hasn't synced
 * recently — CRM_SYNC already cascades into PIPELINE_ANALYSIS and
 * DEAL_ANALYSIS once it completes (see runJob above), so this single
 * enqueue is what turns "time passed" into fresh findings and
 * recommendations without anyone clicking "Sync now". Called from the
 * cron sweep, not run inline, since it fans out across every workspace.
 */
export async function scheduleDueAnalysis(): Promise<number> {
  const cutoff = new Date(Date.now() - SCHEDULED_SYNC_INTERVAL_MS);
  const connections = await db.cRMConnection.findMany({
    where: {
      status: CRMConnectionStatus.CONNECTED,
      OR: [{ lastSyncedAt: null }, { lastSyncedAt: { lt: cutoff } }],
    },
    select: { id: true, workspaceId: true },
  });

  for (const connection of connections) {
    await enqueueJob(connection.workspaceId, JobType.CRM_SYNC, { connectionId: connection.id });
  }
  return connections.length;
}
