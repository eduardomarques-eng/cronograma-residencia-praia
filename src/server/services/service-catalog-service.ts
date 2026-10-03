import { Prisma, type ServiceItem } from "@prisma/client";
import { prisma } from "@/server/db";
import { requireRole } from "@/server/auth";
import { notFound } from "@/server/errors";
import { recordAudit } from "@/server/audit";
import type { CatalogService, PricingLevelName, ServiceUnitName } from "@/lib/pricing";

export const LEVEL_FIELD: Record<PricingLevelName, "baseLow" | "baseMedium" | "baseHigh"> = {
  BAIXO: "baseLow",
  MEDIO: "baseMedium",
  ALTO: "baseHigh",
};

/** Converte o registro do Prisma (Decimal) para o motor puro. */
export function toCatalogService(record: ServiceItem): CatalogService {
  return {
    id: record.id,
    name: record.name,
    discipline: record.discipline,
    unit: record.unit as ServiceUnitName,
    baseLow: Number(record.baseLow),
    baseMedium: Number(record.baseMedium),
    baseHigh: Number(record.baseHigh),
    minPrice: record.minPrice === null ? null : Number(record.minPrice),
    minQuantity: record.minQuantity === null ? null : Number(record.minQuantity),
    maxQuantity: record.maxQuantity === null ? null : Number(record.maxQuantity),
    increment: record.increment === null ? null : Number(record.increment),
    estimatedDays: record.estimatedDays,
    displayOrder: record.displayOrder,
    active: record.active,
    version: record.version,
  };
}

export async function listServiceCatalog(options: { discipline?: string; includeInactive?: boolean } = {}) {
  await requireRole("ADMIN");
  const records = await prisma.serviceItem.findMany({
    where: {
      ...(options.discipline ? { discipline: options.discipline } : {}),
      ...(options.includeInactive ? {} : { active: true }),
    },
    orderBy: [{ discipline: "asc" }, { displayOrder: "asc" }, { name: "asc" }],
  });
  return records.map(toCatalogService);
}

/** Catálogo bruto para o motor; usado dentro de fluxos já autorizados. */
export async function loadPricingCatalog(): Promise<CatalogService[]> {
  const records = await prisma.serviceItem.findMany({
    orderBy: [{ discipline: "asc" }, { displayOrder: "asc" }],
  });
  return records.map(toCatalogService);
}

export async function listServicePriceHistory(serviceId: string) {
  await requireRole("ADMIN");
  return prisma.servicePriceHistory.findMany({
    where: { serviceId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function listCommercialPackages() {
  await requireRole("ADMIN");
  return prisma.commercialPackage.findMany({
    orderBy: { name: "asc" },
    include: { items: { orderBy: { displayOrder: "asc" }, include: { service: true } } },
  });
}

export type ServiceWriteInput = {
  name?: string;
  discipline?: string;
  category?: string | null;
  descriptionCommercial?: string | null;
  descriptionTechnical?: string | null;
  unit?: ServiceUnitName;
  baseLow?: number;
  baseMedium?: number;
  baseHigh?: number;
  minPrice?: number | null;
  minQuantity?: number | null;
  maxQuantity?: number | null;
  increment?: number | null;
  estimatedDays?: number | null;
  displayOrder?: number;
  active?: boolean;
  scope?: string | null;
  exclusions?: string | null;
  notes?: string | null;
  icon?: string | null;
  /** Motivo registrado no histórico de alteração de preço. */
  reason?: string;
};

function buildUpdateData(input: ServiceWriteInput): Prisma.ServiceItemUpdateInput {
  const data: Prisma.ServiceItemUpdateInput = {};
  if (input.name !== undefined) data.name = input.name.trim();
  if (input.discipline !== undefined) data.discipline = input.discipline;
  if (input.category !== undefined) data.category = input.category;
  if (input.descriptionCommercial !== undefined) data.descriptionCommercial = input.descriptionCommercial;
  if (input.descriptionTechnical !== undefined) data.descriptionTechnical = input.descriptionTechnical;
  if (input.unit !== undefined) data.unit = input.unit;
  if (input.baseLow !== undefined) data.baseLow = new Prisma.Decimal(input.baseLow);
  if (input.baseMedium !== undefined) data.baseMedium = new Prisma.Decimal(input.baseMedium);
  if (input.baseHigh !== undefined) data.baseHigh = new Prisma.Decimal(input.baseHigh);
  if (input.minPrice !== undefined) data.minPrice = input.minPrice === null ? null : new Prisma.Decimal(input.minPrice);
  if (input.minQuantity !== undefined) data.minQuantity = input.minQuantity === null ? null : new Prisma.Decimal(input.minQuantity);
  if (input.maxQuantity !== undefined) data.maxQuantity = input.maxQuantity === null ? null : new Prisma.Decimal(input.maxQuantity);
  if (input.increment !== undefined) data.increment = input.increment === null ? null : new Prisma.Decimal(input.increment);
  if (input.estimatedDays !== undefined) data.estimatedDays = input.estimatedDays;
  if (input.displayOrder !== undefined) data.displayOrder = input.displayOrder;
  if (input.active !== undefined) data.active = input.active;
  if (input.scope !== undefined) data.scope = input.scope;
  if (input.exclusions !== undefined) data.exclusions = input.exclusions;
  if (input.notes !== undefined) data.notes = input.notes;
  if (input.icon !== undefined) data.icon = input.icon;
  return data;
}

export async function createServiceItem(input: ServiceWriteInput & { name: string; discipline: string; unit: ServiceUnitName }) {
  const user = await requireRole("ADMIN");
  const created = await prisma.serviceItem.create({
    data: {
      name: input.name.trim(),
      discipline: input.discipline,
      unit: input.unit,
      baseLow: new Prisma.Decimal(input.baseLow ?? 0),
      baseMedium: new Prisma.Decimal(input.baseMedium ?? 0),
      baseHigh: new Prisma.Decimal(input.baseHigh ?? 0),
      category: input.category ?? null,
      descriptionCommercial: input.descriptionCommercial ?? null,
      descriptionTechnical: input.descriptionTechnical ?? null,
      minPrice: input.minPrice === undefined || input.minPrice === null ? null : new Prisma.Decimal(input.minPrice),
      minQuantity:
        input.minQuantity === undefined || input.minQuantity === null ? null : new Prisma.Decimal(input.minQuantity),
      maxQuantity:
        input.maxQuantity === undefined || input.maxQuantity === null ? null : new Prisma.Decimal(input.maxQuantity),
      increment: input.increment === undefined || input.increment === null ? null : new Prisma.Decimal(input.increment),
      estimatedDays: input.estimatedDays ?? null,
      displayOrder: input.displayOrder ?? 0,
      active: input.active ?? true,
      scope: input.scope ?? null,
      exclusions: input.exclusions ?? null,
      notes: input.notes ?? null,
      icon: input.icon ?? null,
    },
  });
  await recordAudit("SERVICE_CREATED", "ServiceItem", created.id, user.id, { discipline: created.discipline });
  return toCatalogService(created);
}

/** Tópico 4: toda alteração de preço fica registrada com valor anterior e motivo. */
export async function updateServiceItem(id: string, input: ServiceWriteInput) {
  const user = await requireRole("ADMIN");
  const existing = await prisma.serviceItem.findUnique({ where: { id } });
  if (!existing) return notFound("Serviço");

  const changedLevels = (Object.keys(LEVEL_FIELD) as PricingLevelName[]).filter((level) => {
    const field = LEVEL_FIELD[level];
    const incoming = input[field];
    return incoming !== undefined && Number(incoming) !== Number(existing[field]);
  });
  const reason = input.reason?.trim() || null;
  if (changedLevels.length > 0 && !reason) {
    throw new Error("Informe o motivo da alteração de preço: o histórico é obrigatório.");
  }

  const updated = await prisma.$transaction(async (tx) => {
    for (const level of changedLevels) {
      const field = LEVEL_FIELD[level];
      await tx.servicePriceHistory.create({
        data: {
          serviceId: id,
          level,
          previousValue: existing[field],
          newValue: new Prisma.Decimal(input[field] as number),
          reason,
          changedById: user.id,
        },
      });
    }
    return tx.serviceItem.update({
      where: { id },
      data: { ...buildUpdateData(input), version: existing.version + 1 },
    });
  });

  await recordAudit("SERVICE_UPDATED", "ServiceItem", id, user.id, {
    changedLevels,
    reason,
    version: updated.version,
  });
  return toCatalogService(updated);
}

/** Tópico 11: composição de pacotes, sem nomes fixos no código. */
export async function replacePackageItems(
  packageId: string,
  serviceIds: string[],
) {
  const user = await requireRole("ADMIN");
  const existing = await prisma.commercialPackage.findUnique({ where: { id: packageId } });
  if (!existing) return notFound("Pacote comercial");
  const items = serviceIds.map((serviceId, index) => ({ packageId, serviceId, displayOrder: index }));
  await prisma.$transaction([
    prisma.packageItem.deleteMany({ where: { packageId } }),
    ...(items.length ? [prisma.packageItem.createMany({ data: items })] : []),
  ]);
  await recordAudit("PACKAGE_ITEMS_REPLACED", "CommercialPackage", packageId, user.id, { count: items.length });
  return listCommercialPackages();
}