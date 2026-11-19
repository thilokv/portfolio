import { and, desc, eq, isNull } from "drizzle-orm";
import type { Tx } from "@/db";
import { documents, staff } from "@/db/schema";
import type { StaffActor } from "../auth/actor";
import { audit } from "../audit";
import { assertChildAccess } from "../authz";
import { AppError, ForbiddenError, NotFoundError } from "../errors";

export async function listDocuments(tx: Tx, actor: StaffActor, childId: string) {
  const access = await assertChildAccess(tx, actor, childId);
  const rows = await tx
    .select({ d: documents, uploader: staff.fullName })
    .from(documents)
    .innerJoin(staff, eq(staff.id, documents.uploadedBy))
    .where(and(eq(documents.childId, childId), isNull(documents.archivedAt)))
    .orderBy(desc(documents.createdAt));
  return rows.map(({ d, uploader }) => ({
    id: d.id,
    title: d.isRestricted && !access.canViewRestricted ? null : d.title,
    category: d.category,
    sizeBytes: d.sizeBytes,
    mimeType: d.mimeType,
    isRestricted: d.isRestricted,
    visibleToGuardians: d.visibleToGuardians,
    createdAt: d.createdAt,
    uploader,
    canOpen: !d.isRestricted || access.canViewRestricted,
    canArchive: d.uploadedBy === actor.staffId || actor.permissions.includes("children.archive"),
  }));
}

export async function createDocumentRecord(
  tx: Tx,
  actor: StaffActor,
  input: { childId: string; title: string; category: string; isRestricted: boolean; visibleToGuardians: boolean; storageKey: string; originalFilename: string; mimeType: string; sizeBytes: number; sha256: string },
) {
  if (!actor.permissions.includes("documents.upload")) throw new ForbiddenError("documents.upload");
  const access = await assertChildAccess(tx, actor, input.childId);
  if (input.isRestricted && !access.canViewRestricted) throw new ForbiddenError("restricted");
  if (input.isRestricted && input.visibleToGuardians) throw new AppError("errors.invalidData");
  const [row] = await tx
    .insert(documents)
    .values({ ...input, category: input.category as "other", organizationId: actor.orgId, uploadedBy: actor.staffId })
    .returning({ id: documents.id });
  await audit(tx, actor, { action: "document.uploaded", entityType: "document", entityId: row.id, childId: input.childId, summary: input.category });
  return row.id;
}

export async function archiveDocument(tx: Tx, actor: StaffActor, id: string) {
  const [d] = await tx.select().from(documents).where(eq(documents.id, id));
  if (!d || d.archivedAt) throw new NotFoundError("document");
  await assertChildAccess(tx, actor, d.childId);
  if (d.uploadedBy !== actor.staffId && !actor.permissions.includes("children.archive")) throw new ForbiddenError("document");
  await tx.update(documents).set({ archivedAt: new Date() }).where(eq(documents.id, id));
  await audit(tx, actor, { action: "document.archived", entityType: "document", entityId: id, childId: d.childId });
  return d.childId;
}

/** Returns the document if the staff actor may download it. */
export async function authorizeStaffDownload(tx: Tx, actor: StaffActor, id: string) {
  const [d] = await tx.select().from(documents).where(eq(documents.id, id));
  if (!d || d.archivedAt) throw new NotFoundError("document");
  const access = await assertChildAccess(tx, actor, d.childId);
  if (d.isRestricted && !access.canViewRestricted) throw new ForbiddenError("restricted");
  await audit(tx, actor, { action: "document.downloaded", entityType: "document", entityId: id, childId: d.childId });
  return d;
}
