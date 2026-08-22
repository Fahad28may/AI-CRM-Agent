import { db } from "@/lib/db";
import type { StructuredGenerationResult } from "@/lib/ai/client";

/** Records cost/token tracking for one AI call (section 32 — AI costs must be tracked). */
export async function recordAiUsage(
  workspaceId: string,
  operation: string,
  result: StructuredGenerationResult<unknown>,
): Promise<void> {
  await db.aIUsage.create({
    data: {
      workspaceId,
      model: result.modelId,
      operation,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      estimatedCostUsd: result.costUsd,
    },
  });
}
