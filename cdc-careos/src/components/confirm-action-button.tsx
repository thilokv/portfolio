"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { useT } from "@/i18n/client";
import type { ActionResult } from "@/server/errors";

/** A button that asks for confirmation, then calls a server action. */
export function ConfirmActionButton({
  label,
  confirmText,
  action,
  successMessage,
  variant = "primary",
  size = "sm",
  icon,
  redirectTo,
}: {
  label: string;
  confirmText?: string;
  action: () => Promise<ActionResult<unknown>>;
  successMessage?: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  icon?: React.ReactNode;
  redirectTo?: string;
}) {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const run = () =>
    start(async () => {
      const res = await action();
      if (!res.ok) return void toast.error(t(res.error));
      if (res.message ?? successMessage) toast.success(t((res.message ?? successMessage)!));
      setOpen(false);
      if (redirectTo) router.push(redirectTo);
      router.refresh();
    });
  if (!confirmText)
    return (
      <Button variant={variant} size={size} onClick={run} loading={pending}>
        {icon}
        {label}
      </Button>
    );
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size}>{icon}{label}</Button>
      </DialogTrigger>
      <DialogContent title={label} description={confirmText}>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
          <Button variant={variant === "danger-outline" ? "danger" : variant} onClick={run} loading={pending}>{t("common.confirm")}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
