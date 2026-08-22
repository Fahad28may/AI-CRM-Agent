import { db } from "@/lib/db";
import { requireWorkspaceMember } from "@/lib/authz";
import { withErrorHandling } from "@/lib/api-handler";
import { jsonOk } from "@/lib/api-response";

type Params = { params: Promise<{ workspaceId: string }> };

export const GET = withErrorHandling(async (_request: Request, { params }: Params) => {
  const { workspaceId } = await params;
  await requireWorkspaceMember(workspaceId);

  const [notifications, unreadCount] = await Promise.all([
    db.notification.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    db.notification.count({ where: { workspaceId, isRead: false } }),
  ]);

  return jsonOk({ notifications, unreadCount });
});
