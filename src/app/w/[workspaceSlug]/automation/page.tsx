import { AutomationRulesPanel } from "@/components/dashboard/automation-rules-panel";

export default function AutomationPage() {
  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold text-zinc-900">Automation rules</h1>
      <p className="mb-6 text-sm text-zinc-500">
        Tune the thresholds the pipeline health engine uses to flag deals, or turn a detector off
        for this workspace. Rules only ever create recommendations for review — they never execute
        actions automatically.
      </p>
      <AutomationRulesPanel />
    </div>
  );
}
