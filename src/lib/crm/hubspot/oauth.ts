const AUTHORIZE_URL = "https://app.hubspot.com/oauth/authorize";
const TOKEN_URL = "https://api.hubapi.com/oauth/v1/token";

export const HUBSPOT_SCOPES = [
  "crm.objects.contacts.read",
  "crm.objects.contacts.write",
  "crm.objects.companies.read",
  "crm.objects.deals.read",
  "crm.objects.deals.write",
  "crm.objects.owners.read",
];

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

export function buildHubSpotAuthorizeUrl(state: string): string {
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("client_id", getEnv("HUBSPOT_CLIENT_ID"));
  url.searchParams.set("redirect_uri", getEnv("HUBSPOT_REDIRECT_URI"));
  url.searchParams.set("scope", HUBSPOT_SCOPES.join(" "));
  url.searchParams.set("state", state);
  return url.toString();
}

export type HubSpotTokenResponse = {
  token_type: string;
  access_token: string;
  refresh_token: string;
  expires_in: number;
};

async function postForm(body: Record<string, string>): Promise<HubSpotTokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`HubSpot token request failed (${res.status}): ${text}`);
  }
  return res.json();
}

export function exchangeHubSpotCode(code: string): Promise<HubSpotTokenResponse> {
  return postForm({
    grant_type: "authorization_code",
    code,
    redirect_uri: getEnv("HUBSPOT_REDIRECT_URI"),
    client_id: getEnv("HUBSPOT_CLIENT_ID"),
    client_secret: getEnv("HUBSPOT_CLIENT_SECRET"),
  });
}

export function refreshHubSpotToken(refreshToken: string): Promise<HubSpotTokenResponse> {
  return postForm({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: getEnv("HUBSPOT_CLIENT_ID"),
    client_secret: getEnv("HUBSPOT_CLIENT_SECRET"),
  });
}
