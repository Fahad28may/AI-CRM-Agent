import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { withErrorHandling } from "@/lib/api-handler";
import { AuthError } from "@/lib/errors";

describe("withErrorHandling", () => {
  it("passes through a successful response unchanged", async () => {
    const handler = withErrorHandling(async () => new Response("ok", { status: 200 }));
    const res = await handler();
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("ok");
  });

  it("maps AuthError to its own status and message", async () => {
    const handler = withErrorHandling(async () => {
      throw new AuthError("Not a member of this workspace", 403);
    });
    const res = await handler();
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Not a member of this workspace" });
  });

  it("maps a ZodError to 400 with the first issue's message", async () => {
    const schema = z.object({ name: z.string().min(1, "Name is required") });
    const handler = withErrorHandling(async () => {
      const result = schema.safeParse({ name: "" });
      if (!result.success) throw result.error;
      return new Response("unreachable");
    });
    const res = await handler();
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Name is required" });
  });

  it("never leaks an unexpected error's message to the client", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const handler = withErrorHandling(async () => {
      throw new Error("DATABASE_URL=postgresql://user:secret@host/db unreachable");
    });
    const res = await handler();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Something went wrong");
    expect(JSON.stringify(body)).not.toContain("secret");
    consoleError.mockRestore();
  });

  it("forwards arguments to the wrapped handler", async () => {
    const handler = withErrorHandling(async (a: string, b: number) => {
      return new Response(JSON.stringify({ a, b }));
    });
    const res = await handler("x", 42);
    expect(await res.json()).toEqual({ a: "x", b: 42 });
  });
});
