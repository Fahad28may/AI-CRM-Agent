import { EmptyState } from "@/components/ui/empty-state";

export default function AIActivityPage() {
  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold text-zinc-900">AI activity</h1>
      <EmptyState
        title="No AI activity yet"
        description="Every recommendation, approval, and executed action will be logged here for full transparency."
      />
    </div>
  );
}
