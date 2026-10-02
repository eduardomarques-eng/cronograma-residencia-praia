import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const isDevelopment = typeof process !== "undefined" && process.env.NODE_ENV === "development";

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: isDevelopment ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
