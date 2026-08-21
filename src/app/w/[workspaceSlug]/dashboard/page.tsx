import Link from "next/link";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";

const HEALTH_TILES = [
  { label: "Healthy deals", value: "—" },
  { label: "At-risk deals", value: "—" },
  { label: "Stale deals", value: "—" },
  { label: "Needs action", value: "—" },
];

export default async function WorkspaceDashboardPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">Pipeline health</h1>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {HEALTH_TILES.map((tile) => (
            <Card key={tile.label}>
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                {tile.label}
              </p>
              <p className="mt-2 text-2xl font-semibold text-zinc-900">{tile.value}</p>
            </Card>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-base font-semibold text-zinc-900">AI recommendations</h2>
        <div className="mt-4">
          <EmptyState
            title="No recommendations yet"
            description="Connect HubSpot and run your first analysis to start seeing which deals need attention, evidence for why, and suggested next steps."
            action={
              <Link href={`/w/${workspaceSlug}/integrations`}>
                <Button>Connect HubSpot</Button>
              </Link>
            }
          />
        </div>
      </div>
    </div>
  );
}
