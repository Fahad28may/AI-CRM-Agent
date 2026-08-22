import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import type { RiskLevel } from "@/generated/prisma/enums";

const RISK_STYLES: Record<RiskLevel, string> = {
  LOW: "bg-zinc-100 text-zinc-600",
  MEDIUM: "bg-amber-100 text-amber-800",
  HIGH: "bg-red-100 text-red-800",
};

type ProposedAction =
  | { type: "SEND_EMAIL"; subject: string; body: string }
  | { type: "CREATE_TASK"; subject: string; body?: string; dueInDays: number }
  | { type: "UPDATE_FIELD"; field: string; value: string }
  | { type: "CHANGE_STAGE"; newStage: string };

export type RecommendationListItem = {
  id: string;
  dealName: string | null;
  reasoning: string;
  evidence: unknown;
  proposedAction: unknown;
  confidence: number;
  riskLevel: RiskLevel;
  createdAt: Date;
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

function evidenceList(evidence: unknown): string[] {
  return Array.isArray(evidence) ? evidence.filter((e): e is string => typeof e === "string") : [];
}

export function RecommendationList({ recommendations }: { recommendations: RecommendationListItem[] }) {
  if (recommendations.length === 0) {
    return (
      <EmptyState
        title="No recommendations yet"
        description="AI-generated recommendations — with evidence and a proposed action — will appear here after the next pipeline analysis runs. Approving and executing them is coming in a later phase; for now this is a read-only preview."
      />
    );
  }

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      {recommendations.map((rec) => (
        <Card key={rec.id}>
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

          <div className="mt-4 flex items-center justify-between border-t border-zinc-100 pt-3 text-xs text-zinc-500">
            <span className="font-medium text-zinc-700">{summarizeAction(rec.proposedAction)}</span>
            <span>{Math.round(rec.confidence * 100)}% confidence</span>
          </div>
        </Card>
      ))}
    </div>
  );
}
