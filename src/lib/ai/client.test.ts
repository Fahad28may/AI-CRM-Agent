import { describe, expect, it } from "vitest";
import { normalizeModelText } from "@/lib/ai/client";

// Observed for real: a free-tier model returned a structured-output body
// field containing the literal two characters "\n" instead of a real line
// break — double-escaping on the model's side. normalizeModelText corrects
// that one level so a rep never sees raw backslash-n text in a review UI
// or a generated email.
describe("normalizeModelText", () => {
  it("converts a literal backslash-n into a real newline", () => {
    expect(normalizeModelText("Hi Maria,\\n\\nFollowing up.")).toBe("Hi Maria,\n\nFollowing up.");
  });

  it("leaves an already-real newline untouched", () => {
    expect(normalizeModelText("Hi Maria,\n\nFollowing up.")).toBe("Hi Maria,\n\nFollowing up.");
  });

  it("recurses into nested objects and arrays", () => {
    const input = {
      subject: "Checking in\\ntoday",
      items: ["one\\ntwo", { body: "three\\nfour" }],
      confidence: 0.9,
    };
    expect(normalizeModelText(input)).toEqual({
      subject: "Checking in\ntoday",
      items: ["one\ntwo", { body: "three\nfour" }],
      confidence: 0.9,
    });
  });

  it("leaves non-string primitives untouched", () => {
    expect(normalizeModelText(42)).toBe(42);
    expect(normalizeModelText(true)).toBe(true);
    expect(normalizeModelText(null)).toBe(null);
  });
});
