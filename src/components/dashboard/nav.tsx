"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = { label: string; href: string };
type NavGroup = { label?: string; items: NavItem[] };

function groups(base: string): NavGroup[] {
  return [
    { items: [{ label: "Dashboard", href: `${base}/dashboard` }] },
    {
      label: "Pipeline",
      items: [
        { label: "Deals", href: `${base}/pipeline` },
        { label: "At Risk", href: `${base}/pipeline/at-risk` },
        { label: "Stale", href: `${base}/pipeline/stale` },
      ],
    },
    {
      label: "AI",
      items: [
        { label: "Recommendations", href: `${base}/ai/recommendations` },
        { label: "Activity", href: `${base}/ai/activity` },
      ],
    },
    {
      items: [
        { label: "Automation", href: `${base}/automation` },
        { label: "Integrations", href: `${base}/integrations` },
        { label: "Settings", href: `${base}/settings` },
      ],
    },
  ];
}

export function DashboardNav({ workspaceSlug }: { workspaceSlug: string }) {
  const pathname = usePathname();
  const base = `/w/${workspaceSlug}`;

  return (
    <nav className="flex w-56 shrink-0 flex-col gap-6 border-r border-zinc-200 bg-white px-4 py-6">
      {groups(base).map((group, i) => (
        <div key={i}>
          {group.label ? (
            <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
              {group.label}
            </p>
          ) : null}
          <div className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== base + "/dashboard" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-md px-2 py-1.5 text-sm ${
                    active
                      ? "bg-zinc-100 font-medium text-zinc-900"
                      : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
