import { redirect } from "next/navigation";
import { withOrg } from "@/db";
import { staffCtx } from "@/server/auth/actor";
import { loadChild } from "@/server/loaders";
import { listServices } from "@/server/services/catalog";
import { getT } from "@/i18n/server";
import { ASSESSMENT_FORM_DOMAINS, SERVICE_ROLES, type ServiceCode } from "@/lib/constants";
import { isoDateIST } from "@/lib/dates";
import { AssessmentForm } from "@/components/assessments/assessment-form";

export default async function NewAssessmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { child, access, actor } = await loadChild(id);
  if (!access.canWriteClinical || child.status === "archived") redirect(`/children/${id}/assessments`);
  const t = await getT();
  const services = (await withOrg(staffCtx(actor), (tx) => listServices(tx))).filter((s) =>
    actor.roles.some((r) => SERVICE_ROLES[s.code as ServiceCode].includes(r)),
  );
  const roles = actor.roles.filter((r) => r !== "admin");
  return (
    <div className="mx-auto max-w-3xl">
      <h2 className="mb-4 text-lg font-semibold">{t("assessments.new")}</h2>
      <AssessmentForm
        roles={roles}
        services={services.map((s) => ({ id: s.id, code: s.code }))}
        canRestrict={access.canViewRestricted}
        initial={{
          childId: id,
          serviceId: "",
          assessorRole: roles[0],
          assessmentDate: isoDateIST(),
          toolName: "",
          toolVersion: "",
          reasonForAssessment: "",
          overallObservations: "",
          recommendations: "",
          reviewDate: "",
          isRestricted: false,
          domains: ASSESSMENT_FORM_DOMAINS.map((domain) => ({ domain, findings: "", observations: "" })),
        }}
      />
    </div>
  );
}
