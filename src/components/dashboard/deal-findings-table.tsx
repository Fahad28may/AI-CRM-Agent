"use client";

import { useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useWorkspace } from "@/lib/workspace-context";
import { findingLabel } from "@/lib/pipeline/finding-labels";
import type { PipelineDeal } from "@/lib/pipeline/summary";
import type { Severity } from "@/generated/prisma/enums";

const SEVERITY_STYLES: Record<Severity, string> = {
  LOW: "bg-zinc-100 text-zinc-600",
  MEDIUM: "bg-amber-100 text-amber-800",
  HIGH: "bg-orange-100 text-orange-800",
  CRITICAL: "bg-red-100 text-red-800",
};

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function lastActivityLabel(date: Date | null): string {
  if (!date) return "No activity recorded";
  const days = Math.floor((Date.now() - date.getTime()) / (24 * 60 * 60 * 1000));
  if (days <= 0) return "Active today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

export function DealFindingsTable({
  deals,
  emptyTitle,
  emptyDescription,
}: {
  deals: PipelineDeal[];
  emptyTitle: string;
  emptyDescription: string;
}) {
  if (deals.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <Card className="max-w-3xl divide-y divide-zinc-100 p-0">
      {deals.map((deal) => (
        <DealRow key={deal.id} deal={deal} />
      ))}
    </Card>
  );
}

function DealRow({ deal }: { deal: PipelineDeal }) {
  const workspace = useWorkspace();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/workspaces/${workspace.id}/deals/${deal.id}/follow-up`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to generate follow-up");
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate follow-up");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 px-6 py-4">
      <div className="flex items-center justify-between gap-4">
        <p className="font-medium text-zinc-900">{deal.name ?? "Untitled deal"}</p>
        <p className="whitespace-nowrap text-sm text-zinc-500">
          {deal.amount !== null ? currencyFormatter.format(deal.amount) : "No amount"}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
        {deal.stage ? <span className="rounded-full bg-zinc-100 px-2 py-0.5">{deal.stage}</span> : null}
        <span>{lastActivityLabel(deal.lastActivityAt)}</span>
      </div>
      {deal.findings.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {deal.findings.map((finding) => (
            <span
              key={finding.type}
              title={finding.explanation}
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${SEVERITY_STYLES[finding.severity]}`}
            >
              {findingLabel(finding.type)}
            </span>
          ))}
        </div>
      ) : null}

      {done ? (
        <p className="text-xs text-zinc-500">
          Draft generated —{" "}
          <Link href={`/w/${workspace.slug}/ai/recommendations`} className="underline hover:text-zinc-700">
            review it in Recommendations
          </Link>
          .
        </p>
      ) : open ? (
        <div className="mt-1 flex flex-col gap-2">
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why does this deal need a follow-up? (e.g. no reply since the pricing call)"
            rows={2}
          />
          {error ? <p className="text-xs text-red-600">{error}</p> : null}
          <div className="flex gap-2">
            <Button onClick={generate} disabled={busy || reason.trim().length === 0}>
              {busy ? "Generating…" : "Generate"}
            </Button>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="secondary" className="w-fit" onClick={() => setOpen(true)}>
          Generate follow-up
        </Button>
      )}
    </div>
  );
}
