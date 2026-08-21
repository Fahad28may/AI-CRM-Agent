"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

const STEPS = [
  { title: "Create workspace", active: true },
  { title: "Connect HubSpot", active: false },
  { title: "Import CRM data", active: false },
  { title: "Configure sales rules", active: false },
  { title: "Run first analysis", active: false },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/workspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Something went wrong.");
      return;
    }
    router.push(`/w/${data.workspace.slug}/dashboard`);
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-1 flex-col justify-center px-4 py-16">
      <h1 className="text-xl font-semibold text-zinc-900">Welcome to AI CRM Agent</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Let&apos;s get your workspace set up. This only takes a minute.
      </p>

      <ol className="mt-8 flex flex-wrap gap-2 text-xs">
        {STEPS.map((step, i) => (
          <li
            key={step.title}
            className={`rounded-full px-3 py-1 ${
              step.active
                ? "bg-zinc-900 text-white"
                : "bg-zinc-100 text-zinc-400"
            }`}
          >
            {i + 1}. {step.title}
          </li>
        ))}
      </ol>

      <Card className="mt-6">
        <h2 className="text-sm font-semibold text-zinc-900">Name your workspace</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Usually your company or sales team name. You can change this later.
        </p>
        <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-3 sm:flex-row">
          <Input
            placeholder="Acme Sales Team"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <Button type="submit" disabled={loading}>
            {loading ? "Creating…" : "Create workspace"}
          </Button>
        </form>
        {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      </Card>
    </div>
  );
}
