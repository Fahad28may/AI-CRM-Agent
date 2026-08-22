import { db } from "@/lib/db";
import { JobStatus } from "@/generated/prisma/enums";
import { computeRetryDelayMs } from "@/lib/jobs/backoff";
import type { JobType } from "@/generated/prisma/enums";
import type { Job } from "@/generated/prisma/client";
import type { JobPayloadMap } from "@/lib/jobs/types";

export { computeRetryDelayMs };

/**
 * Creates a job, or returns the existing one if an identical (same type,
 * same payload) job is already pending/running for this workspace — a
 * double-click on "Sync now", or an overlapping trigger, shouldn't stack
 * up duplicate runs. Matching on payload (not just type) matters for
 * fan-out job types like DEAL_ANALYSIS, where many jobs of the same type
 * legitimately run concurrently for different findings.
 */
export async function enqueueJob<T extends JobType>(
  workspaceId: string,
  type: T,
  payload: JobPayloadMap[T],
): Promise<Job> {
  const existing = await db.job.findFirst({
    where: {
      workspaceId,
      type,
      status: { in: [JobStatus.PENDING, JobStatus.RUNNING] },
      payload: { equals: payload as object },
    },
  });
  if (existing) return existing;

  return db.job.create({
    data: { workspaceId, type, payload: payload as object },
  });
}

/** Atomically transitions a PENDING job to RUNNING. Returns null if another runner already claimed it. */
export async function claimJob(jobId: string): Promise<Job | null> {
  const result = await db.job.updateMany({
    where: { id: jobId, status: JobStatus.PENDING },
    data: { status: JobStatus.RUNNING, startedAt: new Date(), attempts: { increment: 1 } },
  });
  if (result.count === 0) return null;
  return db.job.findUniqueOrThrow({ where: { id: jobId } });
}

export async function completeJob(jobId: string): Promise<void> {
  await db.job.update({
    where: { id: jobId },
    data: { status: JobStatus.COMPLETED, completedAt: new Date(), lastError: null },
  });
}

/**
 * Records a failed attempt. Reschedules with exponential backoff while
 * attempts remain, otherwise marks the job terminally FAILED. Returns
 * whether this was the terminal failure, so callers can decide whether to
 * surface it (e.g. a user-facing notification) instead of waiting silently.
 */
export async function failJob(job: Job, error: unknown): Promise<{ terminal: boolean }> {
  const message = error instanceof Error ? error.message : String(error);

  if (job.attempts < job.maxAttempts) {
    const delayMs = computeRetryDelayMs(job.attempts);
    await db.job.update({
      where: { id: job.id },
      data: { status: JobStatus.PENDING, runAt: new Date(Date.now() + delayMs), lastError: message },
    });
    return { terminal: false };
  }

  await db.job.update({
    where: { id: job.id },
    data: { status: JobStatus.FAILED, completedAt: new Date(), lastError: message },
  });
  return { terminal: true };
}

/** PENDING jobs whose runAt has arrived — candidates for the cron sweep. */
export async function listDueJobIds(limit: number): Promise<string[]> {
  const jobs = await db.job.findMany({
    where: { status: JobStatus.PENDING, runAt: { lte: new Date() } },
    orderBy: { runAt: "asc" },
    take: limit,
    select: { id: true },
  });
  return jobs.map((j) => j.id);
}
