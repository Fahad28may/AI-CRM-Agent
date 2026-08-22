import { describe, expect, it } from "vitest";
import { roleAtLeast } from "@/lib/roles";
import { WorkspaceRole } from "@/generated/prisma/enums";

// roleAtLeast is the backend authorization primitive every requireWorkspaceMember
// call relies on (rule 5: never trust frontend authorization) — a regression
// here (e.g. a flipped comparison) is a silent privilege escalation bug.
describe("roleAtLeast", () => {
  it("is true when the role exactly matches the minimum", () => {
    expect(roleAtLeast(WorkspaceRole.ADMIN, WorkspaceRole.ADMIN)).toBe(true);
  });

  it("is true when the role outranks the minimum", () => {
    expect(roleAtLeast(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)).toBe(true);
    expect(roleAtLeast(WorkspaceRole.OWNER, WorkspaceRole.SALES_REP)).toBe(true);
  });

  it("is false when the role is below the minimum", () => {
    expect(roleAtLeast(WorkspaceRole.SALES_REP, WorkspaceRole.ADMIN)).toBe(false);
    expect(roleAtLeast(WorkspaceRole.MANAGER, WorkspaceRole.OWNER)).toBe(false);
  });

  it("orders every role correctly relative to every other role", () => {
    const ranked = [
      WorkspaceRole.SALES_REP,
      WorkspaceRole.MANAGER,
      WorkspaceRole.ADMIN,
      WorkspaceRole.OWNER,
    ];
    for (let i = 0; i < ranked.length; i++) {
      for (let j = 0; j < ranked.length; j++) {
        expect(roleAtLeast(ranked[i], ranked[j])).toBe(i >= j);
      }
    }
  });
});
