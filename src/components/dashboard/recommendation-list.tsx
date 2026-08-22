"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useWorkspace } from "@/lib/workspace-context";
import type { ActionStatus, RiskLevel } from "@/generated/prisma/enums";
import type { ProposedAction } from "@/lib/ai/schemas";

const RISK_STYLES: Record<RiskLevel, string> = {
  LOW: "bg-zinc-100 text-zinc-600",
  MEDIUM: "bg-amber-100 text-amber-800",
  HIGH: "bg-red-100 text-red-800",
};

const ACTION_STATUS_STYLES: Record<ActionStatus, string> = {
  PROPOSED: "bg-zinc-100 text-zinc-600",
  APPROVED: "bg-blue-100 text-blue-800",
  REJECTED: "bg-zinc-100 text-zinc-600",
  EXECUTING: "bg-blue-100 text-blue-800",
  COMPLETED: "bg-green-100 text-green-800",
  FAILED: "bg-red-100 text-red-800",
  CANCELLED: "bg-zinc-100 text-zinc-600",
};

export type RecommendationListItem = {
  id: string;
  dealName: string | null;
  reasoning: string;
  evidence: unknown;
  proposedAction: unknown;
  confidence: number;
  riskLevel: RiskLevel;
  createdAt: Date;
  latestAction: {
    id: string;
    status: ActionStatus;
    resultSummary: string | null;
    errorMessage: string | null;
    payload: unknown;
  } | null;
};

function summarizeAction(action: unknown): string {
  const a = action as ProposedAction;
  switch (a?.type) {
    case "SEND_EMAIL":
      return `Send email: "${a.subject}"`;
    case "CREATE_TASK":
      return `Create task: "${a.subject}" (due in ${a.dueInDays}d)`;
    case "UPDATE_FIELD":
      return `Update ${a.field} to ${a.value}`;
    case "CHANGE_STAGE":
      return `Move to stage "${a.newStage}"`;
    default:
      return "Proposed action";
  }
}

function actionStatusLabel(action: RecommendationListItem["latestAction"]): string {
  if (!action) return "";
  switch (action.status) {
    case "APPROVED":
      return "Approved — executing…";
    case "EXECUTING":
      return "Executing…";
    case "COMPLETED":
      return action.resultSummary ? `Completed: ${action.resultSummary}` : "Completed";
    case "FAILED":
      return action.errorMessage ? `Failed: ${action.errorMessage}` : "Failed";
    case "REJECTED":
      return "Rejected";
    default:
      return action.status;
  }
}

function evidenceList(evidence: unknown): string[] {
  return Array.isArray(evidence) ? evidence.filter((e): e is string => typeof e === "string") : [];
}

export function RecommendationList({ recommendations }: { recommendations: RecommendationListItem[] }) {
  if (recommendations.length === 0) {
    return (
      <EmptyState
        title="No recommendations yet"
        description="AI-generated recommendations — with evidence and a proposed action — will appear here after the next pipeline analysis runs. Review the evidence, then approve or reject the proposed action."
      />
    );
  }

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      {recommendations.map((rec) => (
        <RecommendationCard key={rec.id} recommendation={rec} />
      ))}
    </div>
  );
}

function RecommendationCard({ recommendation: rec }: { recommendation: RecommendationListItem }) {
  const workspace = useWorkspace();
  const router = useRouter();
  const [latestAction, setLatestAction] = useState(rec.latestAction);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ProposedAction>(rec.proposedAction as ProposedAction);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refreshAfterExecution() {
    router.refresh();
    // Execution runs in the background right after the approve response —
    // one follow-up refresh a couple seconds later picks up the terminal
    // COMPLETED/FAILED status without the user having to reload manually.
    setTimeout(() => router.refresh(), 2500);
  }

  async function approve() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/workspaces/${workspace.id}/recommendations/${rec.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing ? { proposedAction: draft } : {}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to approve");
      setLatestAction(data.action);
      setEditing(false);
      refreshAfterExecution();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to approve");
    } finally {
      setBusy(false);
    }
  }

  async function reject() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/workspaces/${workspace.id}/recommendations/${rec.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to reject");
      setLatestAction(data.action);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to reject");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <div className="flex items-center justify-between gap-4">
        <p className="font-medium text-zinc-900">{rec.dealName ?? "Untitled deal"}</p>
        <span
          className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${RISK_STYLES[rec.riskLevel]}`}
        >
          {rec.riskLevel} risk
        </span>
      </div>

      <p className="mt-2 whitespace-pre-line text-sm text-zinc-700">{rec.reasoning}</p>

      {evidenceList(rec.evidence).length > 0 ? (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-zinc-500">
          {evidenceList(rec.evidence).map((point, i) => (
            <li key={i}>{point}</li>
          ))}
        </ul>
      ) : null}

      <div className="mt-4 border-t border-zinc-100 pt-3">
        {editing ? (
          <EditForm draft={draft} onChange={setDraft} />
        ) : (
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span className="font-medium text-zinc-700">
              {summarizeAction(latestAction?.payload ?? rec.proposedAction)}
            </span>
            <span>{Math.round(rec.confidence * 100)}% confidence</span>
          </div>
        )}

        {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}

        {latestAction ? (
          <p
            className={`mt-3 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${ACTION_STATUS_STYLES[latestAction.status]}`}
          >
            {actionStatusLabel(latestAction)}
          </p>
        ) : (
          <div className="mt-3 flex items-center gap-2">
            {editing ? (
              <>
                <Button onClick={approve} disabled={busy}>
                  Save & approve
                </Button>
                <Button variant="secondary" onClick={() => setEditing(false)} disabled={busy}>
                  Cancel
                </Button>
              </>
            ) : (
              <>
                <Button onClick={approve} disabled={busy}>
                  Approve
                </Button>
                <Button variant="secondary" onClick={() => setEditing(true)} disabled={busy}>
                  Edit
                </Button>
                <Button variant="danger" onClick={reject} disabled={busy}>
                  Reject
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

function EditForm({
  draft,
  onChange,
}: {
  draft: ProposedAction;
  onChange: (next: ProposedAction) => void;
}) {
  switch (draft.type) {
    case "SEND_EMAIL":
      return (
        <div className="flex flex-col gap-2">
          <Input
            value={draft.subject}
            onChange={(e) => onChange({ ...draft, subject: e.target.value })}
            placeholder="Subject"
          />
          <Textarea
            value={draft.body}
            onChange={(e) => onChange({ ...draft, body: e.target.value })}
            rows={5}
            placeholder="Email body"
          />
        </div>
      );
    case "CREATE_TASK":
      return (
        <div className="flex flex-col gap-2">
          <Input
            value={draft.subject}
            onChange={(e) => onChange({ ...draft, subject: e.target.value })}
            placeholder="Task subject"
          />
          <Textarea
            value={draft.body ?? ""}
            onChange={(e) => onChange({ ...draft, body: e.target.value })}
            rows={3}
            placeholder="Task details"
          />
          <Input
            type="number"
            min={0}
            max={30}
            value={draft.dueInDays}
            onChange={(e) => onChange({ ...draft, dueInDays: Number(e.target.value) })}
            placeholder="Due in days"
          />
        </div>
      );
    case "UPDATE_FIELD":
      return (
        <Input
          value={draft.value}
          onChange={(e) => onChange({ ...draft, value: e.target.value })}
          placeholder={draft.field === "closeDate" ? "YYYY-MM-DD" : "New amount"}
        />
      );
    case "CHANGE_STAGE":
      return (
        <Input
          value={draft.newStage}
          onChange={(e) => onChange({ ...draft, newStage: e.target.value })}
          placeholder="New stage"
        />
      );
  }
}
