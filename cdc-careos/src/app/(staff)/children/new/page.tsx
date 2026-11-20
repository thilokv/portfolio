import type { Metadata } from "next";
import { requireStaffPage } from "@/server/auth/actor";
import { getT } from "@/i18n/server";
import { PageHeader } from "@/components/ui/misc";
import { RegisterChildForm } from "@/components/children/child-form";

export const metadata: Metadata = { title: "Register child" };

export default async function NewChildPage() {
  await requireStaffPage("children.register");
  const t = await getT();
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t("children.registerTitle")} />
      <RegisterChildForm />
    </div>
  );
}
