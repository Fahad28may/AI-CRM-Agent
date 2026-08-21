import { EmptyState } from "@/components/ui/empty-state";

export default function RecommendationsPage() {
  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold text-zinc-900">Recommendations</h1>
      <EmptyState
        title="No recommendations yet"
        description="AI-generated recommendations — with evidence and a proposed action — will appear here for your review and approval."
      />
    </div>
  );
}
