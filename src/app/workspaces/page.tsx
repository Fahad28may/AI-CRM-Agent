import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getUserWorkspaces } from "@/lib/workspace-server";
import { Card } from "@/components/ui/card";

export default async function WorkspacesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const workspaces = await getUserWorkspaces(session.user.id);

  return (
    <div className="mx-auto flex max-w-2xl flex-1 flex-col px-4 py-16">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900">Your workspaces</h1>
        <Link href="/onboarding" className="text-sm text-zinc-900 underline">
          New workspace
        </Link>
      </div>
      <div className="mt-6 flex flex-col gap-3">
        {workspaces.map((w) => (
          <Link key={w.id} href={`/w/${w.slug}/dashboard`}>
            <Card className="transition-colors hover:border-zinc-400">
              <div className="flex items-center justify-between">
                <span className="font-medium text-zinc-900">{w.name}</span>
                <span className="text-xs uppercase text-zinc-400">{w.role}</span>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
