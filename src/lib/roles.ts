import type { WorkspaceRole } from "@/generated/prisma/enums";

const ROLE_RANK: Record<WorkspaceRole, number> = {
  SALES_REP: 0,
  MANAGER: 1,
  ADMIN: 2,
  OWNER: 3,
};

export function roleAtLeast(role: WorkspaceRole, minRole: WorkspaceRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minRole];
}
