import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getUserWorkspaces } from "@/lib/workspace-server";

export default async function DashboardRedirectPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const workspaces = await getUserWorkspaces(session.user.id);

  if (workspaces.length === 0) redirect("/onboarding");
  if (workspaces.length === 1) redirect(`/w/${workspaces[0].slug}/dashboard`);
  redirect("/workspaces");
}
