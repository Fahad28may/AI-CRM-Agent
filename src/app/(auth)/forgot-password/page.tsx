"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await fetch("/api/auth/password-reset/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setLoading(false);
    setSent(true);
  }

  return (
    <Card>
      <h1 className="text-base font-semibold text-zinc-900">Reset your password</h1>
      {sent ? (
        <p className="mt-4 text-sm text-zinc-600">
          If that email has an account, we sent a reset link to it.
        </p>
      ) : (
        <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-3">
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Button type="submit" disabled={loading}>
            {loading ? "Sending…" : "Send reset link"}
          </Button>
        </form>
      )}
      <Link href="/login" className="mt-4 inline-block text-sm text-zinc-500 hover:text-zinc-700">
        Back to login
      </Link>
    </Card>
  );
}
