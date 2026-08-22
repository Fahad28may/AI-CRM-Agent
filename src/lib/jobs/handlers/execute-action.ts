import { executeAction } from "@/lib/actions/execute";
import type { JobHandler } from "@/lib/jobs/types";

export const runExecuteActionJob: JobHandler<"EXECUTE_ACTION"> = async (payload) => {
  await executeAction(payload.actionId);
};
