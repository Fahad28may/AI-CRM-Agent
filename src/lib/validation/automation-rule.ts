import { z } from "zod";

export const updateAutomationRuleSchema = z.object({
  thresholdDays: z.number().int().min(1).max(90),
  isActive: z.boolean(),
});
