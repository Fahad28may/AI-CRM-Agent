export type ContextActivity = {
  type: string;
  subject: string | null;
  body: string | null;
  occurredAt: Date;
};

export type DealAiContext = {
  dealName: string | null;
  stage: string | null;
  pipeline: string | null;
  amount: number | null;
  closeDate: Date | null;
  lastActivityAt: Date | null;
  contactName: string | null;
  contactEmail: string | null;
  contactJobTitle: string | null;
  companyName: string | null;
  companyIndustry: string | null;
  activities: ContextActivity[];
};

function formatDate(date: Date | null): string {
  return date ? date.toISOString().slice(0, 10) : "unknown";
}

/**
 * Neutralizes literal angle brackets in untrusted free text so a note,
 * email body, or contact/company name can never reconstruct a fake
 * </CRM_DATA> (or <CRM_DATA>) tag and break out of the boundary the
 * system prompt relies on. Applied to every field below that ultimately
 * comes from CRM free text, not just activity bodies — a lead-capture
 * form syncing into "company" or "job title" is just as attacker-
 * reachable as a call note.
 */
function escapeForPrompt(value: string): string {
  return value.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function formatActivity(a: ContextActivity): string {
  const label = a.subject?.trim() || a.body?.trim().slice(0, 200) || "(no subject)";
  return `- [${a.type}] ${formatDate(a.occurredAt)}: ${escapeForPrompt(label)}`;
}

/**
 * Renders deal/contact/company/activity data inside <CRM_DATA> tags — the
 * boundary the system prompt tells the model to treat as inert evidence,
 * never instructions. Free-text fields (activity subjects/bodies, names)
 * are exactly where a prompt-injection attempt would be hidden.
 */
export function buildDealContextBlock(ctx: DealAiContext): string {
  const lines: string[] = [
    "<CRM_DATA>",
    `Deal: ${ctx.dealName ? escapeForPrompt(ctx.dealName) : "(untitled)"}`,
    `Stage: ${ctx.stage ? escapeForPrompt(ctx.stage) : "unknown"}${ctx.pipeline ? ` (pipeline: ${escapeForPrompt(ctx.pipeline)})` : ""}`,
    `Amount: ${ctx.amount !== null ? `$${ctx.amount.toLocaleString("en-US")}` : "not set"}`,
    `Expected close date: ${formatDate(ctx.closeDate)}`,
    `Last activity: ${formatDate(ctx.lastActivityAt)}`,
    "",
    `Primary contact: ${ctx.contactName ? escapeForPrompt(ctx.contactName) : "unknown"}${ctx.contactJobTitle ? ` (${escapeForPrompt(ctx.contactJobTitle)})` : ""}`,
    `Contact email: ${ctx.contactEmail ? escapeForPrompt(ctx.contactEmail) : "unknown"}`,
    `Company: ${ctx.companyName ? escapeForPrompt(ctx.companyName) : "unknown"}${ctx.companyIndustry ? ` — ${escapeForPrompt(ctx.companyIndustry)}` : ""}`,
    "",
    "Recent activity (most recent first):",
    ...(ctx.activities.length > 0
      ? ctx.activities.map(formatActivity)
      : ["(no activity recorded)"]),
    "</CRM_DATA>",
  ];
  return lines.join("\n");
}

export { escapeForPrompt };
