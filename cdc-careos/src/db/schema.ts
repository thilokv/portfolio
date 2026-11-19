/**
 * CDC CareOS — PostgreSQL schema (Drizzle ORM).
 *
 * Conventions
 * - Every tenant-owned table carries `organization_id` and is protected by a
 *   Row Level Security policy (see drizzle/0001_security.sql).
 * - Clinical records are never hard-deleted through the UI. They are archived,
 *   revised (new row linked to the previous one) or locked once signed.
 * - Missing measurements are stored as NULL — never as zero.
 */
import { sql } from "drizzle-orm";
import {
  bigserial,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

const ts = (name: string) => timestamp(name, { withTimezone: true });
const createdAt = () => ts("created_at").notNull().defaultNow();
const updatedAt = () => ts("updated_at").notNull().defaultNow();

/* ------------------------------------------------------------------ enums */

export const staffRoleEnum = pgEnum("staff_role", [
  "admin",
  "clinical_coordinator",
  "speech_therapist",
  "occupational_therapist",
  "special_educator",
  "behaviour_professional",
  "physiotherapist",
  "psychologist",
]);

export const accountTypeEnum = pgEnum("account_type", ["staff", "guardian"]);

export const serviceCodeEnum = pgEnum("service_code", [
  "early_intervention",
  "speech_therapy",
  "occupational_therapy",
  "special_education",
  "behaviour_support",
  "physiotherapy",
  "psychology",
]);

export const childStatusEnum = pgEnum("child_status", [
  "active",
  "waitlisted",
  "on_hold",
  "discharged",
  "archived",
]);

export const languageEnum = pgEnum("language_code", ["en", "te", "hi", "ur", "other"]);

export const consentTypeEnum = pgEnum("consent_type", [
  "registration_data_processing",
  "assessment",
  "therapy_services",
  "photo_video",
  "information_sharing",
  "parent_portal",
  "ai_assistance",
]);

export const consentStatusEnum = pgEnum("consent_status", ["granted", "withdrawn", "pending", "refused"]);

export const developmentalDomainEnum = pgEnum("developmental_domain", [
  "communication",
  "receptive_language",
  "expressive_language",
  "cognitive",
  "gross_motor",
  "fine_motor",
  "social_interaction",
  "play_skills",
  "adaptive_skills",
  "sensory",
  "daily_living",
  "behaviour",
  "early_learning",
  "other",
]);

export const recordStatusEnum = pgEnum("record_status", ["draft", "finalized"]);

export const planStatusEnum = pgEnum("plan_status", ["draft", "active", "under_review", "closed"]);

export const goalStatusEnum = pgEnum("goal_status", [
  "not_started",
  "in_progress",
  "achieved",
  "partially_achieved",
  "not_achieved",
  "on_hold",
  "discontinued",
]);

export const assistanceLevelEnum = pgEnum("assistance_level", [
  "independent",
  "supervision",
  "verbal_prompt",
  "gestural_prompt",
  "visual_prompt",
  "modelling",
  "partial_physical",
  "full_physical",
]);

export const appointmentStatusEnum = pgEnum("appointment_status", [
  "scheduled",
  "checked_in",
  "in_progress",
  "completed",
  "cancelled",
  "no_show",
]);

export const attendanceEnum = pgEnum("attendance_status", [
  "present",
  "late",
  "absent",
  "cancelled_by_family",
  "cancelled_by_center",
]);

export const sessionStatusEnum = pgEnum("session_status", ["in_progress", "completed", "signed"]);

export const documentCategoryEnum = pgEnum("document_category", [
  "external_report",
  "assessment_report",
  "consent_form",
  "medical_record",
  "school_record",
  "other",
]);

export const messageKindEnum = pgEnum("message_kind", ["update", "home_activity", "feedback", "contact_update"]);
export const messageStatusEnum = pgEnum("message_status", ["draft", "sent", "archived"]);

export const reportTypeEnum = pgEnum("report_type", [
  "progress_summary",
  "assessment_summary",
  "monthly_report",
  "psychological_report",
  "discharge_summary",
]);
export const reportStatusEnum = pgEnum("report_status", ["draft", "pending_approval", "approved", "shared", "withdrawn"]);

export const availabilityStatusEnum = pgEnum("availability_status", ["leave", "training", "half_day", "unavailable"]);

export const aiDraftStatusEnum = pgEnum("ai_draft_status", ["pending_review", "accepted", "discarded"]);

/* ------------------------------------------------------- organization/auth */

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  code: varchar("code", { length: 32 }).notNull().unique(),
  childIdPrefix: varchar("child_id_prefix", { length: 10 }).notNull().default("CDC"),
  address: text("address"),
  phone: varchar("phone", { length: 20 }),
  timezone: text("timezone").notNull().default("Asia/Kolkata"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** Atomic per-organization counters (e.g. child IDs CDC-0001). */
export const orgCounters = pgTable(
  "org_counters",
  {
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    name: varchar("name", { length: 40 }).notNull(),
    value: integer("value").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.organizationId, t.name] })],
);

export const userAccounts = pgTable(
  "user_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    email: text("email").notNull(),
    passwordHash: text("password_hash"),
    accountType: accountTypeEnum("account_type").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    mustChangePassword: boolean("must_change_password").notNull().default(false),
    preferredLocale: varchar("preferred_locale", { length: 5 }).notNull().default("en"),
    failedLoginCount: integer("failed_login_count").notNull().default(0),
    lockedUntil: ts("locked_until"),
    lastLoginAt: ts("last_login_at"),
    passwordChangedAt: ts("password_changed_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("user_accounts_email_uq").on(sql`lower(${t.email})`)],
);

export const authSessions = pgTable(
  "auth_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => userAccounts.id),
    tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
    createdAt: createdAt(),
    lastSeenAt: ts("last_seen_at").notNull().defaultNow(),
    expiresAt: ts("expires_at").notNull(),
    revokedAt: ts("revoked_at"),
    ipAddress: varchar("ip_address", { length: 64 }),
    userAgent: text("user_agent"),
  },
  (t) => [index("auth_sessions_user_idx").on(t.userId)],
);

export const passwordResetTokens = pgTable(
  "password_reset_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => userAccounts.id),
    tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
    expiresAt: ts("expires_at").notNull(),
    usedAt: ts("used_at"),
    createdAt: createdAt(),
  },
  (t) => [index("password_reset_user_idx").on(t.userId)],
);

/** Used for rate limiting (login, password reset). */
export const rateLimitEvents = pgTable(
  "rate_limit_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    bucket: varchar("bucket", { length: 40 }).notNull(),
    key: text("key").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("rate_limit_bucket_key_idx").on(t.bucket, t.key, t.createdAt)],
);

/* ------------------------------------------------------------------ staff */

export const staff = pgTable(
  "staff",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    userId: uuid("user_id")
      .notNull()
      .unique()
      .references(() => userAccounts.id),
    fullName: text("full_name").notNull(),
    phone: varchar("phone", { length: 20 }),
    designation: text("designation"),
    qualifications: text("qualifications"),
    registrationNumber: text("registration_number"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("staff_org_idx").on(t.organizationId)],
);

export const staffRoles = pgTable(
  "staff_roles",
  {
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    staffId: uuid("staff_id")
      .notNull()
      .references(() => staff.id),
    role: staffRoleEnum("role").notNull(),
    grantedAt: createdAt(),
    grantedBy: uuid("granted_by").references(() => staff.id),
  },
  (t) => [primaryKey({ columns: [t.staffId, t.role] })],
);

export const staffAvailability = pgTable(
  "staff_availability",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    staffId: uuid("staff_id")
      .notNull()
      .references(() => staff.id),
    date: date("date").notNull(),
    status: availabilityStatusEnum("status").notNull(),
    note: text("note"),
    createdBy: uuid("created_by").references(() => staff.id),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("staff_availability_uq").on(t.staffId, t.date)],
);

/* --------------------------------------------------------------- services */

export const services = pgTable(
  "services",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    code: serviceCodeEnum("code").notNull(),
    name: text("name").notNull(),
    nameTe: text("name_te"),
    description: text("description"),
    defaultDurationMinutes: integer("default_duration_minutes").notNull().default(45),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("services_org_code_uq").on(t.organizationId, t.code),
    check("services_duration_chk", sql`${t.defaultDurationMinutes} between 5 and 480`),
  ],
);

/* --------------------------------------------------------------- children */

export const children = pgTable(
  "children",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    childCode: varchar("child_code", { length: 20 }).notNull(),
    fullName: text("full_name").notNull(),
    preferredName: text("preferred_name"),
    dateOfBirth: date("date_of_birth").notNull(),
    sex: varchar("sex", { length: 20 }),
    preferredLanguage: languageEnum("preferred_language").notNull().default("te"),
    address: text("address"),
    emergencyContactName: text("emergency_contact_name"),
    emergencyContactPhone: varchar("emergency_contact_phone", { length: 20 }),
    emergencyContactRelation: text("emergency_contact_relation"),
    developmentalHistory: text("developmental_history"),
    parentConcerns: text("parent_concerns"),
    medicalHistory: text("medical_history"),
    existingReportsSummary: text("existing_reports_summary"),
    referralSource: text("referral_source"),
    status: childStatusEnum("status").notNull().default("active"),
    registrationDate: date("registration_date").notNull().defaultNow(),
    archivedAt: ts("archived_at"),
    archivedBy: uuid("archived_by").references(() => staff.id),
    archiveReason: text("archive_reason"),
    createdBy: uuid("created_by").references(() => staff.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("children_org_code_uq").on(t.organizationId, t.childCode),
    index("children_org_status_idx").on(t.organizationId, t.status),
    index("children_name_idx").on(t.organizationId, sql`lower(${t.fullName})`),
    check("children_dob_chk", sql`${t.dateOfBirth} > '2000-01-01'`),
  ],
);

/** Care team: which staff work with which child. Drives record access. */
export const childAssignments = pgTable(
  "child_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    childId: uuid("child_id")
      .notNull()
      .references(() => children.id),
    staffId: uuid("staff_id")
      .notNull()
      .references(() => staff.id),
    serviceId: uuid("service_id").references(() => services.id),
    isLead: boolean("is_lead").notNull().default(false),
    startedAt: createdAt(),
    endedAt: ts("ended_at"),
    assignedBy: uuid("assigned_by").references(() => staff.id),
  },
  (t) => [
    index("child_assignments_child_idx").on(t.childId),
    index("child_assignments_staff_idx").on(t.staffId),
    uniqueIndex("child_assignments_active_uq")
      .on(t.childId, t.staffId)
      .where(sql`${t.endedAt} is null`),
  ],
);

export const guardians = pgTable(
  "guardians",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    userId: uuid("user_id")
      .unique()
      .references(() => userAccounts.id),
    fullName: text("full_name").notNull(),
    phone: varchar("phone", { length: 20 }).notNull(),
    alternatePhone: varchar("alternate_phone", { length: 20 }),
    email: text("email"),
    address: text("address"),
    occupation: text("occupation"),
    preferredLanguage: languageEnum("preferred_language").notNull().default("te"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("guardians_org_idx").on(t.organizationId)],
);

export const childGuardians = pgTable(
  "child_guardians",
  {
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    childId: uuid("child_id")
      .notNull()
      .references(() => children.id),
    guardianId: uuid("guardian_id")
      .notNull()
      .references(() => guardians.id),
    relationship: varchar("relationship", { length: 40 }).notNull(),
    isPrimary: boolean("is_primary").notNull().default(false),
    hasLegalAuthority: boolean("has_legal_authority").notNull().default(true),
    portalAccess: boolean("portal_access").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.childId, t.guardianId] }), index("child_guardians_guardian_idx").on(t.guardianId)],
);

export const consents = pgTable(
  "consents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    childId: uuid("child_id")
      .notNull()
      .references(() => children.id),
    consentType: consentTypeEnum("consent_type").notNull(),
    status: consentStatusEnum("status").notNull(),
    givenByGuardianId: uuid("given_by_guardian_id").references(() => guardians.id),
    method: varchar("method", { length: 30 }).notNull().default("paper_form"),
    effectiveDate: date("effective_date").notNull(),
    expiresOn: date("expires_on"),
    notes: text("notes"),
    documentId: uuid("document_id"),
    recordedBy: uuid("recorded_by")
      .notNull()
      .references(() => staff.id),
    createdAt: createdAt(),
  },
  (t) => [index("consents_child_type_idx").on(t.childId, t.consentType, t.createdAt)],
);

/* ------------------------------------------------------------ assessments */

export const assessments = pgTable(
  "assessments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    childId: uuid("child_id")
      .notNull()
      .references(() => children.id),
    serviceId: uuid("service_id").references(() => services.id),
    assessorStaffId: uuid("assessor_staff_id")
      .notNull()
      .references(() => staff.id),
    assessorRole: staffRoleEnum("assessor_role").notNull(),
    assessorQualifications: text("assessor_qualifications"),
    assessmentDate: date("assessment_date").notNull(),
    toolName: text("tool_name").notNull(),
    toolVersion: text("tool_version"),
    reasonForAssessment: text("reason_for_assessment"),
    overallObservations: text("overall_observations"),
    recommendations: text("recommendations"),
    reviewDate: date("review_date"),
    isRestricted: boolean("is_restricted").notNull().default(false),
    status: recordStatusEnum("status").notNull().default("draft"),
    finalizedAt: ts("finalized_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("assessments_child_idx").on(t.childId, t.assessmentDate),
    check("assessments_review_chk", sql`${t.reviewDate} is null or ${t.reviewDate} >= ${t.assessmentDate}`),
  ],
);

export const assessmentDomains = pgTable(
  "assessment_domains",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    assessmentId: uuid("assessment_id")
      .notNull()
      .references(() => assessments.id),
    domain: developmentalDomainEnum("domain").notNull(),
    findings: text("findings"),
    observations: text("observations"),
  },
  (t) => [uniqueIndex("assessment_domains_uq").on(t.assessmentId, t.domain)],
);

/* ------------------------------------------------- development plans (IDP) */

export const developmentPlans = pgTable(
  "development_plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    childId: uuid("child_id")
      .notNull()
      .references(() => children.id),
    title: text("title").notNull(),
    startDate: date("start_date").notNull(),
    reviewDate: date("review_date").notNull(),
    status: planStatusEnum("status").notNull().default("draft"),
    familyPriorities: text("family_priorities"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => staff.id),
    approvedBy: uuid("approved_by").references(() => staff.id),
    approvedAt: ts("approved_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("development_plans_child_idx").on(t.childId),
    check("development_plans_dates_chk", sql`${t.reviewDate} >= ${t.startDate}`),
  ],
);

/**
 * Goals are versioned: a revision creates a new row (version + 1) pointing at
 * `previous_goal_id`, and the old row gets `is_current = false`.
 */
export const developmentGoals = pgTable(
  "development_goals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    planId: uuid("plan_id")
      .notNull()
      .references(() => developmentPlans.id),
    childId: uuid("child_id")
      .notNull()
      .references(() => children.id),
    goalGroupId: uuid("goal_group_id").notNull(),
    version: integer("version").notNull().default(1),
    previousGoalId: uuid("previous_goal_id"),
    isCurrent: boolean("is_current").notNull().default(true),
    domain: developmentalDomainEnum("domain").notNull(),
    serviceId: uuid("service_id").references(() => services.id),
    title: text("title").notNull(),
    baseline: text("baseline").notNull(),
    target: text("target").notNull(),
    measurementMethod: text("measurement_method").notNull(),
    /** Optional numeric criterion, e.g. 80 (%) — used for chart reference lines only. */
    targetPercent: integer("target_percent"),
    strategies: text("strategies").notNull(),
    responsibleStaffId: uuid("responsible_staff_id")
      .notNull()
      .references(() => staff.id),
    reviewDate: date("review_date").notNull(),
    status: goalStatusEnum("status").notNull().default("not_started"),
    revisionReason: text("revision_reason"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => staff.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("development_goals_child_idx").on(t.childId, t.isCurrent),
    index("development_goals_group_idx").on(t.goalGroupId),
    uniqueIndex("development_goals_group_version_uq").on(t.goalGroupId, t.version),
    check("development_goals_target_pct_chk", sql`${t.targetPercent} is null or ${t.targetPercent} between 1 and 100`),
  ],
);

export const goalReviews = pgTable(
  "goal_reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    goalId: uuid("goal_id")
      .notNull()
      .references(() => developmentGoals.id),
    reviewedOn: date("reviewed_on").notNull(),
    reviewerStaffId: uuid("reviewer_staff_id")
      .notNull()
      .references(() => staff.id),
    statusBefore: goalStatusEnum("status_before").notNull(),
    statusAfter: goalStatusEnum("status_after").notNull(),
    summary: text("summary").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("goal_reviews_goal_idx").on(t.goalId)],
);

/* ------------------------------------------------- appointments & sessions */

export const appointments = pgTable(
  "appointments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    childId: uuid("child_id")
      .notNull()
      .references(() => children.id),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id),
    staffId: uuid("staff_id")
      .notNull()
      .references(() => staff.id),
    startsAt: ts("starts_at").notNull(),
    endsAt: ts("ends_at").notNull(),
    room: text("room"),
    status: appointmentStatusEnum("status").notNull().default("scheduled"),
    attendance: attendanceEnum("attendance"),
    cancellationReason: text("cancellation_reason"),
    adminNotes: text("admin_notes"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => staff.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("appointments_org_start_idx").on(t.organizationId, t.startsAt),
    index("appointments_staff_start_idx").on(t.staffId, t.startsAt),
    index("appointments_child_start_idx").on(t.childId, t.startsAt),
    check("appointments_time_chk", sql`${t.endsAt} > ${t.startsAt}`),
  ],
);

export const therapySessions = pgTable(
  "therapy_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    appointmentId: uuid("appointment_id")
      .unique()
      .references(() => appointments.id),
    childId: uuid("child_id")
      .notNull()
      .references(() => children.id),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id),
    therapistStaffId: uuid("therapist_staff_id")
      .notNull()
      .references(() => staff.id),
    sessionDate: date("session_date").notNull(),
    startedAt: ts("started_at").notNull().defaultNow(),
    endedAt: ts("ended_at"),
    status: sessionStatusEnum("status").notNull().default("in_progress"),
    attendance: attendanceEnum("attendance").notNull().default("present"),
    /** Service-specific structured fields, validated by Zod per service. */
    workflowData: jsonb("workflow_data").notNull().default({}),
    activitiesCompleted: text("activities_completed"),
    childResponse: text("child_response"),
    overallAssistance: assistanceLevelEnum("overall_assistance"),
    followUp: text("follow_up"),
    parentParticipation: text("parent_participation"),
    homeActivitySuggestion: text("home_activity_suggestion"),
    signedAt: ts("signed_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("therapy_sessions_child_idx").on(t.childId, t.sessionDate),
    index("therapy_sessions_therapist_idx").on(t.therapistStaffId, t.status),
    check("therapy_sessions_time_chk", sql`${t.endedAt} is null or ${t.endedAt} >= ${t.startedAt}`),
  ],
);

export const sessionGoals = pgTable(
  "session_goals",
  {
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => therapySessions.id),
    goalId: uuid("goal_id")
      .notNull()
      .references(() => developmentGoals.id),
    note: text("note"),
  },
  (t) => [primaryKey({ columns: [t.sessionId, t.goalId] })],
);

/** Free-text clinical observations recorded during a session. */
export const sessionObservations = pgTable(
  "session_observations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => therapySessions.id),
    category: varchar("category", { length: 40 }).notNull(),
    observation: text("observation").notNull(),
    recordedBy: uuid("recorded_by")
      .notNull()
      .references(() => staff.id),
    createdAt: createdAt(),
  },
  (t) => [index("session_observations_session_idx").on(t.sessionId)],
);

/**
 * Goal-level measurements. Trials are optional: when not recorded they stay
 * NULL and are excluded from percentages (never treated as zero).
 */
export const goalObservations = pgTable(
  "goal_observations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    goalId: uuid("goal_id")
      .notNull()
      .references(() => developmentGoals.id),
    childId: uuid("child_id")
      .notNull()
      .references(() => children.id),
    sessionId: uuid("session_id").references(() => therapySessions.id),
    observedOn: date("observed_on").notNull(),
    observedBy: uuid("observed_by")
      .notNull()
      .references(() => staff.id),
    trialsTotal: integer("trials_total"),
    trialsSuccessful: integer("trials_successful"),
    independentTrials: integer("independent_trials"),
    assistanceLevel: assistanceLevelEnum("assistance_level"),
    measurementValue: numeric("measurement_value", { precision: 10, scale: 2 }),
    measurementUnit: varchar("measurement_unit", { length: 30 }),
    note: text("note"),
    createdAt: createdAt(),
  },
  (t) => [
    index("goal_observations_goal_idx").on(t.goalId, t.observedOn),
    index("goal_observations_child_idx").on(t.childId, t.observedOn),
    check(
      "goal_observations_trials_chk",
      sql`(${t.trialsTotal} is null and ${t.trialsSuccessful} is null) or (${t.trialsTotal} > 0 and ${t.trialsSuccessful} between 0 and ${t.trialsTotal})`,
    ),
    check(
      "goal_observations_independent_chk",
      sql`${t.independentTrials} is null or (${t.trialsSuccessful} is not null and ${t.independentTrials} between 0 and ${t.trialsSuccessful})`,
    ),
  ],
);

/* ------------------------------------------------------------- documents */

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    childId: uuid("child_id")
      .notNull()
      .references(() => children.id),
    title: text("title").notNull(),
    category: documentCategoryEnum("category").notNull(),
    storageKey: text("storage_key").notNull().unique(),
    originalFilename: text("original_filename").notNull(),
    mimeType: varchar("mime_type", { length: 100 }).notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    sha256: varchar("sha256", { length: 64 }).notNull(),
    isRestricted: boolean("is_restricted").notNull().default(false),
    visibleToGuardians: boolean("visible_to_guardians").notNull().default(false),
    uploadedBy: uuid("uploaded_by")
      .notNull()
      .references(() => staff.id),
    archivedAt: ts("archived_at"),
    createdAt: createdAt(),
  },
  (t) => [
    index("documents_child_idx").on(t.childId),
    check("documents_size_chk", sql`${t.sizeBytes} > 0 and ${t.sizeBytes} <= 10485760`),
  ],
);

/* ------------------------------------------------- parent communication */

export const parentMessages = pgTable(
  "parent_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    childId: uuid("child_id")
      .notNull()
      .references(() => children.id),
    kind: messageKindEnum("kind").notNull(),
    direction: varchar("direction", { length: 16 }).notNull(), // to_guardian | from_guardian
    senderStaffId: uuid("sender_staff_id").references(() => staff.id),
    senderGuardianId: uuid("sender_guardian_id").references(() => guardians.id),
    subject: text("subject").notNull(),
    body: text("body").notNull(),
    bodyTe: text("body_te"),
    teTranslationReviewedBy: uuid("te_translation_reviewed_by").references(() => staff.id),
    status: messageStatusEnum("status").notNull().default("sent"),
    sentAt: ts("sent_at"),
    readAt: ts("read_at"),
    acknowledgedBy: uuid("acknowledged_by").references(() => staff.id),
    acknowledgedAt: ts("acknowledged_at"),
    createdAt: createdAt(),
  },
  (t) => [
    index("parent_messages_child_idx").on(t.childId, t.createdAt),
    check("parent_messages_direction_chk", sql`${t.direction} in ('to_guardian','from_guardian')`),
    check(
      "parent_messages_sender_chk",
      sql`(${t.direction} = 'to_guardian' and ${t.senderStaffId} is not null) or (${t.direction} = 'from_guardian' and ${t.senderGuardianId} is not null)`,
    ),
  ],
);

export const reports = pgTable(
  "reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    childId: uuid("child_id")
      .notNull()
      .references(() => children.id),
    reportType: reportTypeEnum("report_type").notNull(),
    title: text("title").notNull(),
    periodStart: date("period_start"),
    periodEnd: date("period_end"),
    content: text("content").notNull(),
    contentTe: text("content_te"),
    teTranslationReviewedBy: uuid("te_translation_reviewed_by").references(() => staff.id),
    isRestricted: boolean("is_restricted").notNull().default(false),
    status: reportStatusEnum("status").notNull().default("draft"),
    authorStaffId: uuid("author_staff_id")
      .notNull()
      .references(() => staff.id),
    approvedBy: uuid("approved_by").references(() => staff.id),
    approvedAt: ts("approved_at"),
    sharedAt: ts("shared_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("reports_child_idx").on(t.childId, t.status)],
);

/* ----------------------------------------------------------------- AI */

export const aiDrafts = pgTable(
  "ai_drafts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    requestedBy: uuid("requested_by")
      .notNull()
      .references(() => staff.id),
    childId: uuid("child_id").references(() => children.id),
    feature: varchar("feature", { length: 40 }).notNull(),
    provider: varchar("provider", { length: 40 }).notNull(),
    /** De-identified prompt actually sent to the provider. */
    promptRedacted: text("prompt_redacted").notNull(),
    output: text("output").notNull(),
    status: aiDraftStatusEnum("status").notNull().default("pending_review"),
    reviewedAt: ts("reviewed_at"),
    createdAt: createdAt(),
  },
  (t) => [index("ai_drafts_org_idx").on(t.organizationId, t.createdAt)],
);

/* -------------------------------------------------------------- audit */

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    actorUserId: uuid("actor_user_id"),
    actorName: text("actor_name"),
    actorType: varchar("actor_type", { length: 12 }).notNull(), // staff | guardian | system
    action: varchar("action", { length: 60 }).notNull(),
    entityType: varchar("entity_type", { length: 40 }).notNull(),
    entityId: text("entity_id"),
    childId: uuid("child_id"),
    summary: text("summary"),
    changes: jsonb("changes"),
    ipAddress: varchar("ip_address", { length: 64 }),
    createdAt: createdAt(),
  },
  (t) => [
    index("audit_logs_org_created_idx").on(t.organizationId, t.createdAt),
    index("audit_logs_child_idx").on(t.childId, t.createdAt),
    index("audit_logs_entity_idx").on(t.entityType, t.entityId),
  ],
);
