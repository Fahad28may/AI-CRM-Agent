import { MembersPanel } from "@/components/dashboard/members-panel";

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-zinc-900">Settings</h1>
      <MembersPanel />
    </div>
  );
}
