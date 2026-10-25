import "server-only";

import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@/generated/prisma/client";

const databaseGlobal = globalThis as unknown as { etimePrisma?: PrismaClient };

export function getPrisma(): PrismaClient {
  if (databaseGlobal.etimePrisma) return databaseGlobal.etimePrisma;

  let connection: URL;
  try {
    connection = new URL(process.env.DATABASE_URL ?? "");
    if (connection.protocol !== "mysql:" || !connection.hostname || connection.pathname === "/") {
      throw new Error();
    }
  } catch {
    throw new Error("Database configuration is missing or invalid.");
  }

  // Preserve URL options (including TLS), and use UTC for database date handling.
  connection.searchParams.set("timezone", "Z");
  // Permit RSA key retrieval only for the known local development database.
  if (
    process.env.NODE_ENV === "development" &&
    (connection.hostname === "localhost" || connection.hostname === "127.0.0.1") &&
    (connection.port || "3306") === "3306" &&
    connection.pathname === "/etime"
  ) {
    connection.searchParams.set("allowPublicKeyRetrieval", "true");
  }
  const adapter = new PrismaMariaDb(connection.toString());
  const prisma = new PrismaClient({ adapter, log: [] });
  databaseGlobal.etimePrisma = prisma;
  return prisma;
}

export async function disconnectDatabase(): Promise<void> {
  await databaseGlobal.etimePrisma?.$disconnect();
  delete databaseGlobal.etimePrisma;
}
