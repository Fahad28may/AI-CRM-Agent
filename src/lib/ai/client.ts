import { generateText, NoObjectGeneratedError, Output } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { z } from "zod";

// Free-tier default so the product works without a funded OpenRouter
// account. Swap to a paid model (e.g. "anthropic/claude-haiku-4.5") via
// the AI_MODEL env var before production — free models are rate-limited
// and lower quality than what a real launch should run on.
const DEFAULT_MODEL = "z-ai/glm-5.2:free";
const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_MAX_RETRIES = 3;

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

/**
 * Some models (observed on a free-tier nvidia model, not the default —
 * but AI_MODEL is user-configurable, so this isn't specific to any one
 * deployment) over-escape when emitting a structured-output string field
 * that contains a real line break: they write the literal two characters
 * `\n` instead of an actual newline. Since the SDK already JSON-parsed
 * the model's raw output before we see it, a literal backslash-n here
 * means the model double-escaped it — correct that one level, everywhere
 * in the object, so a rep never sees raw "\n" text in a review UI or
 * generated email.
 */
export function normalizeModelText(value: unknown): unknown {
  if (typeof value === "string") {
    return value.replace(/\\n/g, "\n").replace(/\\t/g, "\t");
  }
  if (Array.isArray(value)) return value.map(normalizeModelText);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, normalizeModelText(v)]));
  }
  return value;
}

function getModel() {
  const openrouter = createOpenRouter({ apiKey: getEnv("OPENROUTER_API_KEY") });
  const modelId = process.env.AI_MODEL || DEFAULT_MODEL;
  // Usage accounting gets real per-request cost back from OpenRouter
  // instead of us maintaining a static, easily-stale $/token pricing table.
  return { model: openrouter.chat(modelId, { usage: { include: true } }), modelId };
}

export type StructuredGenerationResult<T> = {
  object: T;
  modelId: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
};

/**
 * Thin wrapper around `generateText` + `Output.object` (section 19: no AI
 * call anywhere else in the codebase should touch the provider directly).
 * Retries here are the SDK's own transient-error retries; a handler that
 * still throws after those are exhausted is left to the job queue's
 * retry/backoff (see src/lib/jobs/queue.ts) rather than retried twice.
 */
export async function generateStructured<S extends z.ZodTypeAny>(
  schema: S,
  input: { system: string; prompt: string },
): Promise<StructuredGenerationResult<z.infer<S>>> {
  const { model, modelId } = getModel();

  try {
    const result = await generateText({
      model,
      system: input.system,
      prompt: input.prompt,
      output: Output.object({ schema }),
      maxRetries: DEFAULT_MAX_RETRIES,
      timeout: DEFAULT_TIMEOUT_MS,
    });

    const openrouterUsage = result.providerMetadata?.openrouter?.usage as
      | { cost?: number }
      | undefined;

    return {
      // `result.output` is typed via the generic threaded through
      // Output.object(schema); TS can't carry that through generateText's
      // overload resolution here, so this restores what's guaranteed true
      // at runtime — the SDK already validated it against `schema`.
      object: normalizeModelText(result.output) as z.infer<S>,
      modelId,
      inputTokens: result.usage.inputTokens ?? 0,
      outputTokens: result.usage.outputTokens ?? 0,
      // Falls back to 0 rather than a guessed estimate if OpenRouter didn't
      // return cost accounting for some reason — see recordAiUsage callers,
      // this only affects the cost-tracking dashboard, never the response.
      costUsd: openrouterUsage?.cost ?? 0,
    };
  } catch (error) {
    if (NoObjectGeneratedError.isInstance(error)) {
      throw new Error(`AI did not return a valid structured response: ${error.message}`);
    }
    throw error;
  }
}
