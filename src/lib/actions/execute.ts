import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { getProviderForConnection } from "@/lib/crm/connection";
import { ActionStatus, ActorType, CRMProvider, NotificationType } from "@/generated/prisma/enums";
import type { ProposedAction } from "@/lib/ai/schemas";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Executes one approved Action against the CRM (or email provider). Rule 4
 * (never let AI output execute privileged actions directly) is enforced
 * upstream — this only ever runs for an Action a human has already
 * approved via the API routes in
 * src/app/api/workspaces/[workspaceId]/recommendations/[id]/approve.
 *
 * Failures are terminal, not retried: a blind automatic retry of a
 * side-effecting call (send another email, create a duplicate task) is
 * worse than surfacing the failure once via ACTION_FAILED notification and
 * letting a human decide whether to re-approve. So this function always
 * resolves — callers (the job handler) never see a rejected promise here.
 */
export async function executeAction(actionId: string): Promise<void> {
  const action = await db.action.findUniqueOrThrow({ where: { id: actionId } });
  if (action.status !== ActionStatus.APPROVED) return;

  await db.action.update({ where: { id: action.id }, data: { status: ActionStatus.EXECUTING } });

  try {
    const { resultSummary, previousState, newState } = await performAction(action);

    await db.action.update({
      where: { id: action.id },
      data: { status: ActionStatus.COMPLETED, resultSummary, executedAt: new Date() },
    });

    await db.auditLog.create({
      data: {
        workspaceId: action.workspaceId,
        actorType: ActorType.SYSTEM,
        action: "action_executed",
        targetType: action.targetRecordType,
        targetId: action.targetRecordId,
        previousState: previousState as Prisma.InputJsonValue,
        newState: newState as Prisma.InputJsonValue,
        actionId: action.id,
        executionResult: { summary: resultSummary } as Prisma.InputJsonValue,
        source: "execution_engine",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    await db.action.update({
      where: { id: action.id },
      data: { status: ActionStatus.FAILED, errorMessage: message, executedAt: new Date() },
    });

    await db.auditLog.create({
      data: {
        workspaceId: action.workspaceId,
        actorType: ActorType.SYSTEM,
        action: "action_execution_failed",
        targetType: action.targetRecordType,
        targetId: action.targetRecordId,
        actionId: action.id,
        errorMessage: message,
        source: "execution_engine",
      },
    });

    await db.notification.create({
      data: {
        workspaceId: action.workspaceId,
        type: NotificationType.ACTION_FAILED,
        title: "An approved action failed to execute",
        body: message,
        relatedType: "action",
        relatedId: action.id,
      },
    });
  }
}

type ExecutionResult = {
  resultSummary: string;
  previousState?: unknown;
  newState?: unknown;
};

async function performAction(action: {
  workspaceId: string;
  type: string;
  targetRecordType: string;
  targetRecordId: string;
  payload: unknown;
}): Promise<ExecutionResult> {
  const payload = action.payload as ProposedAction;

  const connection = await db.cRMConnection.findUnique({
    where: { workspaceId_provider: { workspaceId: action.workspaceId, provider: CRMProvider.HUBSPOT } },
  });
  if (!connection) throw new Error("No connected CRM for this workspace");

  const deal = await db.deal.findFirst({
    where: {
      workspaceId: action.workspaceId,
      crmConnectionId: connection.id,
      externalId: action.targetRecordId,
    },
    include: { contact: true },
  });
  if (!deal) throw new Error(`Deal ${action.targetRecordId} not found`);

  const provider = await getProviderForConnection(connection);

  switch (payload.type) {
    case "SEND_EMAIL": {
      if (!deal.contact?.email) throw new Error("Deal has no contact email on file");
      await sendEmail({
        to: deal.contact.email,
        subject: payload.subject,
        html: payload.body.replace(/\n/g, "<br>"),
      });
      return { resultSummary: `Email sent to ${deal.contact.email}` };
    }

    case "CREATE_TASK": {
      const dueAt = new Date(Date.now() + payload.dueInDays * 24 * 60 * 60 * 1000);
      const created = await provider.createTask({
        subject: payload.subject,
        body: payload.body,
        dueAt,
        associateWithDealExternalId: deal.externalId,
        associateWithContactExternalId: deal.contact?.externalId,
      });
      return { resultSummary: `Task "${payload.subject}" created in HubSpot (id ${created.externalId})` };
    }

    case "UPDATE_FIELD": {
      if (payload.field === "amount") {
        const amount = Number(payload.value);
        if (Number.isNaN(amount)) throw new Error(`Invalid amount: ${payload.value}`);
        const previousState = { amount: deal.amount ? Number(deal.amount) : null };
        await provider.updateDeal(deal.externalId, { amount });
        await db.deal.update({ where: { id: deal.id }, data: { amount } });
        return { resultSummary: `Updated amount to ${amount}`, previousState, newState: { amount } };
      }

      const closeDate = new Date(payload.value);
      if (Number.isNaN(closeDate.getTime())) throw new Error(`Invalid closeDate: ${payload.value}`);
      const previousState = { closeDate: deal.closeDate };
      await provider.updateDeal(deal.externalId, { closeDate });
      await db.deal.update({ where: { id: deal.id }, data: { closeDate } });
      return {
        resultSummary: `Updated closeDate to ${payload.value}`,
        previousState,
        newState: { closeDate },
      };
    }

    case "CHANGE_STAGE": {
      const previousState = { stage: deal.stage };
      await provider.updateDeal(deal.externalId, { stage: payload.newStage });
      await db.deal.update({
        where: { id: deal.id },
        data: { stage: payload.newStage, stageChangedAt: new Date() },
      });
      return {
        resultSummary: `Deal stage changed to "${payload.newStage}"`,
        previousState,
        newState: { stage: payload.newStage },
      };
    }
  }
}
