import { PrismaClient } from "../../generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  flowPrisma: PrismaClient | undefined;
};

// FlowBoard reads DATABASE_URL (with DIRECT_URL for migrations) from the
// Prisma schema datasource — no local SQLite override.
export const prisma =
  globalForPrisma.flowPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.flowPrisma = prisma;
