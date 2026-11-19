/** Append-only audit trail. Call inside the same transaction as the change. */
import "server-only";
import type { Tx } from "@/db";
import { auditLogs } from "@/db/schema";
export interface AuditActor {
  orgId: string;
  userId: string;
  name: string;
  kind: "staff" | "guardian";
}

export interface AuditEntry {
  action: string;
  entityType: string;
  entityId?: string | null;
  childId?: string | null;
  summary?: string;
  changes?: Record<string, unknown> | null;
}

const SENSITIVE_KEYS = new Set(["passwordHash", "password", "token", "tokenHash"]);

/** Field-level diff of plain objects (dates normalised), omitting secrets. */
export function diff(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown>,
): Record<string, { from: unknown; to: unknown }> {
  const out: Record<string, { from: unknown; to: unknown }> = {};
  for (const key of Object.keys(after)) {
    if (SENSITIVE_KEYS.has(key) || key === "updatedAt" || key === "createdAt") continue;
    const norm = (v: unknown) => (v instanceof Date ? v.toISOString() : v === undefined ? null : v);
    const a = norm(before?.[key]);
    const b = norm(after[key]);
    if (JSON.stringify(a) !== JSON.stringify(b)) out[key] = { from: a, to: b };
  }
  return out;
}

export async function audit(tx: Tx, actor: AuditActor | null, entry: AuditEntry, ipAddress?: string) {
  await tx.insert(auditLogs).values({
    organizationId: actor?.orgId ?? (entry.changes?.organizationId as string),
    actorUserId: actor?.userId ?? null,
    actorName: actor?.name ?? "system",
    actorType: actor?.kind ?? "system",
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId ?? null,
    childId: entry.childId ?? null,
    summary: entry.summary?.slice(0, 500),
    changes: entry.changes ?? null,
    ipAddress: ipAddress ?? null,
  });
}
