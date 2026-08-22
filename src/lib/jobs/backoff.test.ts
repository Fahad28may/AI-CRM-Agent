import { describe, expect, it } from "vitest";
import { computeRetryDelayMs } from "@/lib/jobs/backoff";

describe("computeRetryDelayMs", () => {
  it("waits 1 minute after the first attempt", () => {
    expect(computeRetryDelayMs(1)).toBe(60_000);
  });

  it("doubles the delay with each subsequent attempt", () => {
    expect(computeRetryDelayMs(2)).toBe(120_000);
    expect(computeRetryDelayMs(3)).toBe(240_000);
    expect(computeRetryDelayMs(4)).toBe(480_000);
  });
});
