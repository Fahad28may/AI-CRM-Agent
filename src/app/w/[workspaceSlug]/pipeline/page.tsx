import { EmptyState } from "@/components/ui/empty-state";

export default function PipelineDealsPage() {
  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold text-zinc-900">Deals</h1>
      <EmptyState
        title="No deals synced yet"
        description="Deals will appear here once HubSpot is connected and the first sync completes."
      />
    </div>
  );
}
