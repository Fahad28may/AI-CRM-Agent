import { getWorkspaceBySlug } from "@/lib/workspace-server";
import { getWorkspacePipeline } from "@/lib/pipeline/summary";
import { DealFindingsTable } from "@/components/dashboard/deal-findings-table";

export default async function StaleDealsPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const workspace = await getWorkspaceBySlug(workspaceSlug);
  const deals = workspace ? await getWorkspacePipeline(workspace.id) : [];
  const stale = deals.filter((d) => d.bucket === "stale");

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold text-zinc-900">Stale</h1>
      <DealFindingsTable
        deals={stale}
        emptyTitle="No stale deals"
        emptyDescription="Deals with no meaningful activity for an extended period will show up here."
      />
    </div>
  );
}
