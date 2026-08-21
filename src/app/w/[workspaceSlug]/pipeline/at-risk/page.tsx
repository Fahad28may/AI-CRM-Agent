import { EmptyState } from "@/components/ui/empty-state";

export default function AtRiskDealsPage() {
  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold text-zinc-900">At risk</h1>
      <EmptyState
        title="No at-risk deals detected"
        description="The pipeline health engine checks for stagnation, missing follow-ups, and other risk signals after each sync. Nothing to flag yet."
      />
    </div>
  );
}
