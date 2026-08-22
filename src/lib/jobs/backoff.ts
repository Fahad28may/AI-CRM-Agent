const BASE_RETRY_DELAY_MS = 60_000;

/** Exponential backoff: 1min, 2min, 4min, ... */
export function computeRetryDelayMs(attempts: number): number {
  return BASE_RETRY_DELAY_MS * 2 ** (attempts - 1);
}
