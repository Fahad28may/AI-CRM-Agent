-- CreateIndex
CREATE INDEX "Recommendation_workspaceId_createdAt_idx" ON "Recommendation"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "Action_workspaceId_createdAt_idx" ON "Action"("workspaceId", "createdAt");
