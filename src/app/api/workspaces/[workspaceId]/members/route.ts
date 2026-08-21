import { db } from "@/lib/db";
import { requireWorkspaceMember } from "@/lib/authz";
import { withErrorHandling } from "@/lib/api-handler";
import { addMemberSchema } from "@/lib/validation/workspace";
import { jsonError, jsonOk } from "@/lib/api-response";
import { WorkspaceRole } from "@/generated/prisma/enums";

type Params = { params: Promise<{ workspaceId: string }> };

export const GET = withErrorHandling(async (_request: Request, { params }: Params) => {
  const { workspaceId } = await params;
  await requireWorkspaceMember(workspaceId);

  const members = await db.workspaceMember.findMany({
    where: { workspaceId },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });

  return jsonOk({
    members: members.map((m) => ({
      id: m.id,
      role: m.role,
      user: m.user,
    })),
  });
});

// MVP-level "invite": adds an existing user by email directly. A real
// invite-by-email flow (for users without an account yet) belongs in a
// later phase alongside the notification system.
export const POST = withErrorHandling(async (request: Request, { params }: Params) => {
  const { workspaceId } = await params;
  await requireWorkspaceMember(workspaceId, WorkspaceRole.ADMIN);

  const body = await request.json().catch(() => null);
  const { email, role } = addMemberSchema.parse(body);

  const targetUser = await db.user.findUnique({ where: { email } });
  if (!targetUser) {
    return jsonError("No account exists for that email yet.", 404);
  }

  const existingMembership = await db.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: targetUser.id } },
  });
  if (existingMembership) {
    return jsonError("That user is already a member of this workspace.", 409);
  }

  const member = await db.workspaceMember.create({
    data: { workspaceId, userId: targetUser.id, role },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  return jsonOk({ member: { id: member.id, role: member.role, user: member.user } }, 201);
});
