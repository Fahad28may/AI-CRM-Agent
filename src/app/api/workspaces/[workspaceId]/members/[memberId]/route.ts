import { db } from "@/lib/db";
import { requireWorkspaceMember } from "@/lib/authz";
import { withErrorHandling } from "@/lib/api-handler";
import { updateMemberSchema } from "@/lib/validation/workspace";
import { jsonError, jsonOk } from "@/lib/api-response";
import { WorkspaceRole } from "@/generated/prisma/enums";

type Params = { params: Promise<{ workspaceId: string; memberId: string }> };

async function getTargetMember(workspaceId: string, memberId: string) {
  const member = await db.workspaceMember.findUnique({ where: { id: memberId } });
  if (!member || member.workspaceId !== workspaceId) {
    return null;
  }
  return member;
}

export const PATCH = withErrorHandling(async (request: Request, { params }: Params) => {
  const { workspaceId, memberId } = await params;
  await requireWorkspaceMember(workspaceId, WorkspaceRole.ADMIN);

  const target = await getTargetMember(workspaceId, memberId);
  if (!target) return jsonError("Member not found", 404);
  if (target.role === WorkspaceRole.OWNER) {
    return jsonError("Cannot change the owner's role", 400);
  }

  const body = await request.json().catch(() => null);
  const { role } = updateMemberSchema.parse(body);

  const updated = await db.workspaceMember.update({
    where: { id: memberId },
    data: { role },
  });

  return jsonOk({ member: { id: updated.id, role: updated.role } });
});

export const DELETE = withErrorHandling(async (_request: Request, { params }: Params) => {
  const { workspaceId, memberId } = await params;
  await requireWorkspaceMember(workspaceId, WorkspaceRole.ADMIN);

  const target = await getTargetMember(workspaceId, memberId);
  if (!target) return jsonError("Member not found", 404);
  if (target.role === WorkspaceRole.OWNER) {
    return jsonError("Cannot remove the workspace owner", 400);
  }

  await db.workspaceMember.delete({ where: { id: memberId } });

  return jsonOk({ message: "Member removed" });
});
