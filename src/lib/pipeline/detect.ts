import { db } from "@/lib/db";
import { FindingStatus } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import { ALL_FINDING_TYPES, runDetectors } from "@/lib/pipeline/rules";
import type { DealActivity, DetectableDeal, FindingCandidate } from "@/lib/pipeline/rules";

const ACTIVITIES_PER_DEAL = 50;

async function upsertFindingsForDeal(
  workspaceId: string,
  deal: DetectableDeal & { externalId: string },
  candidates: FindingCandidate[],
): Promise<void> {
  const candidateTypes = new Set(candidates.map((c) => c.type));

  for (const candidate of candidates) {
    await db.finding.upsert({
      where: {
        workspaceId_dealId_type: { workspaceId, dealId: deal.id, type: candidate.type },
      },
      create: {
        workspaceId,
        dealId: deal.id,
        type: candidate.type,
        severity: candidate.severity,
        crmRecordType: "deal",
        crmRecordId: deal.externalId,
        explanation: candidate.explanation,
        evidence: candidate.evidence as Prisma.InputJsonValue,
        recommendation: candidate.recommendation,
        confidence: candidate.confidence,
        status: FindingStatus.OPEN,
      },
      update: {
        severity: candidate.severity,
        explanation: candidate.explanation,
        evidence: candidate.evidence as Prisma.InputJsonValue,
        recommendation: candidate.recommendation,
        confidence: candidate.confidence,
        status: FindingStatus.OPEN,
      },
    });
  }

  const resolvedTypes = ALL_FINDING_TYPES.filter((type) => !candidateTypes.has(type));
  if (resolvedTypes.length > 0) {
    await db.finding.updateMany({
      where: {
        workspaceId,
        dealId: deal.id,
        type: { in: resolvedTypes },
        status: FindingStatus.OPEN,
      },
      data: { status: FindingStatus.RESOLVED },
    });
  }
}

/**
 * Deterministic pipeline analysis for one workspace (section 8 of the
 * master prompt). Re-detects every open deal's findings and reconciles
 * them: still-applicable findings are refreshed in place, no-longer-
 * applicable ones are resolved, new ones are created. Safe to re-run —
 * every write is keyed by (workspace, deal, finding type).
 */
export async function analyzeWorkspacePipeline(workspaceId: string): Promise<void> {
  const now = new Date();

  const deals = await db.deal.findMany({
    where: { workspaceId, isClosed: false },
    select: {
      id: true,
      externalId: true,
      isClosed: true,
      amount: true,
      closeDate: true,
      lastActivityAt: true,
      stageChangedAt: true,
      createdAt: true,
      contact: { select: { email: true } },
      activities: {
        orderBy: { occurredAt: "desc" },
        take: ACTIVITIES_PER_DEAL,
        select: { type: true, occurredAt: true },
      },
    },
  });

  for (const deal of deals) {
    const detectable: DetectableDeal & { externalId: string } = {
      id: deal.id,
      externalId: deal.externalId,
      isClosed: deal.isClosed,
      hasAmount: deal.amount !== null,
      hasCloseDate: deal.closeDate !== null,
      contactEmail: deal.contact?.email ?? null,
      lastActivityAt: deal.lastActivityAt,
      stageChangedAt: deal.stageChangedAt,
      createdAt: deal.createdAt,
    };
    const activities: DealActivity[] = deal.activities;
    const candidates = runDetectors(detectable, activities, now);
    await upsertFindingsForDeal(workspaceId, detectable, candidates);
  }

  // Deals that closed since their last analysis still have OPEN findings
  // attached (they were skipped above, since the fetch excludes closed
  // deals) — clear those out so a won/lost deal doesn't linger on the
  // pipeline health dashboard.
  await db.finding.updateMany({
    where: { workspaceId, status: FindingStatus.OPEN, deal: { isClosed: true } },
    data: { status: FindingStatus.RESOLVED },
  });
}
