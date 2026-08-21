"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<Card>Loading…</Card>}>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/auth/password-reset/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong.");
      return;
    }
    setDone(true);
    setTimeout(() => router.push("/login"), 1500);
  }

  if (!token) {
    return (
      <Card>
        <p className="text-sm text-zinc-600">Missing reset token.</p>
        <Link href="/forgot-password" className="mt-2 inline-block text-sm underline">
          Request a new link
        </Link>
      </Card>
    );
  }

  return (
    <Card>
      <h1 className="text-base font-semibold text-zinc-900">Choose a new password</h1>
      {done ? (
        <p className="mt-4 text-sm text-zinc-600">Password updated. Redirecting to login…</p>
      ) : (
        <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-3">
          <Input
            type="password"
            placeholder="New password (min 10 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={10}
            required
          />
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <Button type="submit" disabled={loading}>
            {loading ? "Updating…" : "Update password"}
          </Button>
        </form>
      )}
    </Card>
  );
}
