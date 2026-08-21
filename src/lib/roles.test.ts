import { describe, expect, it } from "vitest";
import { roleAtLeast } from "@/lib/roles";
import { WorkspaceRole } from "@/generated/prisma/enums";

describe("roleAtLeast", () => {
  it("ranks OWNER above every other role", () => {
    expect(roleAtLeast(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)).toBe(true);
    expect(roleAtLeast(WorkspaceRole.OWNER, WorkspaceRole.SALES_REP)).toBe(true);
  });

  it("ranks SALES_REP below every other role", () => {
    expect(roleAtLeast(WorkspaceRole.SALES_REP, WorkspaceRole.MANAGER)).toBe(false);
    expect(roleAtLeast(WorkspaceRole.SALES_REP, WorkspaceRole.ADMIN)).toBe(false);
    expect(roleAtLeast(WorkspaceRole.SALES_REP, WorkspaceRole.OWNER)).toBe(false);
  });

  it("treats equal roles as satisfying the minimum", () => {
    expect(roleAtLeast(WorkspaceRole.MANAGER, WorkspaceRole.MANAGER)).toBe(true);
  });

  it("does not let a lower role satisfy a higher minimum", () => {
    expect(roleAtLeast(WorkspaceRole.MANAGER, WorkspaceRole.ADMIN)).toBe(false);
  });
});
