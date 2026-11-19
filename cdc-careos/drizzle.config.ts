import { defineConfig } from "drizzle-kit";

/**
 * Migrations are generated from src/db/schema.ts and applied with
 * `npm run db:migrate` using the OWNER connection (DATABASE_OWNER_URL).
 * The application itself connects with the restricted DATABASE_URL role so
 * that Row Level Security is enforced.
 */
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_OWNER_URL ?? "" },
  strict: true,
});
