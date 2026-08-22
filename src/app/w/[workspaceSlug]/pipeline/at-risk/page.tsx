import { getWorkspaceBySlug } from "@/lib/workspace-server";
import { getWorkspacePipeline } from "@/lib/pipeline/summary";
import { DealFindingsTable } from "@/components/dashboard/deal-findings-table";

export default async function AtRiskDealsPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const workspace = await getWorkspaceBySlug(workspaceSlug);
  const deals = workspace ? await getWorkspacePipeline(workspace.id) : [];
  const atRisk = deals.filter((d) => d.bucket === "atRisk");

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold text-zinc-900">At risk</h1>
      <DealFindingsTable
        deals={atRisk}
        emptyTitle="No at-risk deals detected"
        emptyDescription="The pipeline health engine checks for stagnation, missing follow-ups, and other risk signals after each sync. Nothing to flag yet."
      />
    </div>
  );
}
