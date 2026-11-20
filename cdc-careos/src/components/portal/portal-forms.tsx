"use client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { FormField } from "@/components/forms/form-field";
import { useActionForm } from "@/components/forms/use-action-form";
import { useT } from "@/i18n/client";
import { LANGUAGES } from "@/lib/constants";
import { contactUpdateSchema, feedbackSchema } from "@/lib/validation/communication";
import { sendFeedbackAction, updateContactAction } from "@/server/actions/portal";
import type { z } from "zod";

export function FeedbackForm({ childrenOptions }: { childrenOptions: { id: string; name: string }[] }) {
  const t = useT();
  const router = useRouter();
  const { form, onSubmit, pending, err } = useActionForm<z.infer<typeof feedbackSchema>>({
    schema: feedbackSchema,
    defaultValues: { childId: childrenOptions[0]?.id ?? "", subject: "", body: "" },
    action: sendFeedbackAction,
    successMessage: "portal.feedbackSent",
    onSuccess: () => {
      form.reset({ childId: childrenOptions[0]?.id ?? "", subject: "", body: "" });
      router.refresh();
    },
  });
  return (
    <form onSubmit={onSubmit} className="space-y-3" noValidate>
      {childrenOptions.length > 1 && (
        <FormField label={t("schedule.child")} htmlFor="fb-child">
          <Select id="fb-child" {...form.register("childId")}>{childrenOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
        </FormField>
      )}
      <FormField label={t("portal.feedbackSubject")} htmlFor="fb-subject" required error={err("subject")}>
        <Input id="fb-subject" {...form.register("subject")} />
      </FormField>
      <FormField label={t("portal.feedbackBody")} htmlFor="fb-body" required error={err("body")}>
        <Textarea id="fb-body" rows={4} {...form.register("body")} />
      </FormField>
      <Button type="submit" variant="accent" loading={pending}>{t("common.submit")}</Button>
    </form>
  );
}

export function ContactForm({ initial }: { initial: z.infer<typeof contactUpdateSchema> }) {
  const t = useT();
  const router = useRouter();
  const { form, onSubmit, pending, err } = useActionForm<z.infer<typeof contactUpdateSchema>>({
    schema: contactUpdateSchema,
    defaultValues: initial,
    action: updateContactAction,
    successMessage: "portal.contactUpdated",
    onSuccess: () => router.refresh(),
  });
  return (
    <form onSubmit={onSubmit} className="space-y-3" noValidate>
      <FormField label={t("children.guardianPhone")} htmlFor="ct-phone" required error={err("phone")}>
        <Input id="ct-phone" type="tel" inputMode="tel" {...form.register("phone")} />
      </FormField>
      <FormField label={t("children.guardianAltPhone")} htmlFor="ct-alt" error={err("alternatePhone")}>
        <Input id="ct-alt" type="tel" inputMode="tel" {...form.register("alternatePhone")} />
      </FormField>
      <FormField label={t("children.address")} htmlFor="ct-addr" error={err("address")}>
        <Textarea id="ct-addr" rows={2} {...form.register("address")} />
      </FormField>
      <FormField label={t("children.preferredLanguage")} htmlFor="ct-lang">
        <Select id="ct-lang" {...form.register("preferredLanguage")}>{LANGUAGES.map((l) => <option key={l} value={l}>{t(`enum.language.${l}`)}</option>)}</Select>
      </FormField>
      <Button type="submit" loading={pending}>{t("common.save")}</Button>
    </form>
  );
}
