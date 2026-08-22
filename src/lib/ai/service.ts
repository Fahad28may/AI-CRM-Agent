import { db } from "@/lib/db";
import { generateStructured } from "@/lib/ai/client";
import { recordAiUsage } from "@/lib/ai/usage";
import {
  ActivitySummarySchema,
  FollowUpEmailSchema,
  RecommendationOutputSchema,
} from "@/lib/ai/schemas";
import type { FollowUpEmailOutput } from "@/lib/ai/schemas";
import { buildRecommendationPrompt } from "@/lib/ai/prompts/recommendation-v1";
import { buildFollowUpPrompt } from "@/lib/ai/prompts/follow-up-v1";
import { buildActivitySummaryPrompt } from "@/lib/ai/prompts/activity-summary-v1";
import type { DealAiContext } from "@/lib/ai/prompts/context";
import { FindingStatus, NotificationType, Severity } from "@/generated/prisma/enums";
import type { Prisma, Recommendation } from "@/generated/prisma/client";

/**
 * AIService (section 19). Method names below intentionally don't mirror
 * the master prompt's list 1:1 — two deliberate collapses, documented
 * here rather than left implicit:
 *
 * - `detectRisk()` doesn't exist here at all. Deal risk detection is
 *   fully deterministic (see src/lib/pipeline/) — rule 3 says don't reach
 *   for an LLM when "inactive for N days" is sufficient, and it already
 *   was before this phase existed.
 * - `analyzeDeal()` isn't a separate call from `generateRecommendation()`.
 *   Both would need the same deal/contact/company/activity context and
 *   produce overlapping reasoning; doing them as two model calls would
 *   double the cost and latency per finding for no real benefit (section
 *   32: avoid unnecessary AI calls). `generateRecommendation` does the
 *   analysis and returns/persists it in one call.
 * - `analyzeContact()` isn't implemented yet — findings are deal-scoped
 *   only (Phase 3 didn't build contact-level detectors), so there's no
 *   trigger that would call it. Deferred, not forgotten.
 */

const ACTIVITIES_PER_DEAL = 20;
const SEVERITY_RANK: Record<Severity, number> = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
  CRITICAL: 3,
};

async function loadDealForAi(dealId: string) {
  const deal = await db.deal.findUniqueOrThrow({
    where: { id: dealId },
    include: {
      contact: true,
      company: true,
      activities: { orderBy: { occurredAt: "desc" }, take: ACTIVITIES_PER_DEAL },
    },
  });

  const context: DealAiContext = {
    dealName: deal.name,
    stage: deal.stage,
    pipeline: deal.pipeline,
    amount: deal.amount ? Number(deal.amount) : null,
    closeDate: deal.closeDate,
    lastActivityAt: deal.lastActivityAt,
    contactName:
      [deal.contact?.firstName, deal.contact?.lastName].filter(Boolean).join(" ") || null,
    contactEmail: deal.contact?.email ?? null,
    contactJobTitle: deal.contact?.jobTitle ?? null,
    companyName: deal.company?.name ?? null,
    companyIndustry: deal.company?.industry ?? null,
    activities: deal.activities.map((a) => ({
      type: a.type,
      subject: a.subject,
      body: a.body,
      occurredAt: a.occurredAt,
    })),
  };

  return { deal, context };
}

/**
 * OPEN findings that either have no recommendation yet, or whose most
 * recent recommendation predates the finding's last update (i.e. the
 * finding was re-detected with fresh evidence since) — the set of
 * findings worth spending an AI call on right now.
 */
export async function findFindingsNeedingRecommendation(workspaceId: string, limit: number) {
  const findings = await db.finding.findMany({
    where: { workspaceId, status: FindingStatus.OPEN },
    include: { recommendations: { orderBy: { createdAt: "desc" }, take: 1 } },
  });

  return findings
    .filter((f) => f.recommendations.length === 0 || f.recommendations[0].createdAt < f.updatedAt)
    .sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity])
    .slice(0, limit)
    .map((f) => f.id);
}

/**
 * The core "detect -> understand -> recommend" step (sections 8-10):
 * takes an already-detected Finding, reasons about it with full deal
 * context, and persists a Recommendation with evidence, a proposed
 * action, confidence, and risk level. Never executes anything itself —
 * that's the approval system in a later phase.
 */
export async function generateRecommendation(findingId: string): Promise<Recommendation | null> {
  const finding = await db.finding.findUniqueOrThrow({ where: { id: findingId } });
  if (finding.status !== FindingStatus.OPEN) return null;
  if (!finding.dealId) {
    throw new Error(`Finding ${findingId} has no dealId — only deal-scoped findings are supported`);
  }

  const { deal, context } = await loadDealForAi(finding.dealId);
  const { system, prompt } = buildRecommendationPrompt({
    context,
    findingType: finding.type,
    findingExplanation: finding.explanation,
    findingEvidence: finding.evidence as Record<string, unknown>,
  });

  const result = await generateStructured(RecommendationOutputSchema, { system, prompt });
  await recordAiUsage(deal.workspaceId, "generateRecommendation", result);

  const { whatHappened, whyItMatters, evidence, proposedAction, confidence, riskLevel } =
    result.object;

  const recommendation = await db.recommendation.create({
    data: {
      workspaceId: deal.workspaceId,
      findingId: finding.id,
      dealId: deal.id,
      type: proposedAction.type,
      targetRecordType: "deal",
      targetRecordId: deal.externalId,
      reasoning: `${whatHappened}\n\n${whyItMatters}`,
      evidence: evidence as Prisma.InputJsonValue,
      proposedAction: proposedAction as Prisma.InputJsonValue,
      confidence,
      riskLevel,
    },
  });

  if (riskLevel === "HIGH") {
    await db.notification.create({
      data: {
        workspaceId: deal.workspaceId,
        type: NotificationType.NEW_RECOMMENDATION,
        title: `New high-priority recommendation: ${deal.name ?? "Untitled deal"}`,
        body: whatHappened,
        relatedType: "recommendation",
        relatedId: recommendation.id,
      },
    });
  }

  return recommendation;
}

/**
 * Standalone follow-up email generator (section 13) — independently
 * callable so a future "Regenerate" action doesn't need to re-run the
 * full recommendation analysis, just the email draft.
 */
export async function generateFollowUp(dealId: string, reason: string): Promise<FollowUpEmailOutput> {
  const { deal, context } = await loadDealForAi(dealId);
  const { system, prompt } = buildFollowUpPrompt({ context, reason });

  const result = await generateStructured(FollowUpEmailSchema, { system, prompt });
  await recordAiUsage(deal.workspaceId, "generateFollowUp", result);

  return result.object;
}

/** Narrative summary of a deal's recent activity — for evidence/detail views. */
export async function summarizeActivity(dealId: string): Promise<string> {
  const { deal, context } = await loadDealForAi(dealId);
  const { system, prompt } = buildActivitySummaryPrompt({ context });

  const result = await generateStructured(ActivitySummarySchema, { system, prompt });
  await recordAiUsage(deal.workspaceId, "summarizeActivity", result);

  return result.object.summary;
}
