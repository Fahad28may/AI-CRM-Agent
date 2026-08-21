import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getWorkspaceBySlug } from "@/lib/workspace-server";
import { db } from "@/lib/db";
import { WorkspaceProvider } from "@/lib/workspace-context";
import { DashboardNav } from "@/components/dashboard/nav";
import { DashboardTopbar } from "@/components/dashboard/topbar";

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspaceSlug: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { workspaceSlug } = await params;
  const workspace = await getWorkspaceBySlug(workspaceSlug);
  if (!workspace) notFound();

  // Server-side membership check — never trust the slug in the URL alone.
  const membership = await db.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: workspace.id, userId: session.user.id } },
  });
  if (!membership) notFound();

  return (
    <WorkspaceProvider
      value={{ id: workspace.id, slug: workspace.slug, name: workspace.name, role: membership.role }}
    >
      <div className="flex min-h-screen flex-col">
        <DashboardTopbar userEmail={session.user.email ?? ""} />
        <div className="flex flex-1">
          <DashboardNav workspaceSlug={workspace.slug} />
          <main className="flex-1 px-8 py-8">{children}</main>
        </div>
      </div>
    </WorkspaceProvider>
  );
}
