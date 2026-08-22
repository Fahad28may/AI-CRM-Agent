import { AI_SAFETY_PREAMBLE } from "@/lib/ai/prompts/system";
import { buildDealContextBlock } from "@/lib/ai/prompts/context";
import type { DealAiContext } from "@/lib/ai/prompts/context";

const TASK_INSTRUCTIONS = `TASK:
Write a concise, personalized follow-up email to the primary contact on this deal. Ground it in the actual conversation history and deal context above — reference specific prior topics, promises, or next steps where the data supports it.

Requirements:
- Never write a generic "just following up on my previous email" message.
- Keep it short — a busy prospect should be able to read it in a few seconds.
- Match a professional, warm tone appropriate for B2B sales.
- End with a clear, low-friction call to action.`;

export function buildFollowUpPrompt(params: {
  context: DealAiContext;
  reason: string;
}): { system: string; prompt: string } {
  const { context, reason } = params;

  const prompt = [
    buildDealContextBlock(context),
    "",
    `<CRM_DATA>`,
    `Reason for this follow-up: ${reason}`,
    `</CRM_DATA>`,
    "",
    TASK_INSTRUCTIONS,
  ].join("\n");

  return { system: AI_SAFETY_PREAMBLE, prompt };
}
