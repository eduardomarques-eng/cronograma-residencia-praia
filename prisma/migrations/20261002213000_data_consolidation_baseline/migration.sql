CREATE TYPE "DocumentVisibility" AS ENUM ('INTERNAL', 'CLIENT');
CREATE TYPE "DocumentStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

CREATE TABLE "ProjectAccess" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "projectId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectAccess_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjectDocument" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "projectId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "storageUrl" TEXT NOT NULL,
  "mimeType" TEXT,
  "sizeBytes" BIGINT,
  "visibility" "DocumentVisibility" NOT NULL DEFAULT 'INTERNAL',
  "status" "DocumentStatus" NOT NULL DEFAULT 'ACTIVE',
  "releasedAt" TIMESTAMP(3),
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProjectDocument_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ProjectReport" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "ProjectReport" ADD COLUMN "contentUrl" TEXT;
ALTER TABLE "ProjectReport" DROP CONSTRAINT "ProjectReport_projectId_fkey";
ALTER TABLE "ProjectReport" ADD CONSTRAINT "ProjectReport_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BriefingAccessLink" ADD COLUMN "expiresAt" TIMESTAMP(3);
ALTER TABLE "BriefingAccessLink" ADD COLUMN "firstAccessAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "BriefingVisualOption_questionId_value_key" ON "BriefingVisualOption"("questionId", "value");
ALTER TABLE "ScheduleStage" ADD CONSTRAINT "ScheduleStage_completion_range_check" CHECK ("completion" >= 0 AND "completion" <= 100);
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_amount_nonnegative_check" CHECK ("amount" >= 0);
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_percentage_range_check" CHECK ("percentage" IS NULL OR ("percentage" >= 0 AND "percentage" <= 100));

CREATE UNIQUE INDEX "ProjectAccess_projectId_userId_key" ON "ProjectAccess"("projectId", "userId");
CREATE INDEX "ProjectAccess_userId_projectId_idx" ON "ProjectAccess"("userId", "projectId");
CREATE INDEX "ProjectDocument_projectId_visibility_status_idx" ON "ProjectDocument"("projectId", "visibility", "status");

ALTER TABLE "ProjectAccess" ADD CONSTRAINT "ProjectAccess_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProjectAccess" ADD CONSTRAINT "ProjectAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProjectDocument" ADD CONSTRAINT "ProjectDocument_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
