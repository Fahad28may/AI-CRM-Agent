import { z } from "zod";
import { ProposedActionSchema } from "@/lib/ai/schemas";

/** Approve accepts an optional edited action — the "Edit" step in section 15 of the master prompt. */
export const approveRecommendationSchema = z.object({
  proposedAction: ProposedActionSchema.optional(),
});

export const rejectRecommendationSchema = z.object({
  notes: z.string().trim().max(2000).optional(),
});
