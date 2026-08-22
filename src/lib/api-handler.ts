import { AuthError } from "@/lib/errors";
import { jsonError } from "@/lib/api-response";
import { ZodError } from "zod";

/** Wraps a route handler so AuthError/ZodError/unexpected errors map to sane HTTP responses. */
export function withErrorHandling<Args extends unknown[]>(
  fn: (...args: Args) => Promise<Response>,
) {
  return async (...args: Args): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (error) {
      if (error instanceof AuthError) {
        return jsonError(error.message, error.status);
      }
      if (error instanceof ZodError) {
        return jsonError(error.issues[0]?.message ?? "Invalid input", 400);
      }
      console.error("[api] unhandled error", error);
      return jsonError("Something went wrong", 500);
    }
  };
}
