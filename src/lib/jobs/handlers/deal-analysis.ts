import { generateRecommendation } from "@/lib/ai/service";
import type { JobHandler } from "@/lib/jobs/types";

export const runDealAnalysisJob: JobHandler<"DEAL_ANALYSIS"> = async (payload) => {
  await generateRecommendation(payload.findingId);
};
