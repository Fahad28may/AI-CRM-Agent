import { db } from "@/lib/db";
import { requireWorkspaceMember } from "@/lib/authz";
import { withErrorHandling } from "@/lib/api-handler";
import { updateWorkspaceSchema } from "@/lib/validation/workspace";
import { jsonOk } from "@/lib/api-response";
import { WorkspaceRole } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";

type Params = { params: Promise<{ workspaceId: string }> };

export const GET = withErrorHandling(async (_request: Request, { params }: Params) => {
  const { workspaceId } = await params;
  const { membership } = await requireWorkspaceMember(workspaceId);

  const workspace = await db.workspace.findUniqueOrThrow({ where: { id: workspaceId } });

  return jsonOk({
    workspace: {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      plan: workspace.plan,
      subscriptionStatus: workspace.subscriptionStatus,
      settings: workspace.settings,
      myRole: membership.role,
    },
  });
});

export const PATCH = withErrorHandling(async (request: Request, { params }: Params) => {
  const { workspaceId } = await params;
  await requireWorkspaceMember(workspaceId, WorkspaceRole.ADMIN);

  const body = await request.json().catch(() => null);
  const data = updateWorkspaceSchema.parse(body);

  const workspace = await db.workspace.update({
    where: { id: workspaceId },
    data: data as Prisma.WorkspaceUpdateInput,
  });

  return jsonOk({ workspace: { id: workspace.id, name: workspace.name, settings: workspace.settings } });
});
