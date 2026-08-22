import { createHmac, randomBytes, timingSafeEqual } from "crypto";

const STATE_TTL_MS = 10 * 60 * 1000;

type StatePayload = {
  workspaceId: string;
  userId: string;
  nonce: string;
  expiresAt: number;
};

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return secret;
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

/** Signed, expiring CSRF state for an OAuth redirect — no DB round trip needed to verify it. */
export function createOAuthState(workspaceId: string, userId: string): string {
  const payload: StatePayload = {
    workspaceId,
    userId,
    nonce: randomBytes(16).toString("hex"),
    expiresAt: Date.now() + STATE_TTL_MS,
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = sign(payloadB64);
  return `${payloadB64}.${signature}`;
}

export function verifyOAuthState(state: string): StatePayload | null {
  const [payloadB64, signature] = state.split(".");
  if (!payloadB64 || !signature) return null;

  const expectedSignature = sign(payloadB64);
  const a = Buffer.from(signature);
  const b = Buffer.from(expectedSignature);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString()) as StatePayload;
    if (payload.expiresAt < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
