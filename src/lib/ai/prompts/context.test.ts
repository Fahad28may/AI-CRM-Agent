import { describe, expect, it } from "vitest";
import { buildDealContextBlock } from "@/lib/ai/prompts/context";
import type { DealAiContext } from "@/lib/ai/prompts/context";

function baseContext(overrides: Partial<DealAiContext> = {}): DealAiContext {
  return {
    dealName: "Acme Renewal",
    stage: "proposal",
    pipeline: "sales",
    amount: 5000,
    closeDate: new Date("2026-09-01"),
    lastActivityAt: new Date("2026-08-01"),
    contactName: "Jane Buyer",
    contactEmail: "jane@acme.example.com",
    contactJobTitle: "VP Sales",
    companyName: "Acme Corp",
    companyIndustry: "Software",
    activities: [],
    ...overrides,
  };
}

describe("buildDealContextBlock", () => {
  it("wraps the whole block in <CRM_DATA> tags", () => {
    const block = buildDealContextBlock(baseContext());
    expect(block.startsWith("<CRM_DATA>")).toBe(true);
    expect(block.trim().endsWith("</CRM_DATA>")).toBe(true);
  });

  it("includes the core deal, contact, and company facts", () => {
    const block = buildDealContextBlock(baseContext());
    expect(block).toContain("Acme Renewal");
    expect(block).toContain("proposal");
    expect(block).toContain("$5,000");
    expect(block).toContain("Jane Buyer");
    expect(block).toContain("jane@acme.example.com");
    expect(block).toContain("Acme Corp");
  });

  it("degrades gracefully when fields are missing, instead of throwing", () => {
    const block = buildDealContextBlock(
      baseContext({
        dealName: null,
        contactName: null,
        contactEmail: null,
        companyName: null,
        amount: null,
        closeDate: null,
        lastActivityAt: null,
      }),
    );
    expect(block).toContain("(untitled)");
    expect(block).toContain("unknown");
    expect(block).toContain("not set");
  });

  it("renders each activity on its own line with type and date", () => {
    const block = buildDealContextBlock(
      baseContext({
        activities: [
          { type: "EMAIL", subject: "Pricing question", body: null, occurredAt: new Date("2026-08-10") },
          { type: "CALL", subject: null, body: "Discussed rollout timeline", occurredAt: new Date("2026-08-05") },
        ],
      }),
    );
    expect(block).toContain("[EMAIL] 2026-08-10: Pricing question");
    expect(block).toContain("[CALL] 2026-08-05: Discussed rollout timeline");
  });

  it("says so when there is no activity, rather than an empty list", () => {
    const block = buildDealContextBlock(baseContext({ activities: [] }));
    expect(block).toContain("(no activity recorded)");
  });
});
