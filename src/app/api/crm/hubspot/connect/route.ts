import { NextResponse } from "next/server";
import { requireWorkspaceMember } from "@/lib/authz";
import { withErrorHandling } from "@/lib/api-handler";
import { createOAuthState } from "@/lib/oauth-state";
import { buildHubSpotAuthorizeUrl } from "@/lib/crm/hubspot/oauth";
import { jsonError } from "@/lib/api-response";
import { WorkspaceRole } from "@/generated/prisma/enums";

export const GET = withErrorHandling(async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get("workspaceId");
  if (!workspaceId) return jsonError("workspaceId is required", 400);

  const { user } = await requireWorkspaceMember(workspaceId, WorkspaceRole.ADMIN);

  const state = createOAuthState(workspaceId, user.id);
  return NextResponse.redirect(buildHubSpotAuthorizeUrl(state));
});
