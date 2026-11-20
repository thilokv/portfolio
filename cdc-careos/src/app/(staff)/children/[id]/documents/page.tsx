import { FileText, Lock, Download, Archive, Eye } from "lucide-react";
import { withOrg } from "@/db";
import { staffCtx } from "@/server/auth/actor";
import { loadChild } from "@/server/loaders";
import { listDocuments } from "@/server/services/documents";
import { archiveDocumentAction } from "@/server/actions/documents";
import { getLocale, getT } from "@/i18n/server";
import { formatDate } from "@/lib/dates";
import { formatBytes } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState, SectionTitle } from "@/components/ui/misc";
import { UploadDialog } from "@/components/documents/upload-dialog";
import { ConfirmActionButton } from "@/components/confirm-action-button";

export default async function DocumentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { child, access, actor } = await loadChild(id);
  const [t, locale] = [await getT(), await getLocale()];
  const docs = await withOrg(staffCtx(actor), (tx) => listDocuments(tx, actor, id));
  const canUpload = actor.permissions.includes("documents.upload") && child.status !== "archived";
  return (
    <div>
      <SectionTitle action={canUpload ? <UploadDialog childId={id} canRestrict={access.canViewRestricted} /> : null}>{t("documents.title")}</SectionTitle>
      <Card>
        {docs.length === 0 ? (
          <EmptyState icon={FileText} title={t("documents.empty")} description={t("documents.allowed")} />
        ) : (
          <ul className="divide-y divide-line">
            {docs.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
                <span className="grid size-10 place-items-center rounded-xl bg-navy-50 text-navy-500">{d.isRestricted ? <Lock className="size-5" /> : <FileText className="size-5" />}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-ink">{d.title ?? t("common.restricted")}</p>
                  <p className="text-xs text-muted">{t(`enum.documentCategory.${d.category}`)} · {formatBytes(d.sizeBytes)} · {d.uploader} · {formatDate(d.createdAt, locale)}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  {d.visibleToGuardians && <Badge tone="teal"><Eye className="size-3" /> {t("nav.portalHome")}</Badge>}
                  {d.canOpen && (
                    <a href={`/api/documents/${d.id}`} className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-line px-3 text-xs font-semibold hover:bg-navy-50">
                      <Download className="size-3.5" /> {t("common.download")}
                    </a>
                  )}
                  {d.canArchive && child.status !== "archived" && (
                    <ConfirmActionButton label={t("common.archive")} confirmText={t("documents.archived")} action={archiveDocumentAction.bind(null, d.id)} variant="ghost" icon={<Archive />} />
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
