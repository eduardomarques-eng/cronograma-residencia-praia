import { prisma } from "@/server/db";

export async function recordAudit(action: string, entity: string, entityId?: string, userId?: string, metadata?: object) {
  return prisma.auditLog.create({ data: { action, entity, entityId, userId, metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : undefined } });
}
