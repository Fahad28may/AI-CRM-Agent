import { FindingType, Severity } from "@/generated/prisma/enums";
import {
  FOLLOW_UP_DAYS,
  INACTIVITY_LOOKBACK_DAYS,
  INACTIVITY_MIN_PRIOR_ACTIVITIES,
  INACTIVITY_RECENT_DAYS,
  STAGNATION_DAYS,
  STALE_DAYS,
  daysBetween,
} from "@/lib/pipeline/thresholds";

/**
 * Provider-agnostic detector input — deliberately not a Prisma payload
 * type, so these rules stay pure and unit-testable without a database.
 */
export type DetectableDeal = {
  id: string;
  isClosed: boolean;
  hasAmount: boolean;
  hasCloseDate: boolean;
  contactEmail: string | null;
  lastActivityAt: Date | null;
  stageChangedAt: Date | null;
  createdAt: Date;
};

export type DealActivity = { type: string; occurredAt: Date };

export type FindingCandidate = {
  type: FindingType;
  severity: Severity;
  explanation: string;
  evidence: Record<string, unknown>;
  recommendation: string;
  confidence: number;
};

const CONVERSATIONAL_TYPES = new Set(["CALL", "EMAIL", "MEETING"]);

function hasUpcomingTask(activities: DealActivity[], now: Date): boolean {
  return activities.some((a) => a.type === "TASK" && a.occurredAt.getTime() > now.getTime());
}

function detectStaleOpportunity(
  deal: DetectableDeal,
  _activities: DealActivity[],
  now: Date,
): FindingCandidate | null {
  const reference = deal.lastActivityAt ?? deal.createdAt;
  const daysSince = daysBetween(now, reference);
  if (daysSince < STALE_DAYS) return null;

  return {
    type: FindingType.STALE_OPPORTUNITY,
    severity: daysSince >= STALE_DAYS * 2 ? Severity.HIGH : Severity.MEDIUM,
    explanation: `No recorded activity on this deal for ${daysSince} days.`,
    evidence: { daysSinceActivity: daysSince, lastActivityAt: deal.lastActivityAt },
    recommendation: "Reach out to re-engage the prospect, or confirm whether this deal is still active.",
    confidence: 0.9,
  };
}

function detectMissingFollowUp(
  deal: DetectableDeal,
  activities: DealActivity[],
  now: Date,
): FindingCandidate | null {
  const mostRecent = activities[0];
  if (!mostRecent || !CONVERSATIONAL_TYPES.has(mostRecent.type)) return null;

  const daysSince = daysBetween(now, mostRecent.occurredAt);
  if (daysSince < FOLLOW_UP_DAYS || hasUpcomingTask(activities, now)) return null;

  return {
    type: FindingType.MISSING_FOLLOW_UP,
    severity: Severity.MEDIUM,
    explanation: `The last interaction was a ${mostRecent.type.toLowerCase()} ${daysSince} days ago, with no follow-up recorded since and nothing scheduled.`,
    evidence: {
      lastInteractionType: mostRecent.type,
      lastInteractionAt: mostRecent.occurredAt,
      daysSinceInteraction: daysSince,
    },
    recommendation: "Send a follow-up referencing the last conversation.",
    confidence: 0.85,
  };
}

function detectDealStagnation(
  deal: DetectableDeal,
  _activities: DealActivity[],
  now: Date,
): FindingCandidate | null {
  const reference = deal.stageChangedAt ?? deal.createdAt;
  const daysInStage = daysBetween(now, reference);
  if (daysInStage < STAGNATION_DAYS) return null;

  return {
    type: FindingType.DEAL_STAGNATION,
    severity: daysInStage >= STAGNATION_DAYS * 2 ? Severity.HIGH : Severity.MEDIUM,
    explanation: `This deal has stayed in its current stage for ${daysInStage} days.`,
    evidence: { daysInStage, stageChangedAt: deal.stageChangedAt },
    recommendation: "Confirm the deal is still progressing, or move it to the correct stage.",
    confidence: 0.75,
  };
}

function detectNoNextStep(
  deal: DetectableDeal,
  activities: DealActivity[],
  now: Date,
): FindingCandidate | null {
  if (hasUpcomingTask(activities, now)) return null;

  return {
    type: FindingType.NO_NEXT_STEP,
    severity: Severity.MEDIUM,
    explanation: "This open deal has no scheduled task or next step.",
    evidence: { hasUpcomingTask: false },
    recommendation: "Create a task for the next concrete step on this deal.",
    confidence: 0.8,
  };
}

function detectMissingCrmData(deal: DetectableDeal): FindingCandidate | null {
  const missing: string[] = [];
  if (!deal.hasAmount) missing.push("amount");
  if (!deal.hasCloseDate) missing.push("close date");
  if (!deal.contactEmail) missing.push("primary contact email");
  if (missing.length === 0) return null;

  return {
    type: FindingType.MISSING_CRM_DATA,
    severity: missing.length >= 2 ? Severity.MEDIUM : Severity.LOW,
    explanation: `This deal is missing: ${missing.join(", ")}.`,
    evidence: { missingFields: missing },
    recommendation: "Fill in the missing fields so this deal can be reasoned about accurately.",
    confidence: 1,
  };
}

function detectUnusualInactivity(
  deal: DetectableDeal,
  activities: DealActivity[],
  now: Date,
): FindingCandidate | null {
  const recentCutoff = now.getTime() - INACTIVITY_RECENT_DAYS * 24 * 60 * 60 * 1000;
  const lookbackCutoff = now.getTime() - INACTIVITY_LOOKBACK_DAYS * 24 * 60 * 60 * 1000;

  const recentCount = activities.filter((a) => a.occurredAt.getTime() >= recentCutoff).length;
  const priorCount = activities.filter(
    (a) => a.occurredAt.getTime() >= lookbackCutoff && a.occurredAt.getTime() < recentCutoff,
  ).length;

  if (recentCount > 0 || priorCount < INACTIVITY_MIN_PRIOR_ACTIVITIES) return null;

  return {
    type: FindingType.UNUSUAL_INACTIVITY,
    severity: Severity.MEDIUM,
    explanation: `This deal had ${priorCount} activities in the prior period but has gone silent in the last ${INACTIVITY_RECENT_DAYS} days.`,
    evidence: { priorActivityCount: priorCount, recentActivityCount: recentCount },
    recommendation: "Check in — this deal was active and has suddenly gone quiet.",
    confidence: 0.7,
  };
}

/** Deal-scoped risk signals, used both directly and as inputs to the composite "potentially lost" check. */
const RISK_DETECTORS = [
  detectStaleOpportunity,
  detectMissingFollowUp,
  detectDealStagnation,
  detectNoNextStep,
  detectUnusualInactivity,
];

function detectPotentiallyLostDeal(riskFindings: FindingCandidate[]): FindingCandidate | null {
  if (riskFindings.length < 3) return null;

  return {
    type: FindingType.POTENTIALLY_LOST_DEAL,
    severity: Severity.CRITICAL,
    explanation: `Multiple risk signals are present on this deal: ${riskFindings.map((f) => f.type).join(", ")}.`,
    evidence: { signals: riskFindings.map((f) => ({ type: f.type, evidence: f.evidence })) },
    recommendation: "Review this deal closely — it may be at serious risk of stalling out or being lost.",
    confidence: 0.8,
  };
}

/** Runs every detector against one deal and returns the findings that currently apply. */
export function runDetectors(
  deal: DetectableDeal,
  activities: DealActivity[],
  now: Date,
): FindingCandidate[] {
  if (deal.isClosed) return [];

  const riskFindings = RISK_DETECTORS.map((detect) => detect(deal, activities, now)).filter(
    (f): f is FindingCandidate => f !== null,
  );
  const crmDataFinding = detectMissingCrmData(deal);
  const lostDealFinding = detectPotentiallyLostDeal(riskFindings);

  return [...riskFindings, ...(crmDataFinding ? [crmDataFinding] : []), ...(lostDealFinding ? [lostDealFinding] : [])];
}

export const ALL_FINDING_TYPES = Object.values(FindingType);
