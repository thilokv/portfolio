import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { withOrg } from "@/db";
import { documents } from "@/db/schema";
import { getActor, guardianCtx, staffCtx } from "@/server/auth/actor";
import { authorizeStaffDownload } from "@/server/services/documents";
import { audit } from "@/server/audit";
import { getObject } from "@/server/storage";
import { AppError } from "@/server/errors";

/** Authorized document download. Staff: care-team + restricted checks.
 *  Guardians: Row Level Security only exposes portal-visible documents. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse("Not found", { status: 404 });
  const actor = await getActor();
  if (!actor) return new NextResponse("Unauthorized", { status: 401 });
  try {
    const doc =
      actor.kind === "staff"
        ? await withOrg(staffCtx(actor), (tx) => authorizeStaffDownload(tx, actor, id))
        : await withOrg(guardianCtx(actor), async (tx) => {
            const [d] = await tx.select().from(documents).where(and(eq(documents.id, id), isNull(documents.archivedAt)));
            if (!d) throw new AppError("errors.notFound");
            await audit(tx, actor, { action: "document.downloaded", entityType: "document", entityId: id, childId: d.childId });
            return d;
          });
    const body = await getObject(doc.storageKey);
    return new NextResponse(new Uint8Array(body), {
      headers: {
        "Content-Type": doc.mimeType,
        "Content-Disposition": `attachment; filename="${doc.originalFilename.replace(/"/g, "")}"`,
        "Content-Length": String(body.length),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
