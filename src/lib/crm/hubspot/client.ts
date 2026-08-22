/**
 * Low-level HubSpot REST client. Uses the /crm/v3 API surface — still
 * fully supported alongside HubSpot's newer date-versioned paths
 * (/crm/objects/{date}/...); the base path is centralized here so
 * migrating later is a one-line change.
 */
const HUBSPOT_API_BASE = "https://api.hubapi.com";
const MAX_RETRIES = 3;

export class HubSpotApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body: unknown,
  ) {
    super(message);
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class HubSpotClient {
  constructor(private accessToken: string) {}

  private async request<T>(
    method: string,
    path: string,
    options: { query?: Record<string, string | undefined>; body?: unknown } = {},
  ): Promise<T> {
    const url = new URL(`${HUBSPOT_API_BASE}${path}`);
    for (const [key, value] of Object.entries(options.query ?? {})) {
      if (value !== undefined) url.searchParams.set(key, value);
    }

    let lastError: unknown;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
      });

      if (res.ok) {
        if (res.status === 204) return undefined as T;
        return (await res.json()) as T;
      }

      // Rate limited or transient server error — retry with backoff.
      if ((res.status === 429 || res.status >= 500) && attempt < MAX_RETRIES) {
        const retryAfterHeader = res.headers.get("Retry-After");
        const retryAfterMs = retryAfterHeader
          ? Number(retryAfterHeader) * 1000
          : 500 * 2 ** attempt;
        lastError = await res.text().catch(() => res.statusText);
        await sleep(retryAfterMs);
        continue;
      }

      const body = await res.json().catch(() => null);
      throw new HubSpotApiError(
        `HubSpot API error ${res.status} on ${method} ${path}`,
        res.status,
        body,
      );
    }

    throw new HubSpotApiError(
      `HubSpot API error on ${method} ${path} after ${MAX_RETRIES} retries`,
      0,
      lastError,
    );
  }

  get<T>(path: string, query?: Record<string, string | undefined>) {
    return this.request<T>("GET", path, { query });
  }

  post<T>(path: string, body?: unknown) {
    return this.request<T>("POST", path, { body });
  }

  patch<T>(path: string, body?: unknown) {
    return this.request<T>("PATCH", path, { body });
  }

  put<T>(path: string, body?: unknown) {
    return this.request<T>("PUT", path, { body });
  }
}
