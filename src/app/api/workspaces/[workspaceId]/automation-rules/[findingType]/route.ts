import { requireWorkspaceMember } from "@/lib/authz";
import { withErrorHandling } from "@/lib/api-handler";
import { jsonError, jsonOk } from "@/lib/api-response";
import { updateAutomationRuleSchema } from "@/lib/validation/automation-rule";
import { CONFIGURABLE_FINDING_TYPES, upsertAutomationRule } from "@/lib/pipeline/automation";
import type { ConfigurableFindingType } from "@/lib/pipeline/automation";
import { WorkspaceRole } from "@/generated/prisma/enums";

type Params = { params: Promise<{ workspaceId: string; findingType: string }> };

function isConfigurableFindingType(value: string): value is ConfigurableFindingType {
  return (CONFIGURABLE_FINDING_TYPES as readonly string[]).includes(value);
}

export const PUT = withErrorHandling(async (request: Request, { params }: Params) => {
  const { workspaceId, findingType } = await params;
  const { user } = await requireWorkspaceMember(workspaceId, WorkspaceRole.ADMIN);

  if (!isConfigurableFindingType(findingType)) {
    return jsonError("Unknown or unconfigurable finding type", 400);
  }

  const body = await request.json().catch(() => null);
  const input = updateAutomationRuleSchema.parse(body);

  const rule = await upsertAutomationRule(workspaceId, user.id, findingType, input);
  return jsonOk({ rule });
});
