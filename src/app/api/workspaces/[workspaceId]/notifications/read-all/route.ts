import { db } from "@/lib/db";
import { requireWorkspaceMember } from "@/lib/authz";
import { withErrorHandling } from "@/lib/api-handler";
import { jsonOk } from "@/lib/api-response";

type Params = { params: Promise<{ workspaceId: string }> };

export const POST = withErrorHandling(async (_request: Request, { params }: Params) => {
  const { workspaceId } = await params;
  await requireWorkspaceMember(workspaceId);

  await db.notification.updateMany({
    where: { workspaceId, isRead: false },
    data: { isRead: true },
  });

  return jsonOk({ message: "All notifications marked read" });
});
