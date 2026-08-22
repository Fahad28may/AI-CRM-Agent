import { analyzeWorkspacePipeline } from "@/lib/pipeline/detect";
import type { JobHandler } from "@/lib/jobs/types";

export const runPipelineAnalysisJob: JobHandler<"PIPELINE_ANALYSIS"> = async (payload) => {
  await analyzeWorkspacePipeline(payload.workspaceId);
};
