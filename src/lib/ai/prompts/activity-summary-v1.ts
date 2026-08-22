import { AI_SAFETY_PREAMBLE } from "@/lib/ai/prompts/system";
import { buildDealContextBlock } from "@/lib/ai/prompts/context";
import type { DealAiContext } from "@/lib/ai/prompts/context";

const TASK_INSTRUCTIONS = `TASK:
Summarize the recent activity on this deal in 2-4 sentences, as a narrative a sales manager could skim to understand what's been happening — not a bullet-by-bullet restatement. Mention the overall trend (e.g. active back-and-forth vs. going quiet) and anything notable (a promise made, a concern raised, a decision point).`;

export function buildActivitySummaryPrompt(params: { context: DealAiContext }): {
  system: string;
  prompt: string;
} {
  const prompt = [buildDealContextBlock(params.context), "", TASK_INSTRUCTIONS].join("\n");
  return { system: AI_SAFETY_PREAMBLE, prompt };
}
