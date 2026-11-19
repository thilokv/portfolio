"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { FormField } from "@/components/forms/form-field";
import { useT } from "@/i18n/client";
import { archiveChildAction, restoreChildAction } from "@/server/actions/children";

export function ChildHeaderActions({ childId, archived, canEdit, canArchive }: { childId: string; archived: boolean; canEdit: boolean; canArchive: boolean }) {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  const archive = () =>
    start(async () => {
      if (!reason.trim()) return setError("validation.required");
      const res = await archiveChildAction({ id: childId, reason });
      if (!res.ok) return void toast.error(t(res.error));
      toast.success(t("children.archived"));
      setOpen(false);
      router.refresh();
    });
  const restore = () =>
    start(async () => {
      const res = await restoreChildAction(childId);
      if (!res.ok) return void toast.error(t(res.error));
      toast.success(t("children.restored"));
      router.refresh();
    });

  return (
    <div className="flex flex-wrap gap-2">
      {canEdit && !archived && (
        <Button asChild variant="secondary" size="sm">
          <Link href={`/children/${childId}/edit`}><Pencil /> {t("common.edit")}</Link>
        </Button>
      )}
      {canArchive && archived && (
        <Button variant="secondary" size="sm" onClick={restore} loading={pending}><ArchiveRestore /> {t("common.restore")}</Button>
      )}
      {canArchive && !archived && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="danger-outline" size="sm"><Archive /> {t("common.archive")}</Button>
          </DialogTrigger>
          <DialogContent title={t("children.archiveTitle")} description={t("children.archiveBody")}>
            <FormField label={t("children.archiveReason")} htmlFor="archiveReason" required error={error}>
              <Textarea id="archiveReason" value={reason} onChange={(e) => { setReason(e.target.value); setError(undefined); }} />
            </FormField>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
              <Button variant="danger" onClick={archive} loading={pending}>{t("common.archive")}</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
