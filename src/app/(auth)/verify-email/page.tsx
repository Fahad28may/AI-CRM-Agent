"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/card";

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<Card>Loading…</Card>}>
      <VerifyEmailStatus />
    </Suspense>
  );
}

function VerifyEmailStatus() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"pending" | "success" | "error">(
    token ? "pending" : "error",
  );

  useEffect(() => {
    if (!token) return;
    fetch("/api/auth/verify-email/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then((res) => setStatus(res.ok ? "success" : "error"))
      .catch(() => setStatus("error"));
  }, [token]);

  return (
    <Card>
      <h1 className="text-base font-semibold text-zinc-900">Email verification</h1>
      <p className="mt-2 text-sm text-zinc-600">
        {status === "pending" && "Verifying…"}
        {status === "success" && "Your email is verified."}
        {status === "error" && "This link is invalid or has expired."}
      </p>
      <Link href="/dashboard" className="mt-4 inline-block text-sm underline">
        Go to dashboard
      </Link>
    </Card>
  );
}
