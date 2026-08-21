import { db } from "@/lib/db";
import { requireUser } from "@/lib/authz";
import { withErrorHandling } from "@/lib/api-handler";
import { createWorkspaceSchema } from "@/lib/validation/workspace";
import { slugify } from "@/lib/slug";
import { jsonOk } from "@/lib/api-response";
import { WorkspaceRole } from "@/generated/prisma/enums";

export const GET = withErrorHandling(async () => {
  const user = await requireUser();

  const memberships = await db.workspaceMember.findMany({
    where: { userId: user.id },
    include: { workspace: true },
    orderBy: { createdAt: "asc" },
  });

  return jsonOk({
    workspaces: memberships.map((m) => ({
      id: m.workspace.id,
      name: m.workspace.name,
      slug: m.workspace.slug,
      role: m.role,
    })),
  });
});

export const POST = withErrorHandling(async (request: Request) => {
  const user = await requireUser();
  const body = await request.json().catch(() => null);
  const { name } = createWorkspaceSchema.parse(body);

  const baseSlug = slugify(name) || "workspace";
  let slug = baseSlug;
  let suffix = 1;
  while (await db.workspace.findUnique({ where: { slug } })) {
    suffix += 1;
    slug = `${baseSlug}-${suffix}`;
  }

  const workspace = await db.workspace.create({
    data: {
      name,
      slug,
      ownerId: user.id,
      members: {
        create: { userId: user.id, role: WorkspaceRole.OWNER },
      },
    },
  });

  return jsonOk({ workspace: { id: workspace.id, name: workspace.name, slug: workspace.slug } }, 201);
});
