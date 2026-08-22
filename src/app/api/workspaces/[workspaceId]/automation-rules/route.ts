import { requireWorkspaceMember } from "@/lib/authz";
import { withErrorHandling } from "@/lib/api-handler";
import { jsonOk } from "@/lib/api-response";
import { getWorkspaceAutomationSettings } from "@/lib/pipeline/automation";

type Params = { params: Promise<{ workspaceId: string }> };

export const GET = withErrorHandling(async (_request: Request, { params }: Params) => {
  const { workspaceId } = await params;
  await requireWorkspaceMember(workspaceId);

  const rules = await getWorkspaceAutomationSettings(workspaceId);
  return jsonOk({ rules });
});
