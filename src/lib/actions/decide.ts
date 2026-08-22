import { db } from "@/lib/db";
import { ActorType } from "@/generated/prisma/enums";
import { Prisma } from "@/generated/prisma/client";
import type { ActionStatus, ApprovalDecision } from "@/generated/prisma/enums";
import type { Action, Recommendation } from "@/generated/prisma/client";

export class RecommendationAlreadyDecidedError extends Error {
  constructor() {
    super("This recommendation has already been decided");
  }
}

/**
 * Creates the Action/Approval/AuditLog trail for one decision on a
 * recommendation, atomically. The `Action.recommendationId` unique
 * constraint (see prisma/schema.prisma) is what actually makes this
 * race-safe — two concurrent decisions on the same recommendation will
 * have one `action.create` succeed and the other hit a P2002 inside this
 * transaction, which we translate into RecommendationAlreadyDecidedError.
 * A findFirst pre-check in the caller handles the common (non-race) case
 * with a cheap early return; this is the authoritative guard.
 */
export async function decideRecommendation({
  recommendation,
  userId,
  decision,
  status,
  payload,
  notes,
}: {
  recommendation: Recommendation;
  userId: string;
  decision: ApprovalDecision;
  status: ActionStatus;
  payload: unknown;
  notes?: string;
}): Promise<Action> {
  try {
    return await db.$transaction(async (tx) => {
      const action = await tx.action.create({
        data: {
          workspaceId: recommendation.workspaceId,
          recommendationId: recommendation.id,
          type: recommendation.type,
          targetRecordType: recommendation.targetRecordType,
          targetRecordId: recommendation.targetRecordId,
          payload: payload as Prisma.InputJsonValue,
          status,
        },
      });

      await tx.approval.create({
        data: {
          workspaceId: recommendation.workspaceId,
          actionId: action.id,
          userId,
          decision,
          notes,
        },
      });

      await tx.auditLog.create({
        data: {
          workspaceId: recommendation.workspaceId,
          userId,
          actorType: ActorType.USER,
          action: decision === "APPROVED" ? "recommendation_approved" : "recommendation_rejected",
          targetType: recommendation.targetRecordType,
          targetId: recommendation.targetRecordId,
          actionId: action.id,
          source: "api",
        },
      });

      return action;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new RecommendationAlreadyDecidedError();
    }
    throw error;
  }
}
