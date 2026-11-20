"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Input, Select } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { FormField } from "@/components/forms/form-field";
import { useT } from "@/i18n/client";
import { DOCUMENT_CATEGORIES, MAX_UPLOAD_BYTES, ALLOWED_UPLOAD_TYPES } from "@/lib/constants";
import { uploadDocumentAction } from "@/server/actions/documents";

export function UploadDialog({ childId, canRestrict }: { childId: string; canRestrict: boolean }) {
  const t = useT();
  const router = useRouter();
  const ref = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const file = fd.get("file") as File | null;
    const errs: Record<string, string> = {};
    if (!String(fd.get("title") ?? "").trim()) errs.title = "validation.required";
    if (!file || file.size === 0) errs.file = "validation.file";
    else if (file.size > MAX_UPLOAD_BYTES) errs.file = "validation.fileSize";
    else if (!ALLOWED_UPLOAD_TYPES[file.type]) errs.file = "validation.fileType";
    setError(errs);
    if (Object.keys(errs).length) return;
    fd.set("childId", childId);
    fd.set("isRestricted", fd.get("isRestricted") ? "true" : "false");
    fd.set("visibleToGuardians", fd.get("visibleToGuardians") ? "true" : "false");
    start(async () => {
      const res = await uploadDocumentAction(fd);
      if (!res.ok) return void toast.error(t(res.error));
      toast.success(t("documents.uploaded"));
      ref.current?.reset();
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="accent"><Upload /> {t("documents.upload")}</Button></DialogTrigger>
      <DialogContent title={t("documents.upload")} description={t("documents.allowed")}>
        <form ref={ref} onSubmit={submit} className="space-y-4" noValidate>
          <FormField label={t("documents.docTitle")} htmlFor="d-title" required error={error.title}>
            <Input id="d-title" name="title" maxLength={200} />
          </FormField>
          <FormField label={t("documents.category")} htmlFor="d-cat">
            <Select id="d-cat" name="category" defaultValue="external_report">
              {DOCUMENT_CATEGORIES.map((c) => <option key={c} value={c}>{t(`enum.documentCategory.${c}`)}</option>)}
            </Select>
          </FormField>
          <FormField label={t("documents.file")} htmlFor="d-file" required error={error.file}>
            <Input id="d-file" name="file" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="py-2" />
          </FormField>
          {canRestrict && <label className="flex items-center gap-2 text-sm"><Checkbox name="isRestricted" value="1" /> {t("documents.restricted")}</label>}
          <label className="flex items-center gap-2 text-sm"><Checkbox name="visibleToGuardians" value="1" /> {t("documents.visibleToGuardians")}</label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
            <Button type="submit" loading={pending}>{t("common.upload")}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
