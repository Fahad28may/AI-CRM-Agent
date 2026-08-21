import { db } from "@/lib/db";
import { generateSecureToken, tokenExpiry } from "@/lib/tokens";
import { sendEmail } from "@/lib/email";
import { requestEmailVerificationSchema } from "@/lib/validation/auth";
import { jsonError, jsonOk } from "@/lib/api-response";
import { checkRateLimit, requestIp } from "@/lib/rate-limit";

const GENERIC_MESSAGE = "If that account exists and isn't verified yet, a link has been sent.";

export async function POST(request: Request) {
  const rate = checkRateLimit(`verify-email:${requestIp(request)}`, {
    limit: 5,
    windowMs: 10 * 60 * 1000,
  });
  if (!rate.allowed) {
    return jsonError("Too many requests. Try again later.", 429);
  }

  const body = await request.json().catch(() => null);
  const parsed = requestEmailVerificationSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid input", 400);
  }

  const user = await db.user.findUnique({ where: { email: parsed.data.email } });
  if (!user || user.emailVerified) {
    return jsonOk({ message: GENERIC_MESSAGE });
  }

  const token = generateSecureToken();
  await db.verificationToken.create({
    data: { identifier: user.email, token, expires: tokenExpiry(60 * 24) },
  });

  const verifyUrl = `${process.env.APP_URL ?? "http://localhost:3000"}/verify-email?token=${token}`;
  await sendEmail({
    to: user.email,
    subject: "Verify your email",
    html: `<p>Confirm your email:</p><p><a href="${verifyUrl}">${verifyUrl}</a></p>`,
  });

  return jsonOk({ message: GENERIC_MESSAGE });
}
