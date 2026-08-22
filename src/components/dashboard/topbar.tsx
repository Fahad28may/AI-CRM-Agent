"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { useWorkspace } from "@/lib/workspace-context";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "@/components/dashboard/notification-bell";

export function DashboardTopbar({ userEmail }: { userEmail: string }) {
  const workspace = useWorkspace();

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-6">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-zinc-900">AI CRM Agent</span>
        <span className="text-zinc-300">/</span>
        <Link href="/workspaces" className="text-sm text-zinc-600 hover:text-zinc-900">
          {workspace.name}
        </Link>
      </div>
      <div className="flex items-center gap-3">
        <NotificationBell />
        <span className="text-sm text-zinc-500">{userEmail}</span>
        <Button variant="ghost" onClick={() => signOut({ callbackUrl: "/login" })}>
          Log out
        </Button>
      </div>
    </header>
  );
}
