CREATE TYPE "BriefingStatus" AS ENUM ('DRAFT', 'FINALIZED');

ALTER TABLE "Briefing"
  ADD COLUMN "status" "BriefingStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "finalizedAt" TIMESTAMP(3);

CREATE TABLE "BriefingRevision" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "briefingId" UUID NOT NULL,
  "version" INTEGER NOT NULL,
  "responses" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BriefingRevision_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BriefingVisualOption" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "questionId" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "imageUrl" TEXT,
  "altText" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BriefingVisualOption_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BriefingRevision_briefingId_version_key" ON "BriefingRevision"("briefingId", "version");
CREATE INDEX "BriefingRevision_briefingId_createdAt_idx" ON "BriefingRevision"("briefingId", "createdAt");
CREATE INDEX "BriefingVisualOption_questionId_sortOrder_idx" ON "BriefingVisualOption"("questionId", "sortOrder");

ALTER TABLE "BriefingRevision" ADD CONSTRAINT "BriefingRevision_briefingId_fkey" FOREIGN KEY ("briefingId") REFERENCES "Briefing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
