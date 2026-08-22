import Link from "next/link";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { getWorkspaceBySlug } from "@/lib/workspace-server";
import { getWorkspacePipeline, summarizePipeline } from "@/lib/pipeline/summary";
import { RecommendationList } from "@/components/dashboard/recommendation-list";

export default async function WorkspaceDashboardPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const workspace = await getWorkspaceBySlug(workspaceSlug);
  const deals = workspace ? await getWorkspacePipeline(workspace.id) : [];
  const summary = summarizePipeline(deals);

  const recommendations = workspace
    ? await db.recommendation.findMany({
        where: { workspaceId: workspace.id },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: {
          deal: { select: { name: true } },
          actions: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { id: true, status: true, resultSummary: true, errorMessage: true },
          },
        },
      })
    : [];

  const HEALTH_TILES = [
    { label: "Healthy deals", value: summary.healthy },
    { label: "At-risk deals", value: summary.atRisk },
    { label: "Stale deals", value: summary.stale },
    { label: "Needs action", value: summary.needsAction },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">Pipeline health</h1>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {HEALTH_TILES.map((tile) => (
            <Card key={tile.label}>
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                {tile.label}
              </p>
              <p className="mt-2 text-2xl font-semibold text-zinc-900">{tile.value}</p>
            </Card>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-base font-semibold text-zinc-900">AI recommendations</h2>
        <div className="mt-4">
          {deals.length === 0 ? (
            <EmptyState
              title="No recommendations yet"
              description="Connect HubSpot and run your first analysis to start seeing which deals need attention, evidence for why, and suggested next steps."
              action={
                <Link href={`/w/${workspaceSlug}/integrations`}>
                  <Button>Connect HubSpot</Button>
                </Link>
              }
            />
          ) : (
            <RecommendationList
              recommendations={recommendations.map((r) => ({
                id: r.id,
                dealName: r.deal?.name ?? null,
                reasoning: r.reasoning,
                evidence: r.evidence,
                proposedAction: r.proposedAction,
                confidence: r.confidence,
                riskLevel: r.riskLevel,
                createdAt: r.createdAt,
                latestAction: r.actions[0] ?? null,
              }))}
            />
          )}
        </div>
      </div>
    </div>
  );
}
