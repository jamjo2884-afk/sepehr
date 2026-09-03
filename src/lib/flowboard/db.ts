import { PrismaClient } from "../../generated/prisma/client";
import path from "path";

const globalForPrisma = globalThis as unknown as {
  flowPrisma: PrismaClient | undefined;
};

// Resolve the database path relative to project root (not schema file)
const dbPath = path.join(process.cwd(), "prisma", "dev.db");
const datasourceUrl = `file:${dbPath}`;

export const prisma =
  globalForPrisma.flowPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    datasourceUrl,
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.flowPrisma = prisma;
