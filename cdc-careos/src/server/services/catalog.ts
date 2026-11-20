import { asc, eq } from "drizzle-orm";
import type { Tx } from "@/db";
import { services } from "@/db/schema";

export async function listServices(tx: Tx, activeOnly = true) {
  return tx
    .select()
    .from(services)
    .where(activeOnly ? eq(services.isActive, true) : undefined)
    .orderBy(asc(services.name));
}
