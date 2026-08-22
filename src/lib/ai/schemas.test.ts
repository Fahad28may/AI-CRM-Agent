import { describe, expect, it } from "vitest";
import { RecommendationOutputSchema } from "@/lib/ai/schemas";

function validBase() {
  return {
    whatHappened: "The deal has gone quiet for 20 days.",
    whyItMatters: "It's the largest open deal this quarter.",
    evidence: ["No activity since 2026-08-01", "Amount is $50,000"],
    confidence: 0.8,
    riskLevel: "HIGH" as const,
  };
}

describe("RecommendationOutputSchema", () => {
  it("accepts a valid SEND_EMAIL proposed action", () => {
    const result = RecommendationOutputSchema.safeParse({
      ...validBase(),
      proposedAction: { type: "SEND_EMAIL", subject: "Checking in", body: "Hi Jane, ..." },
    });
    expect(result.success).toBe(true);
  });

  it("accepts a valid CREATE_TASK proposed action", () => {
    const result = RecommendationOutputSchema.safeParse({
      ...validBase(),
      proposedAction: { type: "CREATE_TASK", subject: "Call Jane", dueInDays: 2 },
    });
    expect(result.success).toBe(true);
  });

  it("rejects a proposed action type outside the executable set (e.g. ASSIGN_OWNER)", () => {
    const result = RecommendationOutputSchema.safeParse({
      ...validBase(),
      proposedAction: { type: "ASSIGN_OWNER", ownerId: "123" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a SEND_EMAIL action missing a body", () => {
    const result = RecommendationOutputSchema.safeParse({
      ...validBase(),
      proposedAction: { type: "SEND_EMAIL", subject: "Checking in" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects confidence outside 0-1", () => {
    const result = RecommendationOutputSchema.safeParse({
      ...validBase(),
      confidence: 1.5,
      proposedAction: { type: "CREATE_TASK", subject: "Call Jane", dueInDays: 2 },
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty evidence list", () => {
    const result = RecommendationOutputSchema.safeParse({
      ...validBase(),
      evidence: [],
      proposedAction: { type: "CREATE_TASK", subject: "Call Jane", dueInDays: 2 },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a riskLevel outside LOW/MEDIUM/HIGH", () => {
    const result = RecommendationOutputSchema.safeParse({
      ...validBase(),
      riskLevel: "CRITICAL",
      proposedAction: { type: "CREATE_TASK", subject: "Call Jane", dueInDays: 2 },
    });
    expect(result.success).toBe(false);
  });
});
