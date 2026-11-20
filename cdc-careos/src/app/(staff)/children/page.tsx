import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Search, Users, ChevronRight } from "lucide-react";
import { withOrg } from "@/db";
import { can, requireStaffPage, staffCtx } from "@/server/auth/actor";
import { listChildren, PAGE_SIZE } from "@/server/services/children";
import { childListQuerySchema } from "@/lib/validation/children";
import { getLocale, getT } from "@/i18n/server";
import { CHILD_STATUSES, SERVICE_CODES } from "@/lib/constants";
import { formatAge } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, EmptyState, PageHeader } from "@/components/ui/misc";
import { StatusBadge } from "@/components/status-badges";

export const metadata: Metadata = { title: "Children" };

export default async function ChildrenPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const actor = await requireStaffPage();
  const t = await getT();
  await getLocale();
  const parsed = childListQuerySchema.safeParse(await searchParams);
  const query = parsed.success ? parsed.data : {};
  const { rows, total } = await withOrg(staffCtx(actor), (tx) => listChildren(tx, actor, query));
  const page = query.page ?? 1;
  const filtered = Boolean(query.q || query.status || query.service);
  const qs = (p: number) => {
    const s = new URLSearchParams();
    if (query.q) s.set("q", query.q);
    if (query.status) s.set("status", query.status);
    if (query.service) s.set("service", query.service);
    s.set("page", String(p));
    return `?${s}`;
  };

  return (
    <>
      <PageHeader
        title={t("children.title")}
        description={t("children.subtitle")}
        actions={
          can(actor, "children.register") ? (
            <Button asChild variant="accent">
              <Link href="/children/new">
                <Plus /> {t("children.register")}
              </Link>
            </Button>
          ) : null
        }
      />

      <form className="mb-4 grid gap-2 sm:grid-cols-[1fr_180px_220px_auto]" role="search">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-navy-300" aria-hidden />
          <Input name="q" defaultValue={query.q ?? ""} placeholder={t("children.searchPlaceholder")} className="pl-10" aria-label={t("common.search")} />
        </div>
        <Select name="status" defaultValue={query.status ?? ""} aria-label={t("children.filterStatus")}>
          <option value="">{t("children.filterStatus")}: {t("common.all")} ({t("enum.childStatus.active")}…)</option>
          <option value="all">{t("common.all")}</option>
          {CHILD_STATUSES.map((s) => (
            <option key={s} value={s}>{t(`enum.childStatus.${s}`)}</option>
          ))}
        </Select>
        <Select name="service" defaultValue={query.service ?? ""} aria-label={t("children.filterService")}>
          <option value="">{t("children.filterService")}: {t("common.all")}</option>
          {SERVICE_CODES.map((s) => (
            <option key={s} value={s}>{t(`enum.service.${s}`)}</option>
          ))}
        </Select>
        <Button type="submit" variant="secondary">{t("common.filter")}</Button>
      </form>

      <Card>
        {rows.length === 0 ? (
          <EmptyState
            icon={Users}
            title={filtered ? t("children.noResults") : t("children.empty")}
            description={filtered ? undefined : t("children.emptyHint")}
            action={
              !filtered && can(actor, "children.register") ? (
                <Button asChild variant="accent"><Link href="/children/new"><Plus /> {t("children.register")}</Link></Button>
              ) : undefined
            }
          />
        ) : (
          <ul className="divide-y divide-line" data-testid="children-list">
            {rows.map((c) => (
              <li key={c.id}>
                <Link href={`/children/${c.id}`} className="flex items-center gap-3 px-4 py-3.5 transition hover:bg-navy-50/60 sm:px-5">
                  <Avatar name={c.fullName} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="truncate font-semibold text-ink">{c.fullName}</span>
                      <span className="text-xs font-medium tabular-nums text-muted">{c.childCode}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span className="text-xs text-muted">{formatAge(c.dateOfBirth, t)}</span>
                      {c.services.slice(0, 3).map((s) => (
                        <Badge key={s} tone="teal" className="hidden sm:inline-flex">{t(`enum.service.${s}`)}</Badge>
                      ))}
                    </div>
                  </div>
                  <StatusBadge kind="child" status={c.status} t={t} />
                  <ChevronRight className="size-4 text-navy-300" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {total > PAGE_SIZE && (
        <div className="mt-4 flex items-center justify-between text-sm text-muted">
          <span>{t("common.showing", { count: rows.length, total })}</span>
          <div className="flex gap-2">
            {page > 1 && <Button asChild variant="secondary" size="sm"><Link href={qs(page - 1)}>{t("common.previous")}</Link></Button>}
            {page * PAGE_SIZE < total && <Button asChild variant="secondary" size="sm"><Link href={qs(page + 1)}>{t("common.next")}</Link></Button>}
          </div>
        </div>
      )}
    </>
  );
}
