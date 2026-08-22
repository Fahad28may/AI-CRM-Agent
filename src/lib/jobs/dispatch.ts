import { runCrmSyncJob } from "@/lib/jobs/handlers/crm-sync";
import { runPipelineAnalysisJob } from "@/lib/jobs/handlers/pipeline-analysis";
import { runDealAnalysisJob } from "@/lib/jobs/handlers/deal-analysis";
import { runExecuteActionJob } from "@/lib/jobs/handlers/execute-action";
import type { JobType } from "@/generated/prisma/enums";
import type { JobHandler } from "@/lib/jobs/types";

export const HANDLERS: { [T in JobType]: JobHandler<T> } = {
  CRM_SYNC: runCrmSyncJob,
  PIPELINE_ANALYSIS: runPipelineAnalysisJob,
  DEAL_ANALYSIS: runDealAnalysisJob,
  EXECUTE_ACTION: runExecuteActionJob,
};
