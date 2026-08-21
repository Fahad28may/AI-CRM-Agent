import { describe, expect, it } from "vitest";
import { loginSchema, signupSchema } from "@/lib/validation/auth";

describe("signupSchema", () => {
  it("accepts a valid signup payload", () => {
    const result = signupSchema.safeParse({
      name: "Jane Doe",
      email: "Jane@Example.com",
      password: "supersecret123",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("jane@example.com");
    }
  });

  it("rejects a password shorter than 10 characters", () => {
    const result = signupSchema.safeParse({
      name: "Jane Doe",
      email: "jane@example.com",
      password: "short1",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid email", () => {
    const result = signupSchema.safeParse({
      name: "Jane Doe",
      email: "not-an-email",
      password: "supersecret123",
    });
    expect(result.success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("requires a non-empty password but does not enforce length", () => {
    expect(loginSchema.safeParse({ email: "a@b.com", password: "x" }).success).toBe(true);
    expect(loginSchema.safeParse({ email: "a@b.com", password: "" }).success).toBe(false);
  });
});
