import type { FindingType } from "@/generated/prisma/enums";

const FINDING_LABELS: Record<FindingType, string> = {
  STALE_OPPORTUNITY: "Stale",
  MISSING_FOLLOW_UP: "Missing follow-up",
  DEAL_STAGNATION: "Stagnant",
  NO_NEXT_STEP: "No next step",
  MISSING_CRM_DATA: "Incomplete data",
  UNUSUAL_INACTIVITY: "Gone quiet",
  POTENTIALLY_LOST_DEAL: "At risk",
};

export function findingLabel(type: FindingType): string {
  return FINDING_LABELS[type];
}
