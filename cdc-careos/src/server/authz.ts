/** Child-level authorization backed by the care-team (assignments) table. */
import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import type { Tx } from "@/db";
import { childAssignments, children } from "@/db/schema";
import { computeChildAccess, NO_ACCESS, type ChildAccess } from "@/lib/permissions";
import type { StaffActor } from "./auth/actor";
import { ForbiddenError, NotFoundError } from "./errors";

export async function isAssigned(tx: Tx, actor: StaffActor, childId: string): Promise<boolean> {
  const [row] = await tx
    .select({ id: childAssignments.id })
    .from(childAssignments)
    .where(
      and(
        eq(childAssignments.childId, childId),
        eq(childAssignments.staffId, actor.staffId),
        isNull(childAssignments.endedAt),
      ),
    )
    .limit(1);
  return Boolean(row);
}

export async function getChildAccess(tx: Tx, actor: StaffActor, childId: string): Promise<ChildAccess> {
  const [child] = await tx.select({ id: children.id }).from(children).where(eq(children.id, childId)).limit(1);
  if (!child) return NO_ACCESS;
  return computeChildAccess(actor.roles, await isAssigned(tx, actor, childId));
}

type AccessFlag = keyof ChildAccess;

/**
 * Loads access for a child and throws if the flag is not granted. A child the
 * actor may not see at all is reported as "not found" to avoid leaking that
 * the record exists.
 */
export async function assertChildAccess(
  tx: Tx,
  actor: StaffActor,
  childId: string,
  flag: AccessFlag = "canView",
): Promise<ChildAccess> {
  const access = await getChildAccess(tx, actor, childId);
  if (!access.canView) throw new NotFoundError("child");
  if (!access[flag]) throw new ForbiddenError(flag);
  return access;
}

/** IDs of children visible to a staff member (null = all in organization). */
export async function visibleChildIds(tx: Tx, actor: StaffActor): Promise<string[] | null> {
  if (actor.permissions.includes("children.view_all")) return null;
  const rows = await tx
    .select({ childId: childAssignments.childId })
    .from(childAssignments)
    .where(and(eq(childAssignments.staffId, actor.staffId), isNull(childAssignments.endedAt)));
  return rows.map((r) => r.childId);
}
