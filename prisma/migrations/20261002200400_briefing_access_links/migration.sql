CREATE TABLE "BriefingAccessLink" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "briefingId" UUID NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "lastAccessAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BriefingAccessLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BriefingAccessLink_tokenHash_key" ON "BriefingAccessLink"("tokenHash");
CREATE INDEX "BriefingAccessLink_briefingId_revokedAt_idx" ON "BriefingAccessLink"("briefingId", "revokedAt");

ALTER TABLE "BriefingAccessLink" ADD CONSTRAINT "BriefingAccessLink_briefingId_fkey" FOREIGN KEY ("briefingId") REFERENCES "Briefing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
