CREATE TYPE "ProjectReportStatus" AS ENUM ('PREPARING', 'INTERNAL', 'RELEASED', 'ARCHIVED');

CREATE TABLE "ProjectReport" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "projectId" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "status" "ProjectReportStatus" NOT NULL DEFAULT 'PREPARING',
  "releasedAt" TIMESTAMP(3),
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProjectReport_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ProjectReport_projectId_status_idx" ON "ProjectReport"("projectId", "status");
ALTER TABLE "ProjectReport" ADD CONSTRAINT "ProjectReport_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
