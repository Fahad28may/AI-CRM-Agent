import { AI_SAFETY_PREAMBLE } from "@/lib/ai/prompts/system";
import { buildDealContextBlock } from "@/lib/ai/prompts/context";
import type { DealAiContext } from "@/lib/ai/prompts/context";

const TASK_INSTRUCTIONS = `TASK:
The pipeline health engine has already deterministically detected a problem on this deal (see "Detected issue" below) — you are not being asked to re-detect it. Your job is to explain it in plain language, weigh why it matters, and propose ONE concrete next action a sales rep could take.

Requirements:
- "whatHappened" and "whyItMatters" must be grounded only in the CRM data given — reference specific facts (dates, names, amounts) from it.
- "evidence" must be a short list of specific, verifiable points drawn from the CRM data, not generic statements.
- "proposedAction" must be the single most useful next step, using the exact action type and fields requested by the schema. Prefer SEND_EMAIL when the right move is human-to-human contact, CREATE_TASK when the deal just needs a reminder/next step, UPDATE_FIELD/CHANGE_STAGE when the CRM record itself is stale or wrong.
- If proposing SEND_EMAIL, write a specific, personalized draft referencing the actual deal/contact context — never a generic "just following up" email.
- "confidence" (0-1) reflects how confident you are in this specific recommendation given the evidence available.
- "riskLevel" reflects how much revenue/relationship risk this deal is under right now.`;

export function buildRecommendationPrompt(params: {
  context: DealAiContext;
  findingType: string;
  findingExplanation: string;
  findingEvidence: Record<string, unknown>;
}): { system: string; prompt: string } {
  const { context, findingType, findingExplanation, findingEvidence } = params;

  const prompt = [
    buildDealContextBlock(context),
    "",
    `<CRM_DATA>`,
    `Detected issue: ${findingType}`,
    `Detection explanation: ${findingExplanation}`,
    `Detection evidence: ${JSON.stringify(findingEvidence)}`,
    `</CRM_DATA>`,
    "",
    TASK_INSTRUCTIONS,
  ].join("\n");

  return { system: AI_SAFETY_PREAMBLE, prompt };
}
