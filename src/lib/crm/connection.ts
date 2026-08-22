import { db } from "@/lib/db";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { refreshHubSpotToken } from "@/lib/crm/hubspot/oauth";
import { HubSpotProvider } from "@/lib/crm/hubspot/provider";
import { CRMConnectionStatus } from "@/generated/prisma/enums";
import type { CRMConnection } from "@/generated/prisma/client";
import type { CRMProvider } from "@/lib/crm/types";

const REFRESH_MARGIN_MS = 5 * 60 * 1000;

/**
 * Returns a valid access token for the connection, refreshing and
 * persisting it first if it's expired or close to expiring. Marks the
 * connection EXPIRED (rather than throwing opaquely) if the refresh
 * itself fails, so the UI can prompt a reconnect.
 */
export async function getValidAccessToken(connection: CRMConnection): Promise<string> {
  const expiresAt = connection.tokenExpiresAt?.getTime() ?? 0;
  const needsRefresh = expiresAt - REFRESH_MARGIN_MS < Date.now();

  if (!needsRefresh && connection.accessTokenEncrypted) {
    return decryptSecret(connection.accessTokenEncrypted);
  }

  if (!connection.refreshTokenEncrypted) {
    throw new Error("No refresh token stored for this connection");
  }

  try {
    const refreshToken = decryptSecret(connection.refreshTokenEncrypted);
    const tokens = await refreshHubSpotToken(refreshToken);

    await db.cRMConnection.update({
      where: { id: connection.id },
      data: {
        accessTokenEncrypted: encryptSecret(tokens.access_token),
        refreshTokenEncrypted: encryptSecret(tokens.refresh_token),
        tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        status: CRMConnectionStatus.CONNECTED,
        lastSyncError: null,
      },
    });

    return tokens.access_token;
  } catch (error) {
    await db.cRMConnection.update({
      where: { id: connection.id },
      data: { status: CRMConnectionStatus.EXPIRED },
    });
    throw error;
  }
}

export async function getProviderForConnection(connection: CRMConnection): Promise<CRMProvider> {
  const accessToken = await getValidAccessToken(connection);
  switch (connection.provider) {
    case "HUBSPOT":
      return new HubSpotProvider(accessToken);
    default:
      throw new Error(`Unsupported CRM provider: ${connection.provider}`);
  }
}
