import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { roleAtLeast } from "@/lib/roles";
import { AuthError } from "@/lib/errors";
import type { WorkspaceRole } from "@/generated/prisma/enums";

export { roleAtLeast, AuthError };

/** Resolves the authenticated user, or throws a 401 AuthError. */
export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new AuthError("Not authenticated", 401);
  }
  return session.user;
}

/**
 * Verifies the authenticated user is a member of `workspaceId` with at
 * least `minRole`. The workspace id always comes from the request, but
 * membership is looked up server-side from the authenticated session —
 * a client cannot claim membership it doesn't have.
 */
export async function requireWorkspaceMember(workspaceId: string, minRole?: WorkspaceRole) {
  const user = await requireUser();

  const membership = await db.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: user.id } },
  });

  if (!membership) {
    throw new AuthError("Not a member of this workspace", 403);
  }
  if (minRole && !roleAtLeast(membership.role, minRole)) {
    throw new AuthError("Insufficient permissions", 403);
  }

  return { user, membership };
}
