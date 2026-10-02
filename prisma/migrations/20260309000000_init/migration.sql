CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE "ClientStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "ProjectStatus" AS ENUM ('PLANNING', 'IN_PROGRESS', 'COMPLETED', 'PAUSED', 'CANCELLED');
CREATE TYPE "ScheduleStageStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED');
CREATE TYPE "PaymentStatus" AS ENUM ('PAID', 'PENDING', 'AWAITING_COMPLETION');
CREATE TABLE "Client" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "fullName" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "document" TEXT,
  "address" JSONB,
  "notes" TEXT,
  "status" "ClientStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Project" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "clientId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "type" TEXT,
  "description" TEXT,
  "scope" TEXT,
  "budget" DECIMAL(12,2),
  "startDate" TIMESTAMP(3),
  "expectedEndDate" TIMESTAMP(3),
  "status" "ProjectStatus" NOT NULL DEFAULT 'PLANNING',
  "address" JSONB,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ScheduleStage" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "projectId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "discipline" TEXT,
  "designer" TEXT,
  "description" TEXT,
  "startDate" TIMESTAMP(3),
  "endDate" TIMESTAMP(3),
  "dueDate" TIMESTAMP(3),
  "durationDays" INTEGER,
  "status" "ScheduleStageStatus" NOT NULL DEFAULT 'NOT_STARTED',
  "order" INTEGER NOT NULL,
  "completion" INTEGER NOT NULL DEFAULT 0,
  "completedAt" TIMESTAMP(3),
  "notes" TEXT,
  "dependencyId" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ScheduleStage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Payment" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "projectId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "dueDate" TIMESTAMP(3),
  "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  "note" TEXT,
  "order" INTEGER NOT NULL,
  "percentage" INTEGER,
  "paidAt" TIMESTAMP(3),
  "archivedAt" TIMESTAMP(3),
  "scheduleStageId" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Briefing" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "projectId" UUID NOT NULL,
  "responses" JSONB NOT NULL,
  "submittedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Briefing_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Project_stage_order_key" ON "ScheduleStage"("projectId", "order");
CREATE UNIQUE INDEX "Payment_project_order_key" ON "Payment"("projectId", "order");
CREATE UNIQUE INDEX "Briefing_projectId_key" ON "Briefing"("projectId");
CREATE INDEX "Client_email_idx" ON "Client"("email");
CREATE INDEX "Project_clientId_idx" ON "Project"("clientId");
CREATE INDEX "Project_status_idx" ON "Project"("status");
CREATE INDEX "ScheduleStage_projectId_status_idx" ON "ScheduleStage"("projectId", "status");
CREATE INDEX "ScheduleStage_dependencyId_idx" ON "ScheduleStage"("dependencyId");
CREATE INDEX "Payment_projectId_status_idx" ON "Payment"("projectId", "status");
CREATE INDEX "Payment_scheduleStageId_idx" ON "Payment"("scheduleStageId");

ALTER TABLE "Project" ADD CONSTRAINT "Project_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ScheduleStage" ADD CONSTRAINT "ScheduleStage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScheduleStage" ADD CONSTRAINT "ScheduleStage_dependencyId_fkey" FOREIGN KEY ("dependencyId") REFERENCES "ScheduleStage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_scheduleStageId_fkey" FOREIGN KEY ("scheduleStageId") REFERENCES "ScheduleStage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Briefing" ADD CONSTRAINT "Briefing_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
