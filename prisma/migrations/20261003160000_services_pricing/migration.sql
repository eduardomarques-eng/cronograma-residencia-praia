-- Cadastro administrativo de serviços, níveis e pacotes (Tópicos 3, 4, 5 e 11)
CREATE TYPE "ServiceUnit" AS ENUM ('M2', 'AMBIENTE', 'UNIDADE', 'IMAGEM', 'PACOTE', 'FIXO', 'HORA', 'PERCENTUAL');
CREATE TYPE "PricingLevel" AS ENUM ('BAIXO', 'MEDIO', 'ALTO');

CREATE TABLE "ServiceItem" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "discipline" TEXT NOT NULL,
    "category" TEXT,
    "descriptionCommercial" TEXT,
    "descriptionTechnical" TEXT,
    "unit" "ServiceUnit" NOT NULL,
    "baseLow" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "baseMedium" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "baseHigh" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "minPrice" DECIMAL(12,2),
    "minQuantity" DECIMAL(12,2),
    "maxQuantity" DECIMAL(12,2),
    "increment" DECIMAL(12,2),
    "estimatedDays" INTEGER,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "scope" TEXT,
    "exclusions" TEXT,
    "notes" TEXT,
    "dependencies" JSONB,
    "calculationRules" JSONB,
    "presentationImages" JSONB,
    "icon" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ServiceItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ServiceItem_discipline_name_key" ON "ServiceItem"("discipline", "name");
CREATE INDEX "ServiceItem_discipline_active_displayOrder_idx" ON "ServiceItem"("discipline", "active", "displayOrder");

CREATE TABLE "ServicePriceHistory" (
    "id" UUID NOT NULL,
    "serviceId" UUID NOT NULL,
    "level" "PricingLevel" NOT NULL,
    "previousValue" DECIMAL(12,2),
    "newValue" DECIMAL(12,2) NOT NULL,
    "reason" TEXT,
    "changedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ServicePriceHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ServicePriceHistory_serviceId_createdAt_idx" ON "ServicePriceHistory"("serviceId", "createdAt");

ALTER TABLE "ServicePriceHistory" ADD CONSTRAINT "ServicePriceHistory_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "ServiceItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CommercialPackage" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CommercialPackage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CommercialPackage_name_key" ON "CommercialPackage"("name");

CREATE TABLE "PackageItem" (
    "id" UUID NOT NULL,
    "packageId" UUID NOT NULL,
    "serviceId" UUID NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "optional" BOOLEAN NOT NULL DEFAULT false,
    "overrideUnit" "ServiceUnit",
    "overridePrice" DECIMAL(12,2),
    CONSTRAINT "PackageItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PackageItem_packageId_serviceId_key" ON "PackageItem"("packageId", "serviceId");

ALTER TABLE "PackageItem" ADD CONSTRAINT "PackageItem_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "CommercialPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PackageItem" ADD CONSTRAINT "PackageItem_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "ServiceItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Memória de cálculo preservada por versão da proposta (Tópico 9)
ALTER TABLE "ProposalVersion" ADD COLUMN "pricing" JSONB;