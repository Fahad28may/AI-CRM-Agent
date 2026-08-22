import { after } from "next/server";
import { db } from "@/lib/db";
import { requireWorkspaceMember } from "@/lib/authz";
import { withErrorHandling } from "@/lib/api-handler";
import { jsonError, jsonOk } from "@/lib/api-response";
import { CRMProvider, JobType, WorkspaceRole } from "@/generated/prisma/enums";
import { enqueueAndRun } from "@/lib/jobs/run";

type Params = { params: Promise<{ workspaceId: string }> };

export const POST = withErrorHandling(async (_request: Request, { params }: Params) => {
  const { workspaceId } = await params;
  await requireWorkspaceMember(workspaceId, WorkspaceRole.ADMIN);

  const connection = await db.cRMConnection.findUnique({
    where: { workspaceId_provider: { workspaceId, provider: CRMProvider.HUBSPOT } },
  });
  if (!connection || connection.status === "DISCONNECTED") {
    return jsonError("No connected CRM to sync", 400);
  }

  after(() => enqueueAndRun(workspaceId, JobType.CRM_SYNC, { connectionId: connection.id }));

  return jsonOk({ message: "Sync started" }, 202);
});
