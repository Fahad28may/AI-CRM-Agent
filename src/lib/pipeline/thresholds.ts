/**
 * Deterministic pipeline-health thresholds (section 8 of the master
 * prompt). These are plain heuristics, not AI — per rule 3, don't reach
 * for an LLM when "inactive for N days" is sufficient. Fixed for MVP;
 * a natural later step is making these per-workspace settings.
 */
export const STALE_DAYS = 14;
export const STAGNATION_DAYS = 21;
export const FOLLOW_UP_DAYS = 3;
export const INACTIVITY_LOOKBACK_DAYS = 60;
export const INACTIVITY_RECENT_DAYS = 14;
export const INACTIVITY_MIN_PRIOR_ACTIVITIES = 2;

export function daysBetween(a: Date, b: Date): number {
  return Math.floor(Math.abs(a.getTime() - b.getTime()) / (24 * 60 * 60 * 1000));
}
