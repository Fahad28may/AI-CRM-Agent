import { describe, expect, it } from "vitest";
import { FindingType, Severity } from "@/generated/prisma/enums";
import { DEFAULT_RULE_CONFIG, runDetectors } from "@/lib/pipeline/rules";
import type { DealActivity, DetectableDeal } from "@/lib/pipeline/rules";

const NOW = new Date("2026-08-21T00:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000);
const daysFromNow = (n: number) => new Date(NOW.getTime() + n * 24 * 60 * 60 * 1000);

function baseDeal(overrides: Partial<DetectableDeal> = {}): DetectableDeal {
  return {
    id: "deal_1",
    isClosed: false,
    hasAmount: true,
    hasCloseDate: true,
    contactEmail: "prospect@example.com",
    lastActivityAt: daysAgo(1),
    stageChangedAt: daysAgo(1),
    createdAt: daysAgo(30),
    ...overrides,
  };
}

function types(deal: DetectableDeal, activities: DealActivity[]) {
  return runDetectors(deal, activities, NOW).map((f) => f.type);
}

describe("runDetectors", () => {
  it("returns nothing for a closed deal, regardless of how neglected it looks", () => {
    const deal = baseDeal({ isClosed: true, lastActivityAt: daysAgo(90), hasAmount: false });
    expect(runDetectors(deal, [], NOW)).toEqual([]);
  });

  it("returns nothing for a healthy deal with no risk signals", () => {
    const deal = baseDeal();
    const activities: DealActivity[] = [{ type: "TASK", occurredAt: daysFromNow(2) }];
    expect(types(deal, activities)).toEqual([]);
  });

  describe("STALE_OPPORTUNITY", () => {
    it("fires once activity has been silent past the threshold", () => {
      const deal = baseDeal({ lastActivityAt: daysAgo(20) });
      expect(types(deal, [])).toContain(FindingType.STALE_OPPORTUNITY);
    });

    it("does not fire while recently active", () => {
      const deal = baseDeal({ lastActivityAt: daysAgo(2) });
      expect(types(deal, [])).not.toContain(FindingType.STALE_OPPORTUNITY);
    });

    it("escalates to HIGH severity when far past the threshold", () => {
      const deal = baseDeal({ lastActivityAt: daysAgo(40) });
      const finding = runDetectors(deal, [], NOW).find((f) => f.type === FindingType.STALE_OPPORTUNITY);
      expect(finding?.severity).toBe(Severity.HIGH);
    });
  });

  describe("MISSING_FOLLOW_UP", () => {
    it("fires when the last touch was a conversation with nothing since and nothing scheduled", () => {
      const deal = baseDeal({ lastActivityAt: daysAgo(5) });
      const activities: DealActivity[] = [{ type: "EMAIL", occurredAt: daysAgo(5) }];
      expect(types(deal, activities)).toContain(FindingType.MISSING_FOLLOW_UP);
    });

    it("does not fire when a task is already scheduled after the conversation", () => {
      const deal = baseDeal({ lastActivityAt: daysAgo(5) });
      const activities: DealActivity[] = [
        { type: "EMAIL", occurredAt: daysAgo(5) },
        { type: "TASK", occurredAt: daysFromNow(1) },
      ];
      expect(types(deal, activities)).not.toContain(FindingType.MISSING_FOLLOW_UP);
    });

    it("does not fire when something already happened after the conversation", () => {
      const deal = baseDeal({ lastActivityAt: daysAgo(1) });
      const activities: DealActivity[] = [
        { type: "NOTE", occurredAt: daysAgo(1) },
        { type: "EMAIL", occurredAt: daysAgo(5) },
      ];
      expect(types(deal, activities)).not.toContain(FindingType.MISSING_FOLLOW_UP);
    });

    it("does not fire with no conversational activity at all", () => {
      const deal = baseDeal({ lastActivityAt: daysAgo(10) });
      expect(types(deal, [])).not.toContain(FindingType.MISSING_FOLLOW_UP);
    });
  });

  describe("DEAL_STAGNATION", () => {
    it("fires when the stage hasn't changed in a long time", () => {
      const deal = baseDeal({ stageChangedAt: daysAgo(25), lastActivityAt: daysAgo(1) });
      expect(types(deal, [])).toContain(FindingType.DEAL_STAGNATION);
    });

    it("does not fire right after a stage change", () => {
      const deal = baseDeal({ stageChangedAt: daysAgo(2) });
      expect(types(deal, [])).not.toContain(FindingType.DEAL_STAGNATION);
    });
  });

  describe("NO_NEXT_STEP", () => {
    it("fires when there is no upcoming task", () => {
      const deal = baseDeal();
      expect(types(deal, [{ type: "CALL", occurredAt: daysAgo(1) }])).toContain(
        FindingType.NO_NEXT_STEP,
      );
    });

    it("does not fire once a future task exists", () => {
      const deal = baseDeal();
      expect(types(deal, [{ type: "TASK", occurredAt: daysFromNow(3) }])).not.toContain(
        FindingType.NO_NEXT_STEP,
      );
    });

    it("does not count a past task as a next step", () => {
      const deal = baseDeal();
      expect(types(deal, [{ type: "TASK", occurredAt: daysAgo(3) }])).toContain(
        FindingType.NO_NEXT_STEP,
      );
    });
  });

  describe("MISSING_CRM_DATA", () => {
    it("fires when required fields are missing", () => {
      const deal = baseDeal({ hasAmount: false, contactEmail: null });
      const finding = runDetectors(deal, [], NOW).find((f) => f.type === FindingType.MISSING_CRM_DATA);
      expect(finding).toBeDefined();
      expect(finding?.evidence.missingFields).toEqual(["amount", "primary contact email"]);
    });

    it("does not fire when all required fields are present", () => {
      const deal = baseDeal();
      expect(types(deal, [])).not.toContain(FindingType.MISSING_CRM_DATA);
    });
  });

  describe("UNUSUAL_INACTIVITY", () => {
    it("fires when a previously active deal has gone silent recently", () => {
      const deal = baseDeal({ lastActivityAt: daysAgo(20) });
      const activities: DealActivity[] = [
        { type: "CALL", occurredAt: daysAgo(20) },
        { type: "EMAIL", occurredAt: daysAgo(30) },
        { type: "EMAIL", occurredAt: daysAgo(45) },
      ];
      expect(types(deal, activities)).toContain(FindingType.UNUSUAL_INACTIVITY);
    });

    it("does not fire for a deal with recent activity", () => {
      const deal = baseDeal({ lastActivityAt: daysAgo(2) });
      const activities: DealActivity[] = [
        { type: "CALL", occurredAt: daysAgo(2) },
        { type: "EMAIL", occurredAt: daysAgo(30) },
        { type: "EMAIL", occurredAt: daysAgo(45) },
      ];
      expect(types(deal, activities)).not.toContain(FindingType.UNUSUAL_INACTIVITY);
    });

    it("does not fire for a deal that was never really active", () => {
      const deal = baseDeal({ lastActivityAt: daysAgo(90) });
      const activities: DealActivity[] = [{ type: "EMAIL", occurredAt: daysAgo(90) }];
      expect(types(deal, activities)).not.toContain(FindingType.UNUSUAL_INACTIVITY);
    });
  });

  describe("POTENTIALLY_LOST_DEAL", () => {
    it("fires once three or more risk signals stack up", () => {
      // Stale + stagnant + no next step, all at once.
      const deal = baseDeal({ lastActivityAt: daysAgo(40), stageChangedAt: daysAgo(40) });
      const found = types(deal, []);
      expect(found).toContain(FindingType.STALE_OPPORTUNITY);
      expect(found).toContain(FindingType.DEAL_STAGNATION);
      expect(found).toContain(FindingType.NO_NEXT_STEP);
      expect(found).toContain(FindingType.POTENTIALLY_LOST_DEAL);
    });

    it("does not fire for a single isolated risk signal", () => {
      const deal = baseDeal({ lastActivityAt: daysAgo(2), stageChangedAt: daysAgo(2) });
      expect(types(deal, [{ type: "TASK", occurredAt: daysFromNow(1) }])).not.toContain(
        FindingType.POTENTIALLY_LOST_DEAL,
      );
    });

    it("ignores MISSING_CRM_DATA when counting toward the composite signal", () => {
      // Only one real risk signal (no next step) plus a data-quality gap —
      // should not be enough to call the deal "potentially lost".
      const deal = baseDeal({
        lastActivityAt: daysAgo(2),
        stageChangedAt: daysAgo(2),
        hasAmount: false,
        hasCloseDate: false,
      });
      expect(types(deal, [])).not.toContain(FindingType.POTENTIALLY_LOST_DEAL);
    });
  });

  describe("RuleConfig overrides", () => {
    it("uses a workspace's custom threshold instead of the default", () => {
      const deal = baseDeal({ lastActivityAt: daysAgo(5) });
      // Default STALE_DAYS is 14, so this wouldn't normally fire yet.
      expect(types(deal, [])).not.toContain(FindingType.STALE_OPPORTUNITY);

      const found = runDetectors(deal, [], NOW, { ...DEFAULT_RULE_CONFIG, staleDays: 3 });
      expect(found.map((f) => f.type)).toContain(FindingType.STALE_OPPORTUNITY);
    });

    it("skips a detector entirely when its finding type is disabled", () => {
      const deal = baseDeal({ lastActivityAt: daysAgo(20) });
      expect(types(deal, [])).toContain(FindingType.STALE_OPPORTUNITY);

      const found = runDetectors(deal, [], NOW, {
        ...DEFAULT_RULE_CONFIG,
        disabledTypes: new Set([FindingType.STALE_OPPORTUNITY]),
      });
      expect(found.map((f) => f.type)).not.toContain(FindingType.STALE_OPPORTUNITY);
    });

    it("excludes disabled risk signals from the composite POTENTIALLY_LOST_DEAL count", () => {
      // Same deal as the earlier 3-signal test, but with one signal disabled
      // it should drop below the threshold for the composite finding.
      const deal = baseDeal({ lastActivityAt: daysAgo(40), stageChangedAt: daysAgo(40) });
      const found = runDetectors(deal, [], NOW, {
        ...DEFAULT_RULE_CONFIG,
        disabledTypes: new Set([FindingType.NO_NEXT_STEP]),
      });
      expect(found.map((f) => f.type)).not.toContain(FindingType.POTENTIALLY_LOST_DEAL);
    });
  });
});
