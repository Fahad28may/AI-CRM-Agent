import { db } from "@/lib/db";
import { requireWorkspaceMember } from "@/lib/authz";
import { withErrorHandling } from "@/lib/api-handler";
import { jsonOk } from "@/lib/api-response";
import { CRMConnectionStatus, WorkspaceRole } from "@/generated/prisma/enums";

type Params = { params: Promise<{ workspaceId: string }> };

export const GET = withErrorHandling(async (_request: Request, { params }: Params) => {
  const { workspaceId } = await params;
  await requireWorkspaceMember(workspaceId);

  const connection = await db.cRMConnection.findUnique({
    where: { workspaceId_provider: { workspaceId, provider: "HUBSPOT" } },
  });

  return jsonOk({
    connection: connection
      ? {
          id: connection.id,
          provider: connection.provider,
          status: connection.status,
          lastSyncedAt: connection.lastSyncedAt,
          lastSyncError: connection.lastSyncError,
          createdAt: connection.createdAt,
        }
      : null,
  });
});

export const DELETE = withErrorHandling(async (_request: Request, { params }: Params) => {
  const { workspaceId } = await params;
  await requireWorkspaceMember(workspaceId, WorkspaceRole.ADMIN);

  await db.cRMConnection.updateMany({
    where: { workspaceId, provider: "HUBSPOT" },
    data: {
      status: CRMConnectionStatus.DISCONNECTED,
      accessTokenEncrypted: null,
      refreshTokenEncrypted: null,
      tokenExpiresAt: null,
    },
  });

  return jsonOk({ message: "Disconnected" });
});
