import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { requireRole } from "@/server/auth";
import {
  NOTIFICATION_CHANNEL,
  NOTIFICATION_STATUS,
  type CommercialEventType,
  type NotificationChannel,
  type NotificationStatus,
} from "@/lib/commercial-events";

export type NotificationInput = {
  type: CommercialEventType;
  channel: NotificationChannel;
  status: NotificationStatus;
  body: string;
  templateKey?: string;
  recipient?: string;
  subject?: string;
  error?: string;
  entityType?: string;
  entityId?: string;
  payload?: Record<string, unknown>;
};

/**
 * Tópico 22: registra o evento e o resultado do envio. É a base para integrar
 * e-mail, WhatsApp e notificações internas sem alterar os serviços de domínio.
 */
export async function recordNotification(input: NotificationInput) {
  return prisma.notificationEvent.create({
    data: {
      type: input.type,
      channel: input.channel,
      status: input.status,
      body: input.body,
      templateKey: input.templateKey ?? null,
      recipient: input.recipient ?? null,
      subject: input.subject ?? null,
      error: input.error ?? null,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      payload: input.payload ? (JSON.parse(JSON.stringify(input.payload)) as Prisma.InputJsonValue) : Prisma.DbNull,
    },
  });
}

export async function listNotificationEvents(entityId: string) {
  await requireRole("ADMIN");
  return prisma.notificationEvent.findMany({
    where: { entityId },
    orderBy: { occurredAt: "desc" },
    take: 100,
  });
}

export { NOTIFICATION_CHANNEL, NOTIFICATION_STATUS };