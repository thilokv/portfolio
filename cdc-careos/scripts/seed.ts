/**
 * Seeds the FICTIONAL demo organization into a local database.
 *
 *   npm run db:seed          (does nothing if the demo org already exists)
 *
 * Never run against production; it refuses when NODE_ENV=production. Hosted
 * demo deployments load the same data from scripts/vercel-build.ts instead.
 */
import { ownerConnection } from "../src/db/connection";
import { seedDemoData } from "./lib/demo-seed";

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Refusing to seed demo data in production");
  const connection = ownerConnection();
  if (!connection) throw new Error("DATABASE_OWNER_URL not set");
  await seedDemoData(connection);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
