"use client";

import { useCallback, useEffect, useState } from "react";
import { useWorkspace } from "@/lib/workspace-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WorkspaceRole } from "@/generated/prisma/enums";
import { roleAtLeast } from "@/lib/roles";

type Rule = {
  findingType: string;
  label: string;
  description: string;
  thresholdDays: number;
  isActive: boolean;
};

export function AutomationRulesPanel() {
  const workspace = useWorkspace();
  const canManage = roleAtLeast(workspace.role, WorkspaceRole.ADMIN);
  const [rules, setRules] = useState<Rule[] | null>(null);
  const [drafts, setDrafts] = useState<Record<string, number>>({});
  const [savingType, setSavingType] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/workspaces/${workspace.id}/automation-rules`);
    if (res.ok) {
      const data = await res.json();
      setRules(data.rules);
      setDrafts(Object.fromEntries(data.rules.map((r: Rule) => [r.findingType, r.thresholdDays])));
    }
  }, [workspace.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function save(findingType: string, isActive: boolean) {
    setSavingType(findingType);
    await fetch(`/api/workspaces/${workspace.id}/automation-rules/${findingType}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ thresholdDays: drafts[findingType], isActive }),
    });
    setSavingType(null);
    load();
  }

  if (!rules) return null;

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      {rules.map((rule) => (
        <Card key={rule.findingType}>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-medium text-zinc-900">{rule.label}</p>
              <p className="mt-1 text-sm text-zinc-500">{rule.description}</p>
            </div>
            <span
              className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${
                rule.isActive ? "bg-green-100 text-green-800" : "bg-zinc-100 text-zinc-600"
              }`}
            >
              {rule.isActive ? "Active" : "Disabled"}
            </span>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <Input
              type="number"
              min={1}
              max={90}
              className="w-24"
              disabled={!canManage}
              value={drafts[rule.findingType] ?? rule.thresholdDays}
              onChange={(e) =>
                setDrafts((d) => ({ ...d, [rule.findingType]: Number(e.target.value) }))
              }
            />
            <span className="text-sm text-zinc-500">days</span>

            <div className="ml-auto flex gap-2">
              <Button
                variant="secondary"
                disabled={!canManage || savingType === rule.findingType}
                onClick={() => save(rule.findingType, rule.isActive)}
                title={canManage ? undefined : "Only workspace admins can change automation rules"}
              >
                Save
              </Button>
              <Button
                variant={rule.isActive ? "danger" : "primary"}
                disabled={!canManage || savingType === rule.findingType}
                onClick={() => save(rule.findingType, !rule.isActive)}
                title={canManage ? undefined : "Only workspace admins can change automation rules"}
              >
                {rule.isActive ? "Disable" : "Enable"}
              </Button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
