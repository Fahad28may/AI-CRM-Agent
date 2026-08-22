import { NextResponse, after } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { verifyOAuthState } from "@/lib/oauth-state";
import { exchangeHubSpotCode, HUBSPOT_SCOPES } from "@/lib/crm/hubspot/oauth";
import { encryptSecret } from "@/lib/crypto";
import { CRMConnectionStatus, CRMProvider, JobType, WorkspaceRole } from "@/generated/prisma/enums";
import { roleAtLeast } from "@/lib/roles";
import { enqueueAndRun } from "@/lib/jobs/run";

function redirectToIntegrations(origin: string, slug: string | null, status: string) {
  const target = slug ? `/w/${slug}/integrations` : "/workspaces";
  return NextResponse.redirect(new URL(`${target}?hubspot=${status}`, origin));
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  if (!code || !state) {
    return redirectToIntegrations(origin, null, "error");
  }

  const statePayload = verifyOAuthState(state);
  if (!statePayload) {
    return redirectToIntegrations(origin, null, "invalid_state");
  }

  const workspace = await db.workspace.findUnique({ where: { id: statePayload.workspaceId } });
  if (!workspace) {
    return redirectToIntegrations(origin, null, "error");
  }

  const session = await auth();
  const membership = session?.user
    ? await db.workspaceMember.findUnique({
        where: {
          workspaceId_userId: { workspaceId: workspace.id, userId: session.user.id },
        },
      })
    : null;

  if (
    !session?.user ||
    session.user.id !== statePayload.userId ||
    !membership ||
    !roleAtLeast(membership.role, WorkspaceRole.ADMIN)
  ) {
    return redirectToIntegrations(origin, workspace.slug, "unauthorized");
  }

  try {
    const tokens = await exchangeHubSpotCode(code);

    const connection = await db.cRMConnection.upsert({
      where: {
        workspaceId_provider: { workspaceId: workspace.id, provider: CRMProvider.HUBSPOT },
      },
      create: {
        workspaceId: workspace.id,
        provider: CRMProvider.HUBSPOT,
        status: CRMConnectionStatus.CONNECTED,
        accessTokenEncrypted: encryptSecret(tokens.access_token),
        refreshTokenEncrypted: encryptSecret(tokens.refresh_token),
        tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        scopes: HUBSPOT_SCOPES.join(" "),
        connectedByUserId: session.user.id,
      },
      update: {
        status: CRMConnectionStatus.CONNECTED,
        accessTokenEncrypted: encryptSecret(tokens.access_token),
        refreshTokenEncrypted: encryptSecret(tokens.refresh_token),
        tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        scopes: HUBSPOT_SCOPES.join(" "),
        connectedByUserId: session.user.id,
        lastSyncError: null,
      },
    });

    // Import CRM data right away so onboarding shows real results instead
    // of an empty pipeline — runs after the redirect is sent so the user
    // isn't stuck waiting on a full sync before seeing the next screen.
    after(() =>
      enqueueAndRun(workspace.id, JobType.CRM_SYNC, { connectionId: connection.id }),
    );

    return redirectToIntegrations(origin, workspace.slug, "connected");
  } catch (error) {
    console.error("[hubspot] OAuth callback failed", error);
    return redirectToIntegrations(origin, workspace.slug, "error");
  }
}
