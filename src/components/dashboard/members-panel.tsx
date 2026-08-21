"use client";

import { useEffect, useState, useCallback } from "react";
import { useWorkspace } from "@/lib/workspace-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WorkspaceRole } from "@/generated/prisma/enums";

type Member = {
  id: string;
  role: WorkspaceRole;
  user: { id: string; name: string | null; email: string };
};

const ROLES = Object.values(WorkspaceRole);
const canManage = (role: WorkspaceRole) => role === "OWNER" || role === "ADMIN";

export function MembersPanel() {
  const workspace = useWorkspace();
  const [members, setMembers] = useState<Member[] | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<WorkspaceRole>(WorkspaceRole.SALES_REP);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/workspaces/${workspace.id}/members`);
    if (res.ok) {
      const data = await res.json();
      setMembers(data.members);
    }
  }, [workspace.id]);

  useEffect(() => {
    // Data fetch on mount/dependency change — state is set inside `load`'s
    // async continuation, not synchronously in the effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function addMember(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await fetch(`/api/workspaces/${workspace.id}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong.");
      return;
    }
    setEmail("");
    load();
  }

  async function changeRole(memberId: string, newRole: WorkspaceRole) {
    await fetch(`/api/workspaces/${workspace.id}/members/${memberId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });
    load();
  }

  async function removeMember(memberId: string) {
    await fetch(`/api/workspaces/${workspace.id}/members/${memberId}`, { method: "DELETE" });
    load();
  }

  const canEdit = canManage(workspace.role);

  return (
    <Card>
      <h2 className="text-sm font-semibold text-zinc-900">Members</h2>

      <div className="mt-4 flex flex-col gap-2">
        {members?.map((m) => (
          <div key={m.id} className="flex items-center justify-between border-b border-zinc-100 py-2 last:border-0">
            <div>
              <p className="text-sm text-zinc-900">{m.user.name ?? m.user.email}</p>
              <p className="text-xs text-zinc-500">{m.user.email}</p>
            </div>
            <div className="flex items-center gap-2">
              {canEdit && m.role !== "OWNER" ? (
                <select
                  value={m.role}
                  onChange={(e) => changeRole(m.id, e.target.value as WorkspaceRole)}
                  className="rounded-md border border-zinc-300 px-2 py-1 text-xs"
                >
                  {ROLES.filter((r) => r !== "OWNER").map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="text-xs uppercase text-zinc-400">{m.role}</span>
              )}
              {canEdit && m.role !== "OWNER" ? (
                <Button variant="ghost" onClick={() => removeMember(m.id)}>
                  Remove
                </Button>
              ) : null}
            </div>
          </div>
        ))}
        {members?.length === 0 ? <p className="text-sm text-zinc-500">No members yet.</p> : null}
      </div>

      {canEdit ? (
        <form onSubmit={addMember} className="mt-4 flex flex-col gap-2 border-t border-zinc-100 pt-4 sm:flex-row">
          <Input
            type="email"
            placeholder="teammate@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as WorkspaceRole)}
            className="rounded-md border border-zinc-300 px-2 py-2 text-sm"
          >
            {ROLES.filter((r) => r !== "OWNER").map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <Button type="submit" disabled={busy}>
            Add
          </Button>
        </form>
      ) : null}
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      <p className="mt-2 text-xs text-zinc-400">
        Adding a member requires them to already have an AI CRM Agent account.
      </p>
    </Card>
  );
}
