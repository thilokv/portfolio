/**
 * Production-safe bootstrap: creates an organization (if needed), its default
 * services and an administrator with a one-time temporary password.
 *
 *   node --env-file=.env.local --conditions=react-server --import tsx scripts/create-admin.ts \
 *     --org-name "Sunrise CDC" --org-code SUNRISE --name "Full Name" --email admin@example.in
 */
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, sql } from "drizzle-orm";
import * as schema from "../src/db/schema";
import { hashPassword } from "../src/server/auth/crypto";
import { generateTempPassword } from "../src/server/services/children";

const SERVICES = [
  ["early_intervention", "Early intervention", "ముందస్తు జోక్యం"],
  ["speech_therapy", "Speech & language therapy", "స్పీచ్ & భాషా థెరపీ"],
  ["occupational_therapy", "Occupational therapy", "ఆక్యుపేషనల్ థెరపీ"],
  ["special_education", "Special education", "ప్రత్యేక విద్య"],
  ["behaviour_support", "Behaviour support", "ప్రవర్తన సహాయం"],
  ["physiotherapy", "Physiotherapy", "ఫిజియోథెరపీ"],
  ["psychology", "Psychological services", "మానసిక సేవలు"],
] as const;

function arg(name: string): string {
  const i = process.argv.indexOf(`--${name}`);
  const v = i > 0 ? process.argv[i + 1] : undefined;
  if (!v) throw new Error(`Missing --${name}`);
  return v;
}

async function main() {
  const orgName = arg("org-name");
  const orgCode = arg("org-code").toUpperCase();
  const name = arg("name");
  const email = arg("email").toLowerCase();
  if (!/^[A-Z0-9_]{2,32}$/.test(orgCode)) throw new Error("org-code: 2-32 letters/digits");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Invalid e-mail");
  const pool = new Pool({ connectionString: process.env.DATABASE_OWNER_URL, ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : undefined });
  const db = drizzle(pool, { schema });
  const password = generateTempPassword();
  await db.transaction(async (tx) => {
    let [org] = await tx.select().from(schema.organizations).where(eq(schema.organizations.code, orgCode));
    if (!org) {
      [org] = await tx.insert(schema.organizations).values({ name: orgName, code: orgCode }).returning();
      for (const [code, n, te] of SERVICES) await tx.insert(schema.services).values({ organizationId: org.id, code, name: n, nameTe: te });
    }
    const [exists] = await tx.select().from(schema.userAccounts).where(sql`lower(${schema.userAccounts.email}) = ${email}`);
    if (exists) throw new Error("A user with this e-mail already exists");
    const [user] = await tx.insert(schema.userAccounts).values({ organizationId: org.id, email, passwordHash: await hashPassword(password), accountType: "staff", mustChangePassword: true }).returning();
    const [s] = await tx.insert(schema.staff).values({ organizationId: org.id, userId: user.id, fullName: name }).returning();
    await tx.insert(schema.staffRoles).values({ organizationId: org.id, staffId: s.id, role: "admin" });
    await tx.insert(schema.auditLogs).values({ organizationId: org.id, actorType: "system", actorName: "create-admin script", action: "staff.created", entityType: "staff", entityId: s.id, summary: `${name}: admin (bootstrap)` });
  });
  console.log(`Administrator created for ${orgCode}.\nE-mail: ${email}\nTemporary password (shown once, must be changed at first sign-in): ${password}`);
  await pool.end();
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
