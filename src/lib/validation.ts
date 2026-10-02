import { z } from "zod";

const optionalDate = z.coerce.date().optional().nullable();
const optionalText = z.string().trim().optional().nullable();
const uuid = z.string().uuid();

export const clientSchema = z.object({
  name: z.string().trim().min(1),
  fullName: optionalText,
  email: z.string().email().optional().nullable(),
  phone: optionalText,
  document: optionalText,
  address: z.record(z.string(), z.unknown()).optional().nullable(),
  notes: optionalText,
});
export const clientUpdateSchema = clientSchema.partial();

export const projectSchema = z.object({
  clientId: z.string().uuid(),
  name: z.string().trim().min(1),
  type: optionalText,
  description: optionalText,
  scope: optionalText,
  budget: z.coerce.number().nonnegative().optional().nullable(),
  startDate: optionalDate,
  expectedEndDate: optionalDate,
  status: z.enum(["PLANNING", "IN_PROGRESS", "COMPLETED", "PAUSED", "CANCELLED"]).default("PLANNING"),
  notes: optionalText,
});
export const projectUpdateSchema = projectSchema.omit({ clientId: true }).partial();

export const scheduleStageSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().trim().min(1),
  description: optionalText,
  startDate: optionalDate,
  endDate: optionalDate,
  durationDays: z.number().int().nonnegative().optional().nullable(),
  order: z.number().int().nonnegative(),
  completion: z.number().int().min(0).max(100).default(0),
  dependencyId: uuid.optional().nullable(),
  notes: optionalText,
});
export const scheduleStageUpdateSchema = scheduleStageSchema.omit({ projectId: true }).partial();

export const paymentSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().trim().min(1),
  amount: z.coerce.number().nonnegative(),
  dueDate: optionalDate,
  status: z.enum(["PAID", "PENDING", "AWAITING_COMPLETION"]).default("PENDING"),
  note: optionalText,
  order: z.number().int().nonnegative(),
  percentage: z.number().int().min(0).max(100).optional().nullable(),
  scheduleStageId: uuid.optional().nullable(),
  paidAt: optionalDate,
  archivedAt: optionalDate,
});
export const paymentUpdateSchema = paymentSchema.omit({ projectId: true, order: true }).partial();

export const briefingSchema = z.object({
  projectId: z.string().uuid(),
  responses: z.record(z.string(), z.unknown()),
  submittedAt: optionalDate,
});
export const briefingUpdateSchema = briefingSchema.omit({ projectId: true }).partial();
