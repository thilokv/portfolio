import { and, desc, eq, ilike, lt, type SQL } from "drizzle-orm";
import type { Tx } from "@/db";
import { auditLogs } from "@/db/schema";
import type { StaffActor } from "../auth/actor";
import { ForbiddenError } from "../errors";

export async function listAudit(tx: Tx, actor: StaffActor, opts: { childId?: string; action?: string; before?: number; limit?: number }) {
  if (!actor.permissions.includes("audit.view")) throw new ForbiddenError("audit.view");
  const where: SQL[] = [];
  if (opts.childId) where.push(eq(auditLogs.childId, opts.childId));
  if (opts.action) where.push(ilike(auditLogs.action, `%${opts.action.replace(/[%_\\]/g, "")}%`));
  if (opts.before) where.push(lt(auditLogs.id, opts.before));
  return tx
    .select()
    .from(auditLogs)
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(auditLogs.id))
    .limit(opts.limit ?? 50);
}
