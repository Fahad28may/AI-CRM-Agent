import { EmptyState } from "@/components/ui/empty-state";

export default function AutomationPage() {
  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold text-zinc-900">Automation rules</h1>
      <EmptyState
        title="No automation rules yet"
        description={'Configure rules like "if a deal is inactive for 7 days, generate a follow-up recommendation." Rules create recommendations for review — they never execute actions automatically.'}
      />
    </div>
  );
}
