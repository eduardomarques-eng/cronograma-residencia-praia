import { formatCurrencyBRL } from "./contract-template";

export const PRICING_LEVELS = ["BAIXO", "MEDIO", "ALTO"] as const;
export type PricingLevelName = (typeof PRICING_LEVELS)[number];

// Tópico 3: unidade configurável, estruturalmente extensível.
export const SERVICE_UNITS = [
  "M2",
  "AMBIENTE",
  "UNIDADE",
  "IMAGEM",
  "PACOTE",
  "FIXO",
  "HORA",
  "PERCENTUAL",
] as const;
export type ServiceUnitName = (typeof SERVICE_UNITS)[number];

export const UNIT_LABELS: Record<ServiceUnitName, string> = {
  M2: "m²",
  AMBIENTE: "ambiente",
  UNIDADE: "unidade",
  IMAGEM: "imagem",
  PACOTE: "pacote",
  FIXO: "serviço fixo",
  HORA: "hora",
  PERCENTUAL: "percentual",
};

export const LEVEL_LABELS: Record<PricingLevelName, string> = {
  BAIXO: "Baixo",
  MEDIO: "Médio",
  ALTO: "Alto",
};

export class PricingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PricingError";
  }
}

export type CatalogService = {
  id: string;
  name: string;
  discipline: string;
  unit: ServiceUnitName;
  baseLow: number;
  baseMedium: number;
  baseHigh: number;
  minPrice?: number | null;
  minQuantity?: number | null;
  maxQuantity?: number | null;
  increment?: number | null;
  estimatedDays?: number | null;
  displayOrder?: number;
  active?: boolean;
  version?: number;
};

export type PricedLine = {
  serviceId: string;
  name: string;
  discipline: string;
  unit: ServiceUnitName;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  level: PricingLevelName;
  /** Tópico 30: a origem do valor é sempre explícita. */
  origin: "CATALOGO" | "AJUSTE_ADMIN";
  notes: string[];
};

export type QuoteLineInput = {
  serviceId: string;
  quantity: number;
  unitPriceOverride?: number | null;
};

export type QuoteInput = {
  level: PricingLevelName;
  lines: QuoteLineInput[];
  discountPercent?: number | null;
  discountFixed?: number | null;
  extraFee?: number | null;
  serviceAdjustment?: number | null;
  minimumOrder?: number | null;
};

export type QuoteResult = {
  level: PricingLevelName;
  lines: PricedLine[];
  subtotal: number;
  serviceAdjustment: number;
  discountPercent: number;
  discountFixed: number;
  extraFee: number;
  total: number;
  /** Memória de cálculo legível (Tópico 9). */
  memory: string[];
  requiresAdminApproval: boolean;
};

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function formatQuantity(value: number): string {
  return String(round2(value)).replace(".", ",");
}

function catalogPriceOrNull(service: CatalogService, level: PricingLevelName): number | null {
  const value = level === "BAIXO" ? service.baseLow : level === "MEDIO" ? service.baseMedium : service.baseHigh;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? round2(parsed) : null;
}

/** Sem valor cadastrado no nível, o motor não estima: devolve null. */
export function levelPrice(service: CatalogService, level: PricingLevelName): number | null {
  return catalogPriceOrNull(service, level);
}

export function normalizeQuantity(
  service: CatalogService,
  quantity: number,
): { quantity: number; notes: string[] } {
  const notes: string[] = [];
  let value = Number(quantity);
  if (!Number.isFinite(value) || value <= 0) {
    throw new PricingError(`Quantidade inválida para “${service.name}”.`);
  }
  const min = Number(service.minQuantity ?? 0);
  const max = Number(service.maxQuantity ?? 0);
  if (min > 0 && value < min) {
    value = min;
    notes.push(`Quantidade ajustada para o mínimo de ${formatQuantity(min)}.`);
  }
  if (max > 0 && value > max) {
    value = max;
    notes.push(`Quantidade limitada ao máximo de ${formatQuantity(max)}.`);
  }
  const increment = Number(service.increment ?? 0);
  if (increment > 0) {
    const normalized = round2(Math.ceil(round2(value) / increment) * increment);
    if (normalized !== round2(value)) {
      notes.push(`Quantidade ajustada para múltiplo de ${formatQuantity(increment)}.`);
    }
    value = normalized;
  }
  return { quantity: round2(value), notes };
}

export function priceLine(
  service: CatalogService,
  input: QuoteLineInput & { level: PricingLevelName },
): PricedLine {
  if (service.active === false) {
    throw new PricingError(`“${service.name}” está inativo no catálogo.`);
  }
  const catalogPrice = catalogPriceOrNull(service, input.level);
  const { quantity, notes } = normalizeQuantity(service, input.quantity);

  let unitPrice: number;
  let origin: PricedLine["origin"] = "CATALOGO";
  const override = input.unitPriceOverride;
  if (override !== undefined && override !== null && Number.isFinite(Number(override))) {
    unitPrice = round2(Number(override));
    origin = "AJUSTE_ADMIN";
    notes.push(
      catalogPrice === null
        ? "Preço definido manualmente pelo ADMIN (catálogo sem valor para o nível)."
        : `Preço unitário ajustado pelo ADMIN (catálogo ${formatCurrencyBRL(catalogPrice)}).`,
    );
  } else {
    if (catalogPrice === null) {
      throw new PricingError(
        `“${service.name}” não possui valor cadastrado no nível ${LEVEL_LABELS[input.level]}. Defina o preço ou use ajuste manual do ADMIN.`,
      );
    }
    unitPrice = catalogPrice;
  }

  let subtotal = round2(quantity * unitPrice);
  const minPrice = round2(Number(service.minPrice ?? 0));
  if (minPrice > 0 && subtotal < minPrice) {
    subtotal = minPrice;
    notes.push(`Preço mínimo de ${formatCurrencyBRL(minPrice)} aplicado.`);
  }

  return {
    serviceId: service.id,
    name: service.name,
    discipline: service.discipline,
    unit: service.unit,
    quantity,
    unitPrice,
    subtotal,
    level: input.level,
    origin,
    notes,
  };
}

export function renderLineMemory(line: PricedLine): string {
  const label = UNIT_LABELS[line.unit];
  const suffix = line.unit === "FIXO" ? "" : `/${label}`;
  return `${line.name}: ${formatQuantity(line.quantity)} ${label} × ${formatCurrencyBRL(line.unitPrice)}${suffix} = ${formatCurrencyBRL(line.subtotal)}`;
}

export function calculateQuote(catalog: readonly CatalogService[], input: QuoteInput): QuoteResult {
  const byId = new Map(catalog.map((service) => [service.id, service]));
  const lines = input.lines.map((entry) => {
    const service = byId.get(entry.serviceId);
    if (!service) throw new PricingError(`Serviço “${entry.serviceId}” não está no catálogo.`);
    return priceLine(service, { ...entry, level: input.level });
  });

  const subtotal = round2(lines.reduce((sum, line) => sum + line.subtotal, 0));
  const serviceAdjustment = round2(Number(input.serviceAdjustment ?? 0));
  const discountPercent = round2(Number(input.discountPercent ?? 0));
  const discountFixed = round2(Number(input.discountFixed ?? 0));
  const extraFee = round2(Number(input.extraFee ?? 0));
  const percentAmount = round2((subtotal * discountPercent) / 100);

  let total = round2(subtotal + serviceAdjustment - percentAmount - discountFixed + extraFee);
  const memory = lines.flatMap((line) => [renderLineMemory(line), ...line.notes]);

  if (serviceAdjustment !== 0) memory.push(`Ajuste administrativo: ${formatCurrencyBRL(serviceAdjustment)}.`);
  if (percentAmount !== 0) memory.push(`Desconto de ${formatQuantity(discountPercent)}%: -${formatCurrencyBRL(percentAmount)}.`);
  if (discountFixed !== 0) memory.push(`Desconto fixo: -${formatCurrencyBRL(discountFixed)}.`);
  if (extraFee !== 0) memory.push(`Taxa adicional: ${formatCurrencyBRL(extraFee)}.`);
  memory.push(`Subtotal: ${formatCurrencyBRL(subtotal)}`);

  const minimumOrder = round2(Number(input.minimumOrder ?? 0));
  if (minimumOrder > 0 && total < minimumOrder) {
    total = minimumOrder;
    memory.push(`Pedido mínimo de ${formatCurrencyBRL(minimumOrder)} aplicado.`);
  }
  memory.push(`Valor final: ${formatCurrencyBRL(total)}`);

  const requiresAdminApproval =
    serviceAdjustment !== 0 || discountPercent !== 0 || discountFixed !== 0 || extraFee !== 0;

  return {
    level: input.level,
    lines,
    subtotal,
    serviceAdjustment,
    discountPercent,
    discountFixed,
    extraFee,
    total,
    memory,
    requiresAdminApproval,
  };
}