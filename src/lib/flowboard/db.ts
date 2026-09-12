import { PrismaClient } from "../../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  flowPrisma: PrismaClient | undefined;
};

// FlowBoard reads DATABASE_URL (with DIRECT_URL for migrations) from the
// Prisma schema datasource — no local SQLite override.
//
// Uses PrismaPg driver adapter (Wasm query compiler) instead of the native
// binary engine. This eliminates the "Query Engine not found" error on
// Vercel Lambda because no platform-specific .so.node file is needed.
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
  ssl: { rejectUnauthorized: false },
});

export const prisma =
  globalForPrisma.flowPrisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.flowPrisma = prisma;
