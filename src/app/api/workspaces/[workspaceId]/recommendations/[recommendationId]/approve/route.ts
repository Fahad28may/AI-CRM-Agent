import { after } from "next/server";
import { db } from "@/lib/db";
import { requireWorkspaceMember } from "@/lib/authz";
import { withErrorHandling } from "@/lib/api-handler";
import { jsonError, jsonOk } from "@/lib/api-response";
import { approveRecommendationSchema } from "@/lib/validation/recommendation";
import { decideRecommendation, RecommendationAlreadyDecidedError } from "@/lib/actions/decide";
import { ActionStatus, ApprovalDecision, JobType } from "@/generated/prisma/enums";
import { enqueueAndRun } from "@/lib/jobs/run";

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

  let action;
  try {
    action = await decideRecommendation({
      recommendation,
      userId: user.id,
      decision: ApprovalDecision.APPROVED,
      status: ActionStatus.APPROVED,
      payload: finalPayload,
    });
  } catch (error) {
    if (error instanceof RecommendationAlreadyDecidedError) {
      return jsonError(error.message, 400);
    }
    throw error;
  }

  after(() => enqueueAndRun(workspaceId, JobType.EXECUTE_ACTION, { actionId: action.id }));

  return jsonOk({ action }, 202);
});
