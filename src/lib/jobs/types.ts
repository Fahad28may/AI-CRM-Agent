import type { JobType } from "@/generated/prisma/enums";

/** Payload shape required to run each job type — keeps handlers and callers in sync. */
export type JobPayloadMap = {
  CRM_SYNC: { connectionId: string };
  PIPELINE_ANALYSIS: { workspaceId: string };
  DEAL_ANALYSIS: { findingId: string };
  EXECUTE_ACTION: { actionId: string };
};

export type JobHandler<T extends JobType> = (payload: JobPayloadMap[T]) => Promise<void>;
