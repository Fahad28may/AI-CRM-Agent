import { describe, expect, it } from "vitest";
import { slugify } from "@/lib/slug";

describe("slugify", () => {
  it("lowercases and replaces non-alphanumeric runs with a hyphen", () => {
    expect(slugify("Acme Sales Team!")).toBe("acme-sales-team");
  });

  it("trims leading and trailing hyphens", () => {
    expect(slugify("  --Acme--  ")).toBe("acme");
  });

  it("caps the length", () => {
    const long = "a".repeat(100);
    expect(slugify(long).length).toBeLessThanOrEqual(60);
  });
});
