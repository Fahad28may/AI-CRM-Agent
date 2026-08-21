import { z } from "zod";
import { WorkspaceRole } from "@/generated/prisma/enums";

export const createWorkspaceSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
});

export const updateWorkspaceSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
});

export const addMemberSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  role: z.enum(WorkspaceRole).default(WorkspaceRole.SALES_REP),
});

export const updateMemberSchema = z.object({
  role: z.enum(WorkspaceRole),
});
