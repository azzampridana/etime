import { loadEnvConfig } from "@next/env";
import { disconnectDatabase } from "@/lib/db/prisma";
import { seedInitialAdmin } from "@/services/bootstrap.service";

async function main() {
  loadEnvConfig(process.cwd());
  try {
    await seedInitialAdmin(process.env);
    console.log("Default work schedule and initial ADMIN are ready. Existing records were preserved.");
  } catch {
    // Zod and driver errors can contain sensitive inputs. Never print them.
    console.error("Seed failed. Check seed environment configuration, database connectivity, and existing bootstrap records.");
    process.exitCode = 1;
  } finally {
    await disconnectDatabase();
  }
}

void main();
