import { db } from "@/lib/db";
import { requireWorkspaceMember } from "@/lib/authz";
import { withErrorHandling } from "@/lib/api-handler";
import { jsonError, jsonOk } from "@/lib/api-response";

type Params = { params: Promise<{ workspaceId: string; notificationId: string }> };

export const PATCH = withErrorHandling(async (_request: Request, { params }: Params) => {
  const { workspaceId, notificationId } = await params;
  await requireWorkspaceMember(workspaceId);

  const notification = await db.notification.findUnique({ where: { id: notificationId } });
  if (!notification || notification.workspaceId !== workspaceId) {
    return jsonError("Notification not found", 404);
  }

  const updated = await db.notification.update({
    where: { id: notificationId },
    data: { isRead: true },
  });

  return jsonOk({ notification: updated });
});
