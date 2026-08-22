import { db } from "@/lib/db";
import { requireWorkspaceMember } from "@/lib/authz";
import { withErrorHandling } from "@/lib/api-handler";
import { jsonError, jsonOk } from "@/lib/api-response";
import { generateFollowUpSchema } from "@/lib/validation/follow-up";
import { generateFollowUp } from "@/lib/ai/service";
import { RecommendationType, RiskLevel } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";

type Params = { params: Promise<{ workspaceId: string; dealId: string }> };

/**
 * Standalone follow-up generation (section 13 / DoD item 9) — on-demand,
 * not tied to a deterministic finding. Deliberately reuses the existing
 * Recommendation → approve/edit/reject → Action/Approval/AuditLog
 * pipeline instead of a parallel one: this just creates a SEND_EMAIL
 * Recommendation, and RecommendationList already knows how to render,
 * edit, and decide it. "Regenerate" is just calling this again after
 * rejecting the previous draft — every draft stays in the audit trail
 * rather than being silently discarded.
 */
export const POST = withErrorHandling(async (request: Request, { params }: Params) => {
  const { workspaceId, dealId } = await params;
  await requireWorkspaceMember(workspaceId);

  const deal = await db.deal.findFirst({ where: { id: dealId, workspaceId } });
  if (!deal) return jsonError("Deal not found", 404);

  const body = await request.json().catch(() => null);
  const { reason } = generateFollowUpSchema.parse(body);

  const draft = await generateFollowUp(dealId, reason);

  const recommendation = await db.recommendation.create({
    data: {
      workspaceId,
      dealId: deal.id,
      type: RecommendationType.SEND_EMAIL,
      targetRecordType: "deal",
      targetRecordId: deal.externalId,
      reasoning: `Follow-up requested: "${reason}"`,
      evidence: [reason] as Prisma.InputJsonValue,
      proposedAction: { type: "SEND_EMAIL", subject: draft.subject, body: draft.body } as Prisma.InputJsonValue,
      confidence: 1,
      riskLevel: RiskLevel.LOW,
    },
  });

  return jsonOk({ recommendation }, 201);
});
