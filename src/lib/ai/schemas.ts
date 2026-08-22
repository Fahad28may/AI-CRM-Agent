import { z } from "zod";

/**
 * Structured AI outputs (section 9/10 of the master prompt — never let raw
 * model output execute anything; everything comes back through a schema).
 * `proposedAction` is deliberately restricted to action types the app can
 * actually execute later via `CRMProvider` (see src/lib/crm/types.ts):
 * SEND_EMAIL, CREATE_TASK, UPDATE_FIELD (amount/closeDate), CHANGE_STAGE.
 * ADD_NOTE/ASSIGN_OWNER/SCHEDULE_FOLLOWUP have no execution path yet, so
 * the AI is never given the option to propose them.
 */
export const ProposedActionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("SEND_EMAIL"),
    subject: z.string().describe("Email subject line"),
    body: z.string().describe("Plain-text email body, ready to review and send"),
  }),
  z.object({
    type: z.literal("CREATE_TASK"),
    subject: z.string().describe("Short task title"),
    body: z.string().optional().describe("Task details/instructions"),
    dueInDays: z.number().int().min(0).max(30).describe("Days from now the task should be due"),
  }),
  z.object({
    type: z.literal("UPDATE_FIELD"),
    field: z.enum(["amount", "closeDate"]),
    value: z.string().describe('New value as a string; for closeDate use "YYYY-MM-DD"'),
  }),
  z.object({
    type: z.literal("CHANGE_STAGE"),
    newStage: z.string().describe("The stage name to move the deal to"),
  }),
]);

export const RecommendationOutputSchema = z.object({
  whatHappened: z.string().describe("Plain-language explanation of the situation on this deal"),
  whyItMatters: z.string().describe("Why this is worth the rep's attention"),
  evidence: z
    .array(z.string())
    .min(1)
    .describe("Specific, concrete evidence points drawn only from the CRM data provided"),
  proposedAction: ProposedActionSchema,
  confidence: z.number().min(0).max(1),
  riskLevel: z.enum(["LOW", "MEDIUM", "HIGH"]),
});
export type RecommendationOutput = z.infer<typeof RecommendationOutputSchema>;
export type ProposedAction = z.infer<typeof ProposedActionSchema>;

export const FollowUpEmailSchema = z.object({
  subject: z.string(),
  body: z.string(),
});
export type FollowUpEmailOutput = z.infer<typeof FollowUpEmailSchema>;

export const ActivitySummarySchema = z.object({
  summary: z.string().describe("A concise narrative summary of the recent activity"),
});
export type ActivitySummaryOutput = z.infer<typeof ActivitySummarySchema>;
