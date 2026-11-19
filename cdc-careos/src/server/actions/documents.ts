"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { withOrg } from "@/db";
import { DOCUMENT_CATEGORIES } from "@/lib/constants";
import { req, uuid } from "@/lib/validation/common";
import { requireStaff, staffCtx } from "../auth/actor";
import { consumeRateLimit, RULES } from "../auth/rate-limit";
import { runAction } from "../action";
import { toActionError, type ActionResult } from "../errors";
import { putObject, validateUpload } from "../storage";
import { archiveDocument, createDocumentRecord } from "../services/documents";

const metaSchema = z.object({
  childId: uuid,
  title: req(200),
  category: z.enum(DOCUMENT_CATEGORIES),
  isRestricted: z.enum(["true", "false"]),
  visibleToGuardians: z.enum(["true", "false"]),
});

export async function uploadDocumentAction(formData: FormData): Promise<ActionResult> {
  const meta = metaSchema.safeParse(Object.fromEntries(["childId", "title", "category", "isRestricted", "visibleToGuardians"].map((k) => [k, formData.get(k) ?? ""])));
  if (!meta.success) return { ok: false, error: "errors.invalidData", fieldErrors: { title: "validation.required" } };
  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, error: "validation.file" };
  try {
    const actor = await requireStaff("documents.upload");
    if (!(await consumeRateLimit(RULES.upload, actor.userId))) return { ok: false, error: "auth.rateLimited" };
    const buf = Buffer.from(await file.arrayBuffer());
    const check = validateUpload(buf);
    if (!check.ok) return { ok: false, error: check.error };
    const m = meta.data;
    // Authorize BEFORE writing to disk: a zero-cost check of child access.
    await withOrg(staffCtx(actor), async (tx) => {
      const { assertChildAccess } = await import("../authz");
      await assertChildAccess(tx, actor, m.childId);
    });
    const stored = await putObject(actor.orgId, buf, check.mime);
    await withOrg(staffCtx(actor), (tx) =>
      createDocumentRecord(tx, actor, {
        childId: m.childId,
        title: m.title,
        category: m.category,
        isRestricted: m.isRestricted === "true",
        visibleToGuardians: m.visibleToGuardians === "true",
        storageKey: stored.key,
        originalFilename: file.name.replace(/[^\w.\- ]+/g, "_").slice(0, 150) || "document",
        mimeType: check.mime,
        sizeBytes: buf.length,
        sha256: stored.sha256,
      }),
    );
    revalidatePath(`/children/${m.childId}/documents`);
    return { ok: true, message: "documents.uploaded" };
  } catch (err) {
    return toActionError(err);
  }
}

export async function archiveDocumentAction(id: string): Promise<ActionResult> {
  return runAction(uuid, id, async (docId) => {
    const actor = await requireStaff();
    const childId = await withOrg(staffCtx(actor), (tx) => archiveDocument(tx, actor, docId));
    revalidatePath(`/children/${childId}/documents`);
    return { ok: true, message: "documents.archived" };
  });
}
