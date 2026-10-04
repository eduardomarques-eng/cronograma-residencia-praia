import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { DomainError, notFound } from "@/server/errors";
import { clientSchema, clientUpdateSchema } from "@/lib/validation";

function normalizeClientData(data: ReturnType<typeof clientSchema.parse>) {
  const { address, ...rest } = data;
  return {
    ...rest,
    ...(address === undefined
      ? {}
      : { address: address === null ? Prisma.JsonNull : JSON.parse(JSON.stringify(address)) as Prisma.InputJsonValue }),
  };
}

export async function createClient(input: unknown) {
  return prisma.client.create({ data: normalizeClientData(clientSchema.parse(input)) });
}

/**
 * Listagem com busca real no banco. A filtragem acontece na base de dados e
 * não depois de trazer tudo para a memória — que era o que a barra de pesquisa
 * fazia antes (nada).
 */
export async function listClients(query?: string) {
  const term = query?.trim();
  return prisma.client.findMany({
    where: term
      ? {
          OR: [
            { name: { contains: term, mode: "insensitive" } },
            { email: { contains: term, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: { name: "asc" },
  });
}

export async function getClient(id: string) {
  return (await prisma.client.findUnique({ where: { id }, include: { projects: true } })) ?? notFound("Cliente");
}

export async function updateClient(id: string, input: unknown) {
  const data = clientUpdateSchema.parse(input);
  const { address, ...rest } = data;
  const normalizedData = {
    ...rest,
    ...(address === undefined
      ? {}
      : { address: address === null ? Prisma.JsonNull : JSON.parse(JSON.stringify(address)) as Prisma.InputJsonValue }),
  };
  try {
    return await prisma.client.update({ where: { id }, data: normalizedData });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") return notFound("Cliente");
    throw error;
  }
}

export async function archiveClient(id: string) {
  const result = await prisma.client.updateMany({ where: { id }, data: { status: "INACTIVE" } });
  if (!result.count) return notFound("Cliente");
  return getClient(id);
}

export function explainClientError(error: unknown): string {
  if (error instanceof DomainError) return error.message;
  return "Não foi possível salvar o cliente.";
}
