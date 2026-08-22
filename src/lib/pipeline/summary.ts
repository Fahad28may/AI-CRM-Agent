import { db } from "@/lib/db";
import { FindingStatus, FindingType, Severity } from "@/generated/prisma/enums";

export type PipelineBucket = "healthy" | "needsAction" | "stale" | "atRisk";

export type OpenFinding = {
  type: FindingType;
  severity: Severity;
  explanation: string;
};

export type PipelineDeal = {
  id: string;
  name: string | null;
  stage: string | null;
  amount: number | null;
  lastActivityAt: Date | null;
  bucket: PipelineBucket;
  findings: OpenFinding[];
};

const STALE_TYPES = new Set<FindingType>([
  FindingType.STALE_OPPORTUNITY,
  FindingType.DEAL_STAGNATION,
  FindingType.UNUSUAL_INACTIVITY,
]);

/**
 * Buckets a deal by its worst signal: one deal, one bucket, so the four
 * dashboard tiles sum to the total open-deal count instead of double
 * counting deals that trip more than one detector.
 */
function bucketFor(findings: OpenFinding[]): PipelineBucket {
  const types = new Set(findings.map((f) => f.type));
  if (types.has(FindingType.POTENTIALLY_LOST_DEAL)) return "atRisk";
  if ([...types].some((t) => STALE_TYPES.has(t))) return "stale";
  if (types.size > 0) return "needsAction";
  return "healthy";
}

export async function getWorkspacePipeline(workspaceId: string): Promise<PipelineDeal[]> {
  const deals = await db.deal.findMany({
    where: { workspaceId, isClosed: false },
    select: {
      id: true,
      name: true,
      stage: true,
      amount: true,
      lastActivityAt: true,
      findings: {
        where: { status: FindingStatus.OPEN },
        select: { type: true, severity: true, explanation: true },
      },
    },
    orderBy: { lastActivityAt: "asc" },
  });

  return deals.map((deal) => ({
    id: deal.id,
    name: deal.name,
    stage: deal.stage,
    amount: deal.amount ? Number(deal.amount) : null,
    lastActivityAt: deal.lastActivityAt,
    findings: deal.findings,
    bucket: bucketFor(deal.findings),
  }));
}

export function summarizePipeline(deals: PipelineDeal[]) {
  return {
    total: deals.length,
    healthy: deals.filter((d) => d.bucket === "healthy").length,
    atRisk: deals.filter((d) => d.bucket === "atRisk").length,
    stale: deals.filter((d) => d.bucket === "stale").length,
    needsAction: deals.filter((d) => d.bucket === "needsAction").length,
  };
}

