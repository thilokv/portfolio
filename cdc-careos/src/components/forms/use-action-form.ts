"use client";
import { useTransition } from "react";
import { useForm, type DefaultValues, type FieldValues, type Path } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import type { z } from "zod";
import { useT } from "@/i18n/client";
import type { ActionResult } from "@/server/errors";

/**
 * React Hook Form + Zod on the client, a Server Action on the server (which
 * re-validates). Server field errors are mapped back onto the form.
 */
export function useActionForm<T extends FieldValues, R = unknown>({
  schema,
  defaultValues,
  action,
  onSuccess,
  successMessage,
}: {
  schema: z.ZodType<T, T>;
  defaultValues: DefaultValues<T>;
  action: (values: T) => Promise<ActionResult<R>>;
  onSuccess?: (result: { data?: R; message?: string }) => void;
  successMessage?: string;
}) {
  const t = useT();
  const [pending, startTransition] = useTransition();
  const form = useForm<T>({ resolver: zodResolver(schema), defaultValues, mode: "onTouched" });

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      let res: ActionResult<R>;
      try {
        res = await action(values);
      } catch {
        toast.error(t("errors.unexpected"));
        return;
      }
      if (!res.ok) {
        if (res.fieldErrors) {
          for (const [name, message] of Object.entries(res.fieldErrors)) {
            form.setError(name as Path<T>, { message });
          }
        }
        toast.error(t(res.error));
        return;
      }
      const msg = res.message ?? successMessage;
      if (msg) toast.success(t(msg));
      onSuccess?.({ data: res.data, message: res.message });
    });
  });

  const err = (name: Path<T>) => {
    const parts = String(name).split(".");
    let node: unknown = form.formState.errors;
    for (const p of parts) node = (node as Record<string, unknown> | undefined)?.[p];
    return (node as { message?: string } | undefined)?.message;
  };

  return { form, onSubmit, pending, err };
}
