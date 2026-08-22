"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useWorkspace } from "@/lib/workspace-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { WorkspaceRole } from "@/generated/prisma/enums";
import { roleAtLeast } from "@/lib/roles";

type Connection = {
  id: string;
  provider: string;
  status: "CONNECTED" | "DISCONNECTED" | "ERROR" | "EXPIRED";
  lastSyncedAt: string | null;
  lastSyncError: string | null;
  createdAt: string;
};

const STATUS_STYLES: Record<Connection["status"], string> = {
  CONNECTED: "bg-green-100 text-green-800",
  DISCONNECTED: "bg-zinc-100 text-zinc-600",
  ERROR: "bg-red-100 text-red-800",
  EXPIRED: "bg-amber-100 text-amber-800",
};

const CALLBACK_MESSAGES: Record<string, { tone: "success" | "error"; text: string }> = {
  connected: { tone: "success", text: "HubSpot connected successfully." },
  error: { tone: "error", text: "Something went wrong connecting to HubSpot. Please try again." },
  invalid_state: { tone: "error", text: "That connection attempt expired or was invalid. Please try again." },
  unauthorized: { tone: "error", text: "You need to be a workspace admin to connect HubSpot." },
};

export function CrmConnectionPanel() {
  const workspace = useWorkspace();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [connection, setConnection] = useState<Connection | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  // Set synchronously from the initial render (not an effect) when we've
  // just landed back from the OAuth redirect — the backend already
  // enqueued a CRM_SYNC job in that case, so polling should start
  // immediately rather than waiting a render cycle.
  const [syncStartedAt, setSyncStartedAt] = useState<number | null>(() =>
    searchParams.get("hubspot") === "connected" ? Date.now() : null,
  );

  const load = useCallback(async () => {
    const res = await fetch(`/api/workspaces/${workspace.id}/crm-connection`);
    if (res.ok) {
      const data = await res.json();
      setConnection(data.connection);
    }
  }, [workspace.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const callbackResult = searchParams.get("hubspot");
  useEffect(() => {
    if (!callbackResult) return;
    const url = new URL(window.location.href);
    url.searchParams.delete("hubspot");
    router.replace(url.pathname + url.search);
  }, [callbackResult, router]);

  // There's no dedicated "syncing" connection status, so a fresher
  // lastSyncedAt/lastSyncError than the moment we started is the signal
  // that the background job finished — derived here rather than tracked
  // as separate state that an effect would need to reconcile.
  const syncing =
    syncStartedAt !== null &&
    !(
      connection?.lastSyncError != null ||
      (connection?.lastSyncedAt != null && new Date(connection.lastSyncedAt).getTime() >= syncStartedAt)
    );

  useEffect(() => {
    if (!syncing) return;
    const interval = setInterval(load, 2500);
    const timeout = setTimeout(() => setSyncStartedAt(null), 60_000);
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [syncing, load]);

  async function disconnect() {
    setBusy(true);
    await fetch(`/api/workspaces/${workspace.id}/crm-connection`, { method: "DELETE" });
    setBusy(false);
    load();
  }

  async function triggerSync() {
    setSyncStartedAt(Date.now());
    await fetch(`/api/workspaces/${workspace.id}/crm-connection/sync`, { method: "POST" });
    load();
  }

  const canManage = roleAtLeast(workspace.role, WorkspaceRole.ADMIN);
  const banner = callbackResult ? CALLBACK_MESSAGES[callbackResult] : null;
  const isConnected = connection?.status === "CONNECTED";

  return (
    <div className="flex flex-col gap-4">
      {banner ? (
        <p
          className={`rounded-md px-4 py-2 text-sm ${
            banner.tone === "success" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"
          }`}
        >
          {banner.text}
        </p>
      ) : null}

      <Card className="max-w-md">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-zinc-900">HubSpot</p>
            {connection ? (
              <span
                className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[connection.status]}`}
              >
                {connection.status}
              </span>
            ) : (
              <p className="text-sm text-zinc-500">Not connected</p>
            )}
          </div>

          {isConnected ? (
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                disabled={!canManage || syncing}
                onClick={triggerSync}
                title={canManage ? undefined : "Only workspace admins can trigger a sync"}
              >
                {syncing ? "Syncing…" : "Sync now"}
              </Button>
              <Button
                variant="danger"
                disabled={!canManage || busy}
                onClick={disconnect}
                title={canManage ? undefined : "Only workspace admins can disconnect HubSpot"}
              >
                Disconnect
              </Button>
            </div>
          ) : canManage ? (
            <Link href={`/api/crm/hubspot/connect?workspaceId=${workspace.id}`}>
              <Button>Connect</Button>
            </Link>
          ) : (
            <Button disabled title="Only workspace admins can connect HubSpot">
              Connect
            </Button>
          )}
        </div>

        {connection?.lastSyncedAt ? (
          <p className="mt-4 text-xs text-zinc-500">
            Last synced {new Date(connection.lastSyncedAt).toLocaleString()}
          </p>
        ) : null}
        {connection?.lastSyncError ? (
          <p className="mt-2 text-xs text-red-600">Last sync error: {connection.lastSyncError}</p>
        ) : null}
      </Card>
    </div>
  );
}
