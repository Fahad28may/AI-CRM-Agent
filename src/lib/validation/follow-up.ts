import { z } from "zod";

export const generateFollowUpSchema = z.object({
  reason: z.string().trim().min(1, "Reason is required").max(500),
});
