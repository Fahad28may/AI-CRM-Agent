import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function IntegrationsPage() {
  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold text-zinc-900">Integrations</h1>
      <Card className="max-w-md">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-zinc-900">HubSpot</p>
            <p className="text-sm text-zinc-500">Not connected</p>
          </div>
          <Button disabled title="HubSpot OAuth ships in the next phase">
            Connect
          </Button>
        </div>
      </Card>
    </div>
  );
}
