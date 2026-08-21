"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong.");
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <Card>
        <h1 className="text-base font-semibold text-zinc-900">Check your email</h1>
        <p className="mt-2 text-sm text-zinc-600">
          We sent a verification link to <span className="font-medium">{email}</span>. You can log
          in now and verify later.
        </p>
        <Link href="/login" className="mt-4 inline-block text-sm text-zinc-900 underline">
          Go to login
        </Link>
      </Card>
    );
  }

  return (
    <Card>
      <h1 className="text-base font-semibold text-zinc-900">Create your account</h1>
      <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-3">
        <Input
          type="text"
          placeholder="Full name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <Input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Input
          type="password"
          placeholder="Password (min 10 characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={10}
          required
        />
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <Button type="submit" disabled={loading}>
          {loading ? "Creating account…" : "Create account"}
        </Button>
      </form>
      <div className="mt-4 text-sm text-zinc-500">
        Already have an account?{" "}
        <Link href="/login" className="text-zinc-900 hover:underline">
          Log in
        </Link>
      </div>
    </Card>
  );
}
