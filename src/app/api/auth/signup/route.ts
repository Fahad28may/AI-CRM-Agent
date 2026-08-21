import { db } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { generateSecureToken, tokenExpiry } from "@/lib/tokens";
import { sendEmail } from "@/lib/email";
import { signupSchema } from "@/lib/validation/auth";
import { jsonError, jsonOk } from "@/lib/api-response";
import { checkRateLimit, requestIp } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const rate = checkRateLimit(`signup:${requestIp(request)}`, {
    limit: 5,
    windowMs: 10 * 60 * 1000,
  });
  if (!rate.allowed) {
    return jsonError("Too many signup attempts. Try again later.", 429);
  }

  const body = await request.json().catch(() => null);
  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid input", 400);
  }
  const { name, email, password } = parsed.data;

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    // Same generic message regardless of whether the email exists, to
    // avoid leaking account existence.
    return jsonOk({ message: "If that email can be used, an account was created." });
  }

  const passwordHash = await hashPassword(password);
  const user = await db.user.create({
    data: { name, email, passwordHash },
  });

  const token = generateSecureToken();
  await db.verificationToken.create({
    data: { identifier: user.email, token, expires: tokenExpiry(60 * 24) },
  });

  const verifyUrl = `${process.env.APP_URL ?? "http://localhost:3000"}/verify-email?token=${token}`;
  await sendEmail({
    to: user.email,
    subject: "Verify your email",
    html: `<p>Confirm your email to finish setting up your account:</p><p><a href="${verifyUrl}">${verifyUrl}</a></p>`,
  });

  return jsonOk({ message: "Account created. Check your email to verify your address." }, 201);
}
