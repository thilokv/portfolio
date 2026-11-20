"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ClipboardCheck, PencilLine, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { FormField } from "@/components/forms/form-field";
import { useActionForm } from "@/components/forms/use-action-form";
import { useT } from "@/i18n/client";
import { DEVELOPMENTAL_DOMAINS, GOAL_STATUSES } from "@/lib/constants";
import { addDays, isoDateIST } from "@/lib/dates";
import {
  goalReviewSchema,
  goalSchema,
  planSchema,
  reviseGoalSchema,
  type GoalInput,
  type GoalReviewInput,
  type PlanInput,
  type ReviseGoalInput,
} from "@/lib/validation/plans";
import { addGoalAction, createPlanAction, reviewGoalAction, reviseGoalAction } from "@/server/actions/plans";

export function NewPlanDialog({ childId }: { childId: string }) {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { form, onSubmit, pending, err } = useActionForm<PlanInput>({
    schema: planSchema,
    defaultValues: { childId, title: "", startDate: isoDateIST(), reviewDate: addDays(isoDateIST(), 90), familyPriorities: "" },
    action: createPlanAction,
    successMessage: "plans.created",
    onSuccess: () => {
      setOpen(false);
      router.refresh();
    },
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="accent"><Plus /> {t("plans.newPlan")}</Button></DialogTrigger>
      <DialogContent title={t("plans.newPlan")}>
        <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2" noValidate>
          <FormField label={t("plans.planTitle")} htmlFor="p-title" required error={err("title")} className="sm:col-span-2">
            <Input id="p-title" {...form.register("title")} />
          </FormField>
          <FormField label={t("plans.startDate")} htmlFor="p-start" required error={err("startDate")}>
            <Input id="p-start" type="date" {...form.register("startDate")} />
          </FormField>
          <FormField label={t("plans.reviewDate")} htmlFor="p-review" required error={err("reviewDate")}>
            <Input id="p-review" type="date" {...form.register("reviewDate")} />
          </FormField>
          <FormField label={t("plans.familyPriorities")} htmlFor="p-fam" error={err("familyPriorities")} className="sm:col-span-2">
            <Textarea id="p-fam" rows={3} {...form.register("familyPriorities")} />
          </FormField>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
            <Button type="submit" loading={pending}>{t("common.create")}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type Opts = { team: { id: string; fullName: string }[]; services: { id: string; code: string }[] };

function GoalFields({ form, err, team, services }: Opts & { form: ReturnType<typeof useActionForm<GoalInput>>["form"]; err: (n: string) => string | undefined }) {
  const t = useT();
  const r = form.register as unknown as (n: string) => object;
  return (
    <>
      <FormField label={t("plans.goalTitle")} htmlFor="g-title" required error={err("title")} className="sm:col-span-2">
        <Input id="g-title" {...r("title")} />
      </FormField>
      <FormField label={t("plans.domain")} htmlFor="g-domain" required>
        <Select id="g-domain" {...r("domain")}>
          {DEVELOPMENTAL_DOMAINS.map((d) => <option key={d} value={d}>{t(`enum.domain.${d}`)}</option>)}
        </Select>
      </FormField>
      <FormField label={t("schedule.service")} htmlFor="g-service">
        <Select id="g-service" {...r("serviceId")}>
          <option value="">—</option>
          {services.map((s) => <option key={s.id} value={s.id}>{t(`enum.service.${s.code}`)}</option>)}
        </Select>
      </FormField>
      <FormField label={t("plans.baseline")} htmlFor="g-baseline" required hint={t("plans.baselineHint")} error={err("baseline")} className="sm:col-span-2">
        <Textarea id="g-baseline" rows={2} {...r("baseline")} />
      </FormField>
      <FormField label={t("plans.target")} htmlFor="g-target" required hint={t("plans.targetHint")} error={err("target")} className="sm:col-span-2">
        <Textarea id="g-target" rows={2} {...r("target")} />
      </FormField>
      <FormField label={t("plans.measurementMethod")} htmlFor="g-method" required hint={t("plans.measurementHint")} error={err("measurementMethod")}>
        <Input id="g-method" {...r("measurementMethod")} />
      </FormField>
      <FormField label={t("plans.targetPercent")} htmlFor="g-pct" error={err("targetPercent")}>
        <Input id="g-pct" inputMode="numeric" {...r("targetPercent")} />
      </FormField>
      <FormField label={t("plans.strategies")} htmlFor="g-strat" required error={err("strategies")} className="sm:col-span-2">
        <Textarea id="g-strat" rows={2} {...r("strategies")} />
      </FormField>
      <FormField label={t("plans.responsible")} htmlFor="g-resp" required error={err("responsibleStaffId")}>
        <Select id="g-resp" {...r("responsibleStaffId")}>
          <option value="">—</option>
          {team.map((s) => <option key={s.id} value={s.id}>{s.fullName}</option>)}
        </Select>
      </FormField>
      <FormField label={t("plans.reviewDate")} htmlFor="g-review" required error={err("reviewDate")}>
        <Input id="g-review" type="date" {...r("reviewDate")} />
      </FormField>
      <FormField label={t("plans.goalStatus")} htmlFor="g-status" required>
        <Select id="g-status" {...r("status")}>
          {GOAL_STATUSES.map((s) => <option key={s} value={s}>{t(`enum.goalStatus.${s}`)}</option>)}
        </Select>
      </FormField>
    </>
  );
}

export function AddGoalDialog({ planId, reviewDate, defaultResponsible, ...opts }: Opts & { planId: string; reviewDate: string; defaultResponsible: string }) {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { form, onSubmit, pending, err } = useActionForm<GoalInput>({
    schema: goalSchema,
    defaultValues: { planId, domain: "communication", serviceId: "", title: "", baseline: "", target: "", measurementMethod: "", targetPercent: "", strategies: "", responsibleStaffId: defaultResponsible, reviewDate, status: "not_started" },
    action: addGoalAction,
    successMessage: "plans.goalCreated",
    onSuccess: () => {
      setOpen(false);
      form.reset();
      router.refresh();
    },
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="secondary"><Plus /> {t("plans.addGoal")}</Button></DialogTrigger>
      <DialogContent title={t("plans.addGoal")} className="sm:max-w-2xl">
        <Alert tone="info" className="mb-4">{t("plans.noPrescriptionNotice")}</Alert>
        <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2" noValidate>
          <GoalFields form={form} err={err as (n: string) => string | undefined} {...opts} />
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
            <Button type="submit" loading={pending}>{t("common.save")}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ReviseGoalDialog({ goal, ...opts }: Opts & { goal: Omit<ReviseGoalInput, "revisionReason"> }) {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { form, onSubmit, pending, err } = useActionForm<ReviseGoalInput, { version: number }>({
    schema: reviseGoalSchema,
    defaultValues: { ...goal, revisionReason: "" },
    action: reviseGoalAction,
    onSuccess: ({ data }) => {
      toast.success(t("plans.revised", { v: data?.version ?? "" }));
      setOpen(false);
      router.refresh();
    },
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="ghost"><PencilLine /> {t("plans.revise")}</Button></DialogTrigger>
      <DialogContent title={t("plans.revise")} description={t("plans.reviseHint")} className="sm:max-w-2xl">
        <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2" noValidate>
          <GoalFields form={form as never} err={err as (n: string) => string | undefined} {...opts} />
          <FormField label={t("plans.revisionReason")} htmlFor="g-reason" required error={err("revisionReason")} className="sm:col-span-2">
            <Textarea id="g-reason" rows={2} {...form.register("revisionReason")} />
          </FormField>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
            <Button type="submit" loading={pending}>{t("common.save")}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ReviewGoalDialog({ goalId, status }: { goalId: string; status: string }) {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { form, onSubmit, pending, err } = useActionForm<GoalReviewInput>({
    schema: goalReviewSchema,
    defaultValues: { goalId, reviewedOn: isoDateIST(), statusAfter: status as GoalReviewInput["statusAfter"], summary: "" },
    action: reviewGoalAction,
    successMessage: "plans.reviewSaved",
    onSuccess: () => {
      setOpen(false);
      router.refresh();
    },
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="ghost"><ClipboardCheck /> {t("plans.review")}</Button></DialogTrigger>
      <DialogContent title={t("plans.review")}>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label={t("common.date")} htmlFor="r-date" required error={err("reviewedOn")}>
              <Input id="r-date" type="date" {...form.register("reviewedOn")} />
            </FormField>
            <FormField label={t("plans.goalStatus")} htmlFor="r-status" required>
              <Select id="r-status" {...form.register("statusAfter")}>
                {GOAL_STATUSES.map((s) => <option key={s} value={s}>{t(`enum.goalStatus.${s}`)}</option>)}
              </Select>
            </FormField>
          </div>
          <FormField label={t("plans.reviewSummary")} htmlFor="r-sum" required error={err("summary")}>
            <Textarea id="r-sum" rows={3} {...form.register("summary")} />
          </FormField>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
            <Button type="submit" loading={pending}>{t("common.save")}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
