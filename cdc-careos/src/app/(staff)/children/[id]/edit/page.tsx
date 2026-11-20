import { redirect } from "next/navigation";
import { loadChild } from "@/server/loaders";
import { getT } from "@/i18n/server";
import { EditChildForm } from "@/components/children/child-form";

export default async function EditChildPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { child, access } = await loadChild(id);
  if (!access.canEditProfile || child.status === "archived") redirect(`/children/${id}`);
  const t = await getT();
  const s = (v: string | null) => v ?? "";
  return (
    <div className="mx-auto max-w-3xl">
      <h2 className="mb-4 text-lg font-semibold">{t("children.editTitle")}</h2>
      <EditChildForm
        initial={{
          id: child.id,
          fullName: child.fullName,
          preferredName: s(child.preferredName),
          dateOfBirth: child.dateOfBirth,
          sex: (child.sex ?? "") as "",
          preferredLanguage: child.preferredLanguage,
          address: s(child.address),
          emergencyContactName: s(child.emergencyContactName),
          emergencyContactPhone: s(child.emergencyContactPhone),
          emergencyContactRelation: s(child.emergencyContactRelation),
          developmentalHistory: s(child.developmentalHistory),
          parentConcerns: s(child.parentConcerns),
          medicalHistory: s(child.medicalHistory),
          existingReportsSummary: s(child.existingReportsSummary),
          referralSource: s(child.referralSource),
          status: child.status as "active",
        }}
      />
    </div>
  );
}
