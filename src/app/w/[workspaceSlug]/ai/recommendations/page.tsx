import { db } from "@/lib/db";
import { getWorkspaceBySlug } from "@/lib/workspace-server";
import { RecommendationList } from "@/components/dashboard/recommendation-list";

export default async function RecommendationsPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const workspace = await getWorkspaceBySlug(workspaceSlug);

  const recommendations = workspace
    ? await db.recommendation.findMany({
        where: { workspaceId: workspace.id },
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { deal: { select: { name: true } } },
      })
    : [];

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold text-zinc-900">Recommendations</h1>
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
        }))}
      />
    </div>
  );
}
