import { syncCrmConnection } from "@/lib/crm/sync";
import type { JobHandler } from "@/lib/jobs/types";

export const runCrmSyncJob: JobHandler<"CRM_SYNC"> = async (payload) => {
  await syncCrmConnection(payload.connectionId);
};
