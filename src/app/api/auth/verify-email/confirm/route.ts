import { db } from "@/lib/db";
import { confirmEmailVerificationSchema } from "@/lib/validation/auth";
import { jsonError, jsonOk } from "@/lib/api-response";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = confirmEmailVerificationSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid input", 400);
  }

  const verificationToken = await db.verificationToken.findUnique({
    where: { token: parsed.data.token },
  });
  if (!verificationToken || verificationToken.expires < new Date()) {
    return jsonError("This verification link is invalid or has expired.", 400);
  }

  await db.$transaction([
    db.user.update({
      where: { email: verificationToken.identifier },
      data: { emailVerified: new Date() },
    }),
    db.verificationToken.delete({
      where: { token: verificationToken.token },
    }),
  ]);

  return jsonOk({ message: "Email verified." });
}
