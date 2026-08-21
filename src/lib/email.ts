/**
 * Placeholder email sender. Swap the implementation for a real provider
 * (Resend, Postmark, SES, ...) later — every call site already goes through
 * this single function so that change stays contained to this file.
 */
export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  if (process.env.NODE_ENV !== "production") {
    console.log(`[email:dev] to=${params.to} subject="${params.subject}"\n${params.html}`);
    return;
  }
  console.warn("[email] no email provider configured; dropping email", {
    to: params.to,
    subject: params.subject,
  });
}
