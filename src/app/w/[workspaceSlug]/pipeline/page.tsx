import { getWorkspaceBySlug } from "@/lib/workspace-server";
import { getWorkspacePipeline } from "@/lib/pipeline/summary";
import { DealFindingsTable } from "@/components/dashboard/deal-findings-table";

export default async function PipelineDealsPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const workspace = await getWorkspaceBySlug(workspaceSlug);
  const deals = workspace ? await getWorkspacePipeline(workspace.id) : [];

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold text-zinc-900">Deals</h1>
      <DealFindingsTable
        deals={deals}
        emptyTitle="No deals synced yet"
        emptyDescription="Deals will appear here once HubSpot is connected and the first sync completes."
      />
    </div>
  );
}
