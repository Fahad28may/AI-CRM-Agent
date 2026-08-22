-- Activity ids from HubSpot are only unique within their own engagement
-- type (a call and an email can share the same numeric id), so `type`
-- must be part of the uniqueness key.
DROP INDEX "Activity_workspaceId_crmConnectionId_externalId_key";

CREATE UNIQUE INDEX "Activity_workspaceId_crmConnectionId_type_externalId_key" ON "Activity"("workspaceId", "crmConnectionId", "type", "externalId");
