import { randomBytes } from "crypto";

export function generateSecureToken(): string {
  return randomBytes(32).toString("hex");
}

export function tokenExpiry(minutesFromNow: number): Date {
  return new Date(Date.now() + minutesFromNow * 60 * 1000);
}
