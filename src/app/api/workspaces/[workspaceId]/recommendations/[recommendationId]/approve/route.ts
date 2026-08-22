import { after } from "next/server";
import { db } from "@/lib/db";
import { requireWorkspaceMember } from "@/lib/authz";
import { withErrorHandling } from "@/lib/api-handler";
import { jsonError, jsonOk } from "@/lib/api-response";
import { approveRecommendationSchema } from "@/lib/validation/recommendation";
import { ActionStatus, ActorType, ApprovalDecision, JobType } from "@/generated/prisma/enums";
import { enqueueAndRun } from "@/lib/jobs/run";
import type { Prisma } from "@/generated/prisma/client";

type Params = { params: Promise<{ workspaceId: string; recommendationId: string }> };

export const POST = withErrorHandling(async (request: Request, { params }: Params) => {
  const { workspaceId, recommendationId } = await params;
  const { user } = await requireWorkspaceMember(workspaceId);

  const recommendation = await db.recommendation.findFirst({
    where: { id: recommendationId, workspaceId },
    include: { actions: true },
  });
  if (!recommendation) return jsonError("Recommendation not found", 404);
  if (recommendation.actions.length > 0) {
    return jsonError("This recommendation has already been decided", 400);
  }

  const body = await request.json().catch(() => ({}));
  const { proposedAction } = approveRecommendationSchema.parse(body);
  if (proposedAction && proposedAction.type !== recommendation.type) {
    return jsonError("Edited action type must match the recommendation type", 400);
  }
  const finalPayload = proposedAction ?? recommendation.proposedAction;

  const action = await db.action.create({
    data: {
      workspaceId,
      recommendationId: recommendation.id,
      type: recommendation.type,
      targetRecordType: recommendation.targetRecordType,
      targetRecordId: recommendation.targetRecordId,
      payload: finalPayload as Prisma.InputJsonValue,
      status: ActionStatus.APPROVED,
    },
  });

  await db.approval.create({
    data: {
      workspaceId,
      actionId: action.id,
      userId: user.id,
      decision: ApprovalDecision.APPROVED,
    },
  });

  await db.auditLog.create({
    data: {
      workspaceId,
      userId: user.id,
      actorType: ActorType.USER,
      action: "recommendation_approved",
      targetType: recommendation.targetRecordType,
      targetId: recommendation.targetRecordId,
      actionId: action.id,
      source: "api",
    },
  });

  after(() => enqueueAndRun(workspaceId, JobType.EXECUTE_ACTION, { actionId: action.id }));

  return jsonOk({ action }, 202);
});
