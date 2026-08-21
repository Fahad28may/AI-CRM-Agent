import { EmptyState } from "@/components/ui/empty-state";

export default function StaleDealsPage() {
  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold text-zinc-900">Stale</h1>
      <EmptyState
        title="No stale deals"
        description="Deals with no meaningful activity for an extended period will show up here."
      />
    </div>
  );
}
