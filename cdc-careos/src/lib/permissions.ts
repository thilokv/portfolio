/**
 * Role → permission matrix. Pure functions (no I/O) so they can be unit
 * tested and reused on the server. UI may use them to hide controls, but the
 * server ALWAYS re-checks (see src/server/authz.ts).
 */
import { CLINICAL_ROLES, SERVICE_ROLES, type ServiceCode, type StaffRole } from "./constants";

export const PERMISSIONS = [
  "children.register",
  "children.edit",
  "children.archive",
  "children.view_all",
  "care_team.manage",
  "consent.manage",
  "appointments.manage_all",
  "appointments.manage_own",
  "clinical.view",
  "clinical.write",
  "restricted.view",
  "plans.approve",
  "reports.approve",
  "messages.send",
  "documents.upload",
  "staff.manage",
  "services.manage",
  "audit.view",
  "reports.operational",
  "data.export",
  "ai.use",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const CLINICIAN: Permission[] = [
  "appointments.manage_own",
  "clinical.view",
  "clinical.write",
  "messages.send",
  "documents.upload",
  "ai.use",
];

export const ROLE_PERMISSIONS: Record<StaffRole, Permission[]> = {
  admin: [
    "children.register",
    "children.edit",
    "children.archive",
    "children.view_all",
    "care_team.manage",
    "consent.manage",
    "appointments.manage_all",
    "documents.upload",
    "staff.manage",
    "services.manage",
    "audit.view",
    "reports.operational",
    "data.export",
  ],
  clinical_coordinator: [
    ...CLINICIAN,
    "children.register",
    "children.edit",
    "children.archive",
    "children.view_all",
    "care_team.manage",
    "consent.manage",
    "appointments.manage_all",
    "restricted.view",
    "plans.approve",
    "reports.approve",
    "reports.operational",
    "audit.view",
  ],
  speech_therapist: CLINICIAN,
  occupational_therapist: CLINICIAN,
  special_educator: CLINICIAN,
  behaviour_professional: CLINICIAN,
  physiotherapist: CLINICIAN,
  psychologist: [...CLINICIAN, "restricted.view", "reports.approve"],
};

export function permissionsFor(roles: readonly StaffRole[]): Set<Permission> {
  const set = new Set<Permission>();
  for (const role of roles) for (const p of ROLE_PERMISSIONS[role] ?? []) set.add(p);
  return set;
}

export function hasPermission(roles: readonly StaffRole[], permission: Permission): boolean {
  return roles.some((r) => ROLE_PERMISSIONS[r]?.includes(permission));
}

export function isClinician(roles: readonly StaffRole[]): boolean {
  return roles.some((r) => CLINICAL_ROLES.includes(r));
}

/** Can a staff member with these roles document the given service? */
export function canDeliverService(roles: readonly StaffRole[], service: ServiceCode): boolean {
  return roles.some((r) => SERVICE_ROLES[service].includes(r));
}

export interface ChildAccess {
  canView: boolean;
  canViewClinical: boolean;
  canWriteClinical: boolean;
  canViewRestricted: boolean;
  canEditProfile: boolean;
  canManageCareTeam: boolean;
  canManageConsent: boolean;
  canViewAudit: boolean;
}

/**
 * Child-level access decision.
 * - Administrators see demographic/administrative data for all children but
 *   NOT clinical notes, unless they also hold a clinical role and are assigned.
 * - Coordinators see everything, including restricted psychological records.
 * - Other clinicians see only children on their care team.
 * - Restricted (psychological) records: psychologists on the care team and
 *   coordinators only.
 */
export function computeChildAccess(roles: readonly StaffRole[], isAssigned: boolean): ChildAccess {
  const perms = permissionsFor(roles);
  const viewAll = perms.has("children.view_all");
  const coordinator = roles.includes("clinical_coordinator");
  const clinicalOnTeam = isClinician(roles) && (isAssigned || coordinator);
  const canView = viewAll || isAssigned;
  return {
    canView,
    canViewClinical: canView && clinicalOnTeam,
    canWriteClinical: canView && clinicalOnTeam && perms.has("clinical.write"),
    canViewRestricted: canView && perms.has("restricted.view") && (coordinator || isAssigned),
    canEditProfile: canView && perms.has("children.edit"),
    canManageCareTeam: perms.has("care_team.manage"),
    canManageConsent: perms.has("consent.manage"),
    canViewAudit: perms.has("audit.view"),
  };
}

export const NO_ACCESS: ChildAccess = {
  canView: false,
  canViewClinical: false,
  canWriteClinical: false,
  canViewRestricted: false,
  canEditProfile: false,
  canManageCareTeam: false,
  canManageConsent: false,
  canViewAudit: false,
};
