import { db } from "@/lib/db";
import { generateSecureToken, tokenExpiry } from "@/lib/tokens";
import { sendEmail } from "@/lib/email";
import { requestPasswordResetSchema } from "@/lib/validation/auth";
import { jsonError, jsonOk } from "@/lib/api-response";
import { checkRateLimit, requestIp } from "@/lib/rate-limit";

const GENERIC_MESSAGE = "If that email has an account, a reset link has been sent.";

export async function POST(request: Request) {
  const rate = checkRateLimit(`password-reset:${requestIp(request)}`, {
    limit: 5,
    windowMs: 10 * 60 * 1000,
  });
  if (!rate.allowed) {
    return jsonError("Too many requests. Try again later.", 429);
  }

  const body = await request.json().catch(() => null);
  const parsed = requestPasswordResetSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid input", 400);
  }

  const user = await db.user.findUnique({ where: { email: parsed.data.email } });
  if (!user) {
    return jsonOk({ message: GENERIC_MESSAGE });
  }

  const token = generateSecureToken();
  await db.passwordResetToken.create({
    data: { userId: user.id, token, expiresAt: tokenExpiry(60) },
  });

  const resetUrl = `${process.env.APP_URL ?? "http://localhost:3000"}/reset-password?token=${token}`;
  await sendEmail({
    to: user.email,
    subject: "Reset your password",
    html: `<p>Reset your password:</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>This link expires in 1 hour.</p>`,
  });

  return jsonOk({ message: GENERIC_MESSAGE });
}
