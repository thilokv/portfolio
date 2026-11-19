/** Shared domain constants (safe for client and server). */

export const STAFF_ROLES = [
  "admin",
  "clinical_coordinator",
  "speech_therapist",
  "occupational_therapist",
  "special_educator",
  "behaviour_professional",
  "physiotherapist",
  "psychologist",
] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const CLINICAL_ROLES: StaffRole[] = STAFF_ROLES.filter((r) => r !== "admin");

export const SERVICE_CODES = [
  "early_intervention",
  "speech_therapy",
  "occupational_therapy",
  "special_education",
  "behaviour_support",
  "physiotherapy",
  "psychology",
] as const;
export type ServiceCode = (typeof SERVICE_CODES)[number];

/** Which professional roles may deliver / document each service. */
export const SERVICE_ROLES: Record<ServiceCode, StaffRole[]> = {
  early_intervention: [
    "clinical_coordinator",
    "speech_therapist",
    "occupational_therapist",
    "special_educator",
    "physiotherapist",
    "behaviour_professional",
  ],
  speech_therapy: ["speech_therapist"],
  occupational_therapy: ["occupational_therapist"],
  special_education: ["special_educator"],
  behaviour_support: ["behaviour_professional"],
  physiotherapy: ["physiotherapist"],
  psychology: ["psychologist"],
};

export const CHILD_STATUSES = ["active", "waitlisted", "on_hold", "discharged", "archived"] as const;
export const LANGUAGES = ["te", "en", "hi", "ur", "other"] as const;

export const CONSENT_TYPES = [
  "registration_data_processing",
  "assessment",
  "therapy_services",
  "photo_video",
  "information_sharing",
  "parent_portal",
  "ai_assistance",
] as const;
export type ConsentType = (typeof CONSENT_TYPES)[number];
export const CONSENT_STATUSES = ["granted", "withdrawn", "pending", "refused"] as const;

export const DEVELOPMENTAL_DOMAINS = [
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
] as const;
export type DevelopmentalDomain = (typeof DEVELOPMENTAL_DOMAINS)[number];

/** Domains shown on the structured developmental assessment form. */
export const ASSESSMENT_FORM_DOMAINS: DevelopmentalDomain[] = [
  "communication",
  "cognitive",
  "gross_motor",
  "fine_motor",
  "social_interaction",
  "play_skills",
  "adaptive_skills",
  "sensory",
  "daily_living",
];

export const GOAL_STATUSES = [
  "not_started",
  "in_progress",
  "achieved",
  "partially_achieved",
  "not_achieved",
  "on_hold",
  "discontinued",
] as const;
export type GoalStatus = (typeof GOAL_STATUSES)[number];

/** Ordered from most independent to most support. */
export const ASSISTANCE_LEVELS = [
  "independent",
  "supervision",
  "verbal_prompt",
  "gestural_prompt",
  "visual_prompt",
  "modelling",
  "partial_physical",
  "full_physical",
] as const;
export type AssistanceLevel = (typeof ASSISTANCE_LEVELS)[number];

export const APPOINTMENT_STATUSES = ["scheduled", "checked_in", "in_progress", "completed", "cancelled", "no_show"] as const;
export const ATTENDANCE_STATUSES = ["present", "late", "absent", "cancelled_by_family", "cancelled_by_center"] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export const PLAN_STATUSES = ["draft", "active", "under_review", "closed"] as const;
export const DOCUMENT_CATEGORIES = [
  "external_report",
  "assessment_report",
  "consent_form",
  "medical_record",
  "school_record",
  "other",
] as const;
export const REPORT_TYPES = [
  "progress_summary",
  "assessment_summary",
  "monthly_report",
  "psychological_report",
  "discharge_summary",
] as const;
export const REPORT_STATUSES = ["draft", "pending_approval", "approved", "shared", "withdrawn"] as const;
export const AVAILABILITY_STATUSES = ["leave", "training", "half_day", "unavailable"] as const;
export const RELATIONSHIPS = ["mother", "father", "grandparent", "legal_guardian", "aunt_uncle", "sibling", "other"] as const;

export const ALLOWED_UPLOAD_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
