import { Suspense } from "react";
import { CrmConnectionPanel } from "@/components/dashboard/crm-connection-panel";

export default function IntegrationsPage() {
  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold text-zinc-900">Integrations</h1>
      <Suspense fallback={null}>
        <CrmConnectionPanel />
      </Suspense>
    </div>
  );
}
