import { db } from "@/lib/db";

export async function getUserWorkspaces(userId: string) {
  const memberships = await db.workspaceMember.findMany({
    where: { userId },
    include: { workspace: true },
    orderBy: { createdAt: "asc" },
  });
  return memberships.map((m) => ({
    id: m.workspace.id,
    name: m.workspace.name,
    slug: m.workspace.slug,
    role: m.role,
  }));
}

export async function getWorkspaceBySlug(slug: string) {
  return db.workspace.findUnique({ where: { slug } });
}
