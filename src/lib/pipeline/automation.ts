import { db } from "@/lib/db";
import { FindingType } from "@/generated/prisma/enums";
import { FOLLOW_UP_DAYS, STAGNATION_DAYS, STALE_DAYS } from "@/lib/pipeline/thresholds";
import type { RuleConfig } from "@/lib/pipeline/rules";
import type { AutomationRule, Prisma } from "@/generated/prisma/client";

/**
 * Automation rules (section 17) are deliberately scoped to overriding the
 * three day-threshold detectors that already exist in rules.ts, rather
 * than a generic condition/action engine — the doc's own examples ("IF
 * deal inactive > 7 days") are exactly those thresholds, and per rule 3
 * ("don't reach for an LLM/new machinery when deterministic code already
 * does the job") there's no reason to build a second detection system
 * alongside the first. `thenAction` is always CREATE_RECOMMENDATION per
 * the MVP constraint in section 17: automation proposes, never executes.
 */
export const CONFIGURABLE_FINDING_TYPES = [
  FindingType.STALE_OPPORTUNITY,
  FindingType.DEAL_STAGNATION,
  FindingType.MISSING_FOLLOW_UP,
] as const;
export type ConfigurableFindingType = (typeof CONFIGURABLE_FINDING_TYPES)[number];

export const RULE_METADATA: Record<
  ConfigurableFindingType,
  { label: string; description: string; defaultThresholdDays: number }
> = {
  STALE_OPPORTUNITY: {
    label: "Stale opportunity",
    description: "Flag a deal when it has had no recorded activity for this many days.",
    defaultThresholdDays: STALE_DAYS,
  },
  DEAL_STAGNATION: {
    label: "Deal stagnation",
    description: "Flag a deal when it hasn't changed stage for this many days.",
    defaultThresholdDays: STAGNATION_DAYS,
  },
  MISSING_FOLLOW_UP: {
    label: "Missing follow-up",
    description: "Flag a deal when the last conversation had no follow-up within this many days.",
    defaultThresholdDays: FOLLOW_UP_DAYS,
  },
};

const THEN_ACTION = "CREATE_RECOMMENDATION";

type StoredCondition = { findingType: ConfigurableFindingType; thresholdDays: number };

function isConfigurableCondition(condition: unknown): condition is StoredCondition {
  const c = condition as StoredCondition;
  return typeof c?.findingType === "string" && c.findingType in RULE_METADATA;
}

export type AutomationSetting = {
  findingType: ConfigurableFindingType;
  label: string;
  description: string;
  thresholdDays: number;
  isActive: boolean;
};

/** The effective per-workspace setting for each configurable detector — DB override merged over the default. */
export async function getWorkspaceAutomationSettings(workspaceId: string): Promise<AutomationSetting[]> {
  const rules = await db.automationRule.findMany({ where: { workspaceId } });
  const byType = new Map<ConfigurableFindingType, AutomationRule>();
  for (const rule of rules) {
    if (isConfigurableCondition(rule.condition)) byType.set(rule.condition.findingType, rule);
  }

  return CONFIGURABLE_FINDING_TYPES.map((findingType) => {
    const meta = RULE_METADATA[findingType];
    const rule = byType.get(findingType);
    const condition = rule?.condition as StoredCondition | undefined;
    return {
      findingType,
      label: meta.label,
      description: meta.description,
      thresholdDays: condition?.thresholdDays ?? meta.defaultThresholdDays,
      isActive: rule?.isActive ?? true,
    };
  });
}

/** Resolves a workspace's settings into the RuleConfig runDetectors expects. */
export async function getWorkspaceRuleConfig(workspaceId: string): Promise<RuleConfig> {
  const settings = await getWorkspaceAutomationSettings(workspaceId);
  const byType = Object.fromEntries(settings.map((s) => [s.findingType, s.thresholdDays])) as Record<
    ConfigurableFindingType,
    number
  >;

  return {
    staleDays: byType.STALE_OPPORTUNITY,
    stagnationDays: byType.DEAL_STAGNATION,
    followUpDays: byType.MISSING_FOLLOW_UP,
    disabledTypes: new Set(settings.filter((s) => !s.isActive).map((s) => s.findingType)),
  };
}

export async function upsertAutomationRule(
  workspaceId: string,
  userId: string,
  findingType: ConfigurableFindingType,
  input: { thresholdDays: number; isActive: boolean },
): Promise<AutomationRule> {
  const meta = RULE_METADATA[findingType];
  const rules = await db.automationRule.findMany({ where: { workspaceId } });
  const existing = rules.find((r) => isConfigurableCondition(r.condition) && r.condition.findingType === findingType);

  const condition: StoredCondition = { findingType, thresholdDays: input.thresholdDays };
  const data = {
    name: meta.label,
    description: meta.description,
    isActive: input.isActive,
    condition: condition as Prisma.InputJsonValue,
    thenAction: THEN_ACTION,
  };

  if (existing) {
    return db.automationRule.update({ where: { id: existing.id }, data });
  }
  return db.automationRule.create({ data: { workspaceId, createdByUserId: userId, ...data } });
}
