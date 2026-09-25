import { PrismaClient } from "../../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Local dev TLS fix (PROJECT-PRD Incident 4): a connection string whose
 * `sslmode=require` parses to a truthy `ssl: {}` (strict verification) and
 * OVERRIDES the `ssl` object below, so the Supabase Session Pooler's private
 * CA chain is rejected with P1011. Appending `sslmode=no-verify` (same fix the
 * E2E suite uses) makes `parse()` yield `{ rejectUnauthorized: false }`, which
 * survives pg's Object.assign merge. The parameter is ALWAYS appended — pg's
 * parse() takes the LAST sslmode occurrence, so an appended no-verify wins
 * over any `sslmode=require` coming from later-loaded .env.local.
 */
function withTlsFallback(connectionString: string): string {
  return `${connectionString}${connectionString.includes("?") ? "&" : "?"}sslmode=no-verify`;
}

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
  connectionString: withTlsFallback(process.env.DATABASE_URL!),
  ssl: { rejectUnauthorized: false },
});

export const prisma =
  globalForPrisma.flowPrisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.flowPrisma = prisma;
