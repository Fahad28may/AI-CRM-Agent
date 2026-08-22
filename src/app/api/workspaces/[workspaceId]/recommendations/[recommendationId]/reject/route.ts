import { db } from "@/lib/db";
import { requireWorkspaceMember } from "@/lib/authz";
import { withErrorHandling } from "@/lib/api-handler";
import { jsonError, jsonOk } from "@/lib/api-response";
import { rejectRecommendationSchema } from "@/lib/validation/recommendation";
import { decideRecommendation, RecommendationAlreadyDecidedError } from "@/lib/actions/decide";
import { ActionStatus, ApprovalDecision } from "@/generated/prisma/enums";

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
  const { notes } = rejectRecommendationSchema.parse(body);

  try {
    const action = await decideRecommendation({
      recommendation,
      userId: user.id,
      decision: ApprovalDecision.REJECTED,
      status: ActionStatus.REJECTED,
      payload: recommendation.proposedAction,
      notes,
    });
    return jsonOk({ action });
  } catch (error) {
    if (error instanceof RecommendationAlreadyDecidedError) {
      return jsonError(error.message, 400);
    }
    throw error;
  }
});
