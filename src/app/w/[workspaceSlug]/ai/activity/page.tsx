import Link from "next/link";
import { db } from "@/lib/db";
import { getWorkspaceBySlug } from "@/lib/workspace-server";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ActionStatus } from "@/generated/prisma/enums";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "completed", label: "Completed" },
  { key: "failed", label: "Failed" },
] as const;

const STATUS_BY_FILTER: Record<string, ActionStatus[]> = {
  approved: [ActionStatus.APPROVED, ActionStatus.EXECUTING],
  rejected: [ActionStatus.REJECTED],
  completed: [ActionStatus.COMPLETED],
  failed: [ActionStatus.FAILED],
};

const STATUS_STYLES: Record<ActionStatus, string> = {
  PROPOSED: "bg-zinc-100 text-zinc-600",
  APPROVED: "bg-blue-100 text-blue-800",
  REJECTED: "bg-zinc-100 text-zinc-600",
  EXECUTING: "bg-blue-100 text-blue-800",
  COMPLETED: "bg-green-100 text-green-800",
  FAILED: "bg-red-100 text-red-800",
  CANCELLED: "bg-zinc-100 text-zinc-600",
};

export default async function AIActivityPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceSlug: string }>;
  searchParams: Promise<{ filter?: string }>;
}) {
  const { workspaceSlug } = await params;
  const { filter = "all" } = await searchParams;
  const workspace = await getWorkspaceBySlug(workspaceSlug);

  const actions = workspace
    ? await db.action.findMany({
        where: {
          workspaceId: workspace.id,
          ...(STATUS_BY_FILTER[filter] ? { status: { in: STATUS_BY_FILTER[filter] } } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: 100,
        include: {
          recommendation: { include: { deal: { select: { name: true } } } },
          approval: { include: { user: { select: { name: true, email: true } } } },
        },
      })
    : [];

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold text-zinc-900">AI activity</h1>

      <div className="mb-6 flex gap-2 border-b border-zinc-200">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={f.key === "all" ? `/w/${workspaceSlug}/ai/activity` : `/w/${workspaceSlug}/ai/activity?filter=${f.key}`}
            className={`border-b-2 px-3 py-2 text-sm font-medium ${
              filter === f.key
                ? "border-zinc-900 text-zinc-900"
                : "border-transparent text-zinc-500 hover:text-zinc-700"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {actions.length === 0 ? (
        <EmptyState
          title="No AI activity yet"
          description="Every recommendation you approve or reject — with the CRM record, result, and who decided it — will be logged here for full transparency."
        />
      ) : (
        <div className="flex max-w-3xl flex-col gap-3">
          {actions.map((action) => (
            <Card key={action.id}>
              <div className="flex items-center justify-between gap-4">
                <p className="font-medium text-zinc-900">
                  {action.recommendation?.deal?.name ?? `${action.targetRecordType} ${action.targetRecordId}`}
                </p>
                <span
                  className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[action.status]}`}
                >
                  {action.status}
                </span>
              </div>

              <p className="mt-2 text-sm text-zinc-700">
                {summarizeAction(action.type, action.payload)}
              </p>

              {action.resultSummary ? (
                <p className="mt-2 text-sm text-zinc-500">{action.resultSummary}</p>
              ) : null}
              {action.errorMessage ? (
                <p className="mt-2 text-sm text-red-600">{action.errorMessage}</p>
              ) : null}

              <div className="mt-3 flex items-center justify-between border-t border-zinc-100 pt-3 text-xs text-zinc-500">
                <span>
                  {action.approval
                    ? `${action.approval.decision === "APPROVED" ? "Approved" : "Rejected"} by ${
                        action.approval.user.name ?? action.approval.user.email
                      }`
                    : "Awaiting decision"}
                </span>
                <span>{action.createdAt.toLocaleString()}</span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function summarizeAction(type: string, payload: unknown): string {
  const p = payload as Record<string, unknown>;
  switch (type) {
    case "SEND_EMAIL":
      return `Send email: "${p.subject}"`;
    case "CREATE_TASK":
      return `Create task: "${p.subject}"`;
    case "UPDATE_FIELD":
      return `Update ${p.field} to ${p.value}`;
    case "CHANGE_STAGE":
      return `Move to stage "${p.newStage}"`;
    default:
      return type;
  }
}
