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

function formatActivity(a: ContextActivity): string {
  const label = a.subject?.trim() || a.body?.trim().slice(0, 200) || "(no subject)";
  return `- [${a.type}] ${formatDate(a.occurredAt)}: ${label}`;
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
    `Deal: ${ctx.dealName ?? "(untitled)"}`,
    `Stage: ${ctx.stage ?? "unknown"}${ctx.pipeline ? ` (pipeline: ${ctx.pipeline})` : ""}`,
    `Amount: ${ctx.amount !== null ? `$${ctx.amount.toLocaleString("en-US")}` : "not set"}`,
    `Expected close date: ${formatDate(ctx.closeDate)}`,
    `Last activity: ${formatDate(ctx.lastActivityAt)}`,
    "",
    `Primary contact: ${ctx.contactName ?? "unknown"}${ctx.contactJobTitle ? ` (${ctx.contactJobTitle})` : ""}`,
    `Contact email: ${ctx.contactEmail ?? "unknown"}`,
    `Company: ${ctx.companyName ?? "unknown"}${ctx.companyIndustry ? ` — ${ctx.companyIndustry}` : ""}`,
    "",
    "Recent activity (most recent first):",
    ...(ctx.activities.length > 0
      ? ctx.activities.map(formatActivity)
      : ["(no activity recorded)"]),
    "</CRM_DATA>",
  ];
  return lines.join("\n");
}
