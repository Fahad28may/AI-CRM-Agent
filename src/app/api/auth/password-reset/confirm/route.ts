import { db } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { resetPasswordSchema } from "@/lib/validation/auth";
import { jsonError, jsonOk } from "@/lib/api-response";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = resetPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid input", 400);
  }
  const { token, password } = parsed.data;

  const resetToken = await db.passwordResetToken.findUnique({ where: { token } });
  if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
    return jsonError("This reset link is invalid or has expired.", 400);
  }

  const passwordHash = await hashPassword(password);

  await db.$transaction([
    db.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash },
    }),
    db.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: new Date() },
    }),
  ]);

  return jsonOk({ message: "Password updated. You can now log in." });
}
