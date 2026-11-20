CREATE TYPE "public"."account_type" AS ENUM('staff', 'guardian');--> statement-breakpoint
CREATE TYPE "public"."ai_draft_status" AS ENUM('pending_review', 'accepted', 'discarded');--> statement-breakpoint
CREATE TYPE "public"."appointment_status" AS ENUM('scheduled', 'checked_in', 'in_progress', 'completed', 'cancelled', 'no_show');--> statement-breakpoint
CREATE TYPE "public"."assistance_level" AS ENUM('independent', 'supervision', 'verbal_prompt', 'gestural_prompt', 'visual_prompt', 'modelling', 'partial_physical', 'full_physical');--> statement-breakpoint
CREATE TYPE "public"."attendance_status" AS ENUM('present', 'late', 'absent', 'cancelled_by_family', 'cancelled_by_center');--> statement-breakpoint
CREATE TYPE "public"."availability_status" AS ENUM('leave', 'training', 'half_day', 'unavailable');--> statement-breakpoint
CREATE TYPE "public"."child_status" AS ENUM('active', 'waitlisted', 'on_hold', 'discharged', 'archived');--> statement-breakpoint
CREATE TYPE "public"."consent_status" AS ENUM('granted', 'withdrawn', 'pending', 'refused');--> statement-breakpoint
CREATE TYPE "public"."consent_type" AS ENUM('registration_data_processing', 'assessment', 'therapy_services', 'photo_video', 'information_sharing', 'parent_portal', 'ai_assistance');--> statement-breakpoint
CREATE TYPE "public"."developmental_domain" AS ENUM('communication', 'receptive_language', 'expressive_language', 'cognitive', 'gross_motor', 'fine_motor', 'social_interaction', 'play_skills', 'adaptive_skills', 'sensory', 'daily_living', 'behaviour', 'early_learning', 'other');--> statement-breakpoint
CREATE TYPE "public"."document_category" AS ENUM('external_report', 'assessment_report', 'consent_form', 'medical_record', 'school_record', 'other');--> statement-breakpoint
CREATE TYPE "public"."goal_status" AS ENUM('not_started', 'in_progress', 'achieved', 'partially_achieved', 'not_achieved', 'on_hold', 'discontinued');--> statement-breakpoint
CREATE TYPE "public"."language_code" AS ENUM('en', 'te', 'hi', 'ur', 'other');--> statement-breakpoint
CREATE TYPE "public"."message_kind" AS ENUM('update', 'home_activity', 'feedback', 'contact_update');--> statement-breakpoint
CREATE TYPE "public"."message_status" AS ENUM('draft', 'sent', 'archived');--> statement-breakpoint
CREATE TYPE "public"."plan_status" AS ENUM('draft', 'active', 'under_review', 'closed');--> statement-breakpoint
CREATE TYPE "public"."record_status" AS ENUM('draft', 'finalized');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('draft', 'pending_approval', 'approved', 'shared', 'withdrawn');--> statement-breakpoint
CREATE TYPE "public"."report_type" AS ENUM('progress_summary', 'assessment_summary', 'monthly_report', 'psychological_report', 'discharge_summary');--> statement-breakpoint
CREATE TYPE "public"."service_code" AS ENUM('early_intervention', 'speech_therapy', 'occupational_therapy', 'special_education', 'behaviour_support', 'physiotherapy', 'psychology');--> statement-breakpoint
CREATE TYPE "public"."session_status" AS ENUM('in_progress', 'completed', 'signed');--> statement-breakpoint
CREATE TYPE "public"."staff_role" AS ENUM('admin', 'clinical_coordinator', 'speech_therapist', 'occupational_therapist', 'special_educator', 'behaviour_professional', 'physiotherapist', 'psychologist');--> statement-breakpoint
CREATE TABLE "ai_drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"requested_by" uuid NOT NULL,
	"child_id" uuid,
	"feature" varchar(40) NOT NULL,
	"provider" varchar(40) NOT NULL,
	"prompt_redacted" text NOT NULL,
	"output" text NOT NULL,
	"status" "ai_draft_status" DEFAULT 'pending_review' NOT NULL,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "appointments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"child_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	"staff_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"room" text,
	"status" "appointment_status" DEFAULT 'scheduled' NOT NULL,
	"attendance" "attendance_status",
	"cancellation_reason" text,
	"admin_notes" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "appointments_time_chk" CHECK ("appointments"."ends_at" > "appointments"."starts_at")
);
--> statement-breakpoint
CREATE TABLE "assessment_domains" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"assessment_id" uuid NOT NULL,
	"domain" "developmental_domain" NOT NULL,
	"findings" text,
	"observations" text
);
--> statement-breakpoint
CREATE TABLE "assessments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"child_id" uuid NOT NULL,
	"service_id" uuid,
	"assessor_staff_id" uuid NOT NULL,
	"assessor_role" "staff_role" NOT NULL,
	"assessor_qualifications" text,
	"assessment_date" date NOT NULL,
	"tool_name" text NOT NULL,
	"tool_version" text,
	"reason_for_assessment" text,
	"overall_observations" text,
	"recommendations" text,
	"review_date" date,
	"is_restricted" boolean DEFAULT false NOT NULL,
	"status" "record_status" DEFAULT 'draft' NOT NULL,
	"finalized_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assessments_review_chk" CHECK ("assessments"."review_date" is null or "assessments"."review_date" >= "assessments"."assessment_date")
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"actor_user_id" uuid,
	"actor_name" text,
	"actor_type" varchar(12) NOT NULL,
	"action" varchar(60) NOT NULL,
	"entity_type" varchar(40) NOT NULL,
	"entity_id" text,
	"child_id" uuid,
	"summary" text,
	"changes" jsonb,
	"ip_address" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"ip_address" varchar(64),
	"user_agent" text,
	CONSTRAINT "auth_sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "child_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"child_id" uuid NOT NULL,
	"staff_id" uuid NOT NULL,
	"service_id" uuid,
	"is_lead" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"assigned_by" uuid
);
--> statement-breakpoint
CREATE TABLE "child_guardians" (
	"organization_id" uuid NOT NULL,
	"child_id" uuid NOT NULL,
	"guardian_id" uuid NOT NULL,
	"relationship" varchar(40) NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"has_legal_authority" boolean DEFAULT true NOT NULL,
	"portal_access" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "child_guardians_child_id_guardian_id_pk" PRIMARY KEY("child_id","guardian_id")
);
--> statement-breakpoint
CREATE TABLE "children" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"child_code" varchar(20) NOT NULL,
	"full_name" text NOT NULL,
	"preferred_name" text,
	"date_of_birth" date NOT NULL,
	"sex" varchar(20),
	"preferred_language" "language_code" DEFAULT 'te' NOT NULL,
	"address" text,
	"emergency_contact_name" text,
	"emergency_contact_phone" varchar(20),
	"emergency_contact_relation" text,
	"developmental_history" text,
	"parent_concerns" text,
	"medical_history" text,
	"existing_reports_summary" text,
	"referral_source" text,
	"status" "child_status" DEFAULT 'active' NOT NULL,
	"registration_date" date DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	"archived_by" uuid,
	"archive_reason" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "children_dob_chk" CHECK ("children"."date_of_birth" > '2000-01-01')
);
--> statement-breakpoint
CREATE TABLE "consents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"child_id" uuid NOT NULL,
	"consent_type" "consent_type" NOT NULL,
	"status" "consent_status" NOT NULL,
	"given_by_guardian_id" uuid,
	"method" varchar(30) DEFAULT 'paper_form' NOT NULL,
	"effective_date" date NOT NULL,
	"expires_on" date,
	"notes" text,
	"document_id" uuid,
	"recorded_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "development_goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"child_id" uuid NOT NULL,
	"goal_group_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"previous_goal_id" uuid,
	"is_current" boolean DEFAULT true NOT NULL,
	"domain" "developmental_domain" NOT NULL,
	"service_id" uuid,
	"title" text NOT NULL,
	"baseline" text NOT NULL,
	"target" text NOT NULL,
	"measurement_method" text NOT NULL,
	"target_percent" integer,
	"strategies" text NOT NULL,
	"responsible_staff_id" uuid NOT NULL,
	"review_date" date NOT NULL,
	"status" "goal_status" DEFAULT 'not_started' NOT NULL,
	"revision_reason" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "development_goals_target_pct_chk" CHECK ("development_goals"."target_percent" is null or "development_goals"."target_percent" between 1 and 100)
);
--> statement-breakpoint
CREATE TABLE "development_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"child_id" uuid NOT NULL,
	"title" text NOT NULL,
	"start_date" date NOT NULL,
	"review_date" date NOT NULL,
	"status" "plan_status" DEFAULT 'draft' NOT NULL,
	"family_priorities" text,
	"created_by" uuid NOT NULL,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "development_plans_dates_chk" CHECK ("development_plans"."review_date" >= "development_plans"."start_date")
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"child_id" uuid NOT NULL,
	"title" text NOT NULL,
	"category" "document_category" NOT NULL,
	"storage_key" text NOT NULL,
	"original_filename" text NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"size_bytes" integer NOT NULL,
	"sha256" varchar(64) NOT NULL,
	"is_restricted" boolean DEFAULT false NOT NULL,
	"visible_to_guardians" boolean DEFAULT false NOT NULL,
	"uploaded_by" uuid NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "documents_storage_key_unique" UNIQUE("storage_key"),
	CONSTRAINT "documents_size_chk" CHECK ("documents"."size_bytes" > 0 and "documents"."size_bytes" <= 10485760)
);
--> statement-breakpoint
CREATE TABLE "goal_observations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"goal_id" uuid NOT NULL,
	"child_id" uuid NOT NULL,
	"session_id" uuid,
	"observed_on" date NOT NULL,
	"observed_by" uuid NOT NULL,
	"trials_total" integer,
	"trials_successful" integer,
	"independent_trials" integer,
	"assistance_level" "assistance_level",
	"measurement_value" numeric(10, 2),
	"measurement_unit" varchar(30),
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "goal_observations_trials_chk" CHECK (("goal_observations"."trials_total" is null and "goal_observations"."trials_successful" is null) or ("goal_observations"."trials_total" > 0 and "goal_observations"."trials_successful" between 0 and "goal_observations"."trials_total")),
	CONSTRAINT "goal_observations_independent_chk" CHECK ("goal_observations"."independent_trials" is null or ("goal_observations"."trials_successful" is not null and "goal_observations"."independent_trials" between 0 and "goal_observations"."trials_successful"))
);
--> statement-breakpoint
CREATE TABLE "goal_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"goal_id" uuid NOT NULL,
	"reviewed_on" date NOT NULL,
	"reviewer_staff_id" uuid NOT NULL,
	"status_before" "goal_status" NOT NULL,
	"status_after" "goal_status" NOT NULL,
	"summary" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "guardians" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid,
	"full_name" text NOT NULL,
	"phone" varchar(20) NOT NULL,
	"alternate_phone" varchar(20),
	"email" text,
	"address" text,
	"occupation" text,
	"preferred_language" "language_code" DEFAULT 'te' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "guardians_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "org_counters" (
	"organization_id" uuid NOT NULL,
	"name" varchar(40) NOT NULL,
	"value" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "org_counters_organization_id_name_pk" PRIMARY KEY("organization_id","name")
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"code" varchar(32) NOT NULL,
	"child_id_prefix" varchar(10) DEFAULT 'CDC' NOT NULL,
	"address" text,
	"phone" varchar(20),
	"timezone" text DEFAULT 'Asia/Kolkata' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "parent_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"child_id" uuid NOT NULL,
	"kind" "message_kind" NOT NULL,
	"direction" varchar(12) NOT NULL,
	"sender_staff_id" uuid,
	"sender_guardian_id" uuid,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"body_te" text,
	"te_translation_reviewed_by" uuid,
	"status" "message_status" DEFAULT 'sent' NOT NULL,
	"sent_at" timestamp with time zone,
	"read_at" timestamp with time zone,
	"acknowledged_by" uuid,
	"acknowledged_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "parent_messages_direction_chk" CHECK ("parent_messages"."direction" in ('to_guardian','from_guardian')),
	CONSTRAINT "parent_messages_sender_chk" CHECK (("parent_messages"."direction" = 'to_guardian' and "parent_messages"."sender_staff_id" is not null) or ("parent_messages"."direction" = 'from_guardian' and "parent_messages"."sender_guardian_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "password_reset_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "rate_limit_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"bucket" varchar(40) NOT NULL,
	"key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"child_id" uuid NOT NULL,
	"report_type" "report_type" NOT NULL,
	"title" text NOT NULL,
	"period_start" date,
	"period_end" date,
	"content" text NOT NULL,
	"content_te" text,
	"te_translation_reviewed_by" uuid,
	"is_restricted" boolean DEFAULT false NOT NULL,
	"status" "report_status" DEFAULT 'draft' NOT NULL,
	"author_staff_id" uuid NOT NULL,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"shared_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"code" "service_code" NOT NULL,
	"name" text NOT NULL,
	"name_te" text,
	"description" text,
	"default_duration_minutes" integer DEFAULT 45 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "services_duration_chk" CHECK ("services"."default_duration_minutes" between 5 and 480)
);
--> statement-breakpoint
CREATE TABLE "session_goals" (
	"organization_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"goal_id" uuid NOT NULL,
	"note" text,
	CONSTRAINT "session_goals_session_id_goal_id_pk" PRIMARY KEY("session_id","goal_id")
);
--> statement-breakpoint
CREATE TABLE "session_observations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"category" varchar(40) NOT NULL,
	"observation" text NOT NULL,
	"recorded_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"full_name" text NOT NULL,
	"phone" varchar(20),
	"designation" text,
	"qualifications" text,
	"registration_number" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "staff_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "staff_availability" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"staff_id" uuid NOT NULL,
	"date" date NOT NULL,
	"status" "availability_status" NOT NULL,
	"note" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_roles" (
	"organization_id" uuid NOT NULL,
	"staff_id" uuid NOT NULL,
	"role" "staff_role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"granted_by" uuid,
	CONSTRAINT "staff_roles_staff_id_role_pk" PRIMARY KEY("staff_id","role")
);
--> statement-breakpoint
CREATE TABLE "therapy_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"appointment_id" uuid,
	"child_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	"therapist_staff_id" uuid NOT NULL,
	"session_date" date NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"status" "session_status" DEFAULT 'in_progress' NOT NULL,
	"attendance" "attendance_status" DEFAULT 'present' NOT NULL,
	"workflow_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"activities_completed" text,
	"child_response" text,
	"overall_assistance" "assistance_level",
	"follow_up" text,
	"parent_participation" text,
	"home_activity_suggestion" text,
	"signed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "therapy_sessions_appointment_id_unique" UNIQUE("appointment_id"),
	CONSTRAINT "therapy_sessions_time_chk" CHECK ("therapy_sessions"."ended_at" is null or "therapy_sessions"."ended_at" >= "therapy_sessions"."started_at")
);
--> statement-breakpoint
CREATE TABLE "user_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"email" text NOT NULL,
	"password_hash" text,
	"account_type" "account_type" NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"must_change_password" boolean DEFAULT false NOT NULL,
	"preferred_locale" varchar(5) DEFAULT 'en' NOT NULL,
	"failed_login_count" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"password_changed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_drafts" ADD CONSTRAINT "ai_drafts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_drafts" ADD CONSTRAINT "ai_drafts_requested_by_staff_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_drafts" ADD CONSTRAINT "ai_drafts_child_id_children_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."children"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_child_id_children_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."children"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_created_by_staff_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_domains" ADD CONSTRAINT "assessment_domains_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_domains" ADD CONSTRAINT "assessment_domains_assessment_id_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_child_id_children_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."children"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_assessor_staff_id_staff_id_fk" FOREIGN KEY ("assessor_staff_id") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_user_accounts_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "child_assignments" ADD CONSTRAINT "child_assignments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "child_assignments" ADD CONSTRAINT "child_assignments_child_id_children_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."children"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "child_assignments" ADD CONSTRAINT "child_assignments_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "child_assignments" ADD CONSTRAINT "child_assignments_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "child_assignments" ADD CONSTRAINT "child_assignments_assigned_by_staff_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "child_guardians" ADD CONSTRAINT "child_guardians_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "child_guardians" ADD CONSTRAINT "child_guardians_child_id_children_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."children"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "child_guardians" ADD CONSTRAINT "child_guardians_guardian_id_guardians_id_fk" FOREIGN KEY ("guardian_id") REFERENCES "public"."guardians"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "children" ADD CONSTRAINT "children_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "children" ADD CONSTRAINT "children_archived_by_staff_id_fk" FOREIGN KEY ("archived_by") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "children" ADD CONSTRAINT "children_created_by_staff_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consents" ADD CONSTRAINT "consents_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consents" ADD CONSTRAINT "consents_child_id_children_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."children"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consents" ADD CONSTRAINT "consents_given_by_guardian_id_guardians_id_fk" FOREIGN KEY ("given_by_guardian_id") REFERENCES "public"."guardians"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consents" ADD CONSTRAINT "consents_recorded_by_staff_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "development_goals" ADD CONSTRAINT "development_goals_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "development_goals" ADD CONSTRAINT "development_goals_plan_id_development_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."development_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "development_goals" ADD CONSTRAINT "development_goals_child_id_children_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."children"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "development_goals" ADD CONSTRAINT "development_goals_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "development_goals" ADD CONSTRAINT "development_goals_responsible_staff_id_staff_id_fk" FOREIGN KEY ("responsible_staff_id") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "development_goals" ADD CONSTRAINT "development_goals_created_by_staff_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "development_plans" ADD CONSTRAINT "development_plans_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "development_plans" ADD CONSTRAINT "development_plans_child_id_children_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."children"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "development_plans" ADD CONSTRAINT "development_plans_created_by_staff_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "development_plans" ADD CONSTRAINT "development_plans_approved_by_staff_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_child_id_children_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."children"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_staff_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_observations" ADD CONSTRAINT "goal_observations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_observations" ADD CONSTRAINT "goal_observations_goal_id_development_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."development_goals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_observations" ADD CONSTRAINT "goal_observations_child_id_children_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."children"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_observations" ADD CONSTRAINT "goal_observations_session_id_therapy_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."therapy_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_observations" ADD CONSTRAINT "goal_observations_observed_by_staff_id_fk" FOREIGN KEY ("observed_by") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_reviews" ADD CONSTRAINT "goal_reviews_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_reviews" ADD CONSTRAINT "goal_reviews_goal_id_development_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."development_goals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_reviews" ADD CONSTRAINT "goal_reviews_reviewer_staff_id_staff_id_fk" FOREIGN KEY ("reviewer_staff_id") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guardians" ADD CONSTRAINT "guardians_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guardians" ADD CONSTRAINT "guardians_user_id_user_accounts_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_counters" ADD CONSTRAINT "org_counters_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parent_messages" ADD CONSTRAINT "parent_messages_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parent_messages" ADD CONSTRAINT "parent_messages_child_id_children_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."children"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parent_messages" ADD CONSTRAINT "parent_messages_sender_staff_id_staff_id_fk" FOREIGN KEY ("sender_staff_id") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parent_messages" ADD CONSTRAINT "parent_messages_sender_guardian_id_guardians_id_fk" FOREIGN KEY ("sender_guardian_id") REFERENCES "public"."guardians"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parent_messages" ADD CONSTRAINT "parent_messages_te_translation_reviewed_by_staff_id_fk" FOREIGN KEY ("te_translation_reviewed_by") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parent_messages" ADD CONSTRAINT "parent_messages_acknowledged_by_staff_id_fk" FOREIGN KEY ("acknowledged_by") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_user_accounts_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_child_id_children_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."children"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_te_translation_reviewed_by_staff_id_fk" FOREIGN KEY ("te_translation_reviewed_by") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_author_staff_id_staff_id_fk" FOREIGN KEY ("author_staff_id") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_approved_by_staff_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_goals" ADD CONSTRAINT "session_goals_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_goals" ADD CONSTRAINT "session_goals_session_id_therapy_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."therapy_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_goals" ADD CONSTRAINT "session_goals_goal_id_development_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."development_goals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_observations" ADD CONSTRAINT "session_observations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_observations" ADD CONSTRAINT "session_observations_session_id_therapy_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."therapy_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_observations" ADD CONSTRAINT "session_observations_recorded_by_staff_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff" ADD CONSTRAINT "staff_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff" ADD CONSTRAINT "staff_user_id_user_accounts_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_availability" ADD CONSTRAINT "staff_availability_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_availability" ADD CONSTRAINT "staff_availability_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_availability" ADD CONSTRAINT "staff_availability_created_by_staff_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_roles" ADD CONSTRAINT "staff_roles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_roles" ADD CONSTRAINT "staff_roles_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_roles" ADD CONSTRAINT "staff_roles_granted_by_staff_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "therapy_sessions" ADD CONSTRAINT "therapy_sessions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "therapy_sessions" ADD CONSTRAINT "therapy_sessions_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "therapy_sessions" ADD CONSTRAINT "therapy_sessions_child_id_children_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."children"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "therapy_sessions" ADD CONSTRAINT "therapy_sessions_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "therapy_sessions" ADD CONSTRAINT "therapy_sessions_therapist_staff_id_staff_id_fk" FOREIGN KEY ("therapist_staff_id") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_accounts" ADD CONSTRAINT "user_accounts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_drafts_org_idx" ON "ai_drafts" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "appointments_org_start_idx" ON "appointments" USING btree ("organization_id","starts_at");--> statement-breakpoint
CREATE INDEX "appointments_staff_start_idx" ON "appointments" USING btree ("staff_id","starts_at");--> statement-breakpoint
CREATE INDEX "appointments_child_start_idx" ON "appointments" USING btree ("child_id","starts_at");--> statement-breakpoint
CREATE UNIQUE INDEX "assessment_domains_uq" ON "assessment_domains" USING btree ("assessment_id","domain");--> statement-breakpoint
CREATE INDEX "assessments_child_idx" ON "assessments" USING btree ("child_id","assessment_date");--> statement-breakpoint
CREATE INDEX "audit_logs_org_created_idx" ON "audit_logs" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_child_idx" ON "audit_logs" USING btree ("child_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "auth_sessions_user_idx" ON "auth_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "child_assignments_child_idx" ON "child_assignments" USING btree ("child_id");--> statement-breakpoint
CREATE INDEX "child_assignments_staff_idx" ON "child_assignments" USING btree ("staff_id");--> statement-breakpoint
CREATE UNIQUE INDEX "child_assignments_active_uq" ON "child_assignments" USING btree ("child_id","staff_id") WHERE "child_assignments"."ended_at" is null;--> statement-breakpoint
CREATE INDEX "child_guardians_guardian_idx" ON "child_guardians" USING btree ("guardian_id");--> statement-breakpoint
CREATE UNIQUE INDEX "children_org_code_uq" ON "children" USING btree ("organization_id","child_code");--> statement-breakpoint
CREATE INDEX "children_org_status_idx" ON "children" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "children_name_idx" ON "children" USING btree ("organization_id",lower("full_name"));--> statement-breakpoint
CREATE INDEX "consents_child_type_idx" ON "consents" USING btree ("child_id","consent_type","created_at");--> statement-breakpoint
CREATE INDEX "development_goals_child_idx" ON "development_goals" USING btree ("child_id","is_current");--> statement-breakpoint
CREATE INDEX "development_goals_group_idx" ON "development_goals" USING btree ("goal_group_id");--> statement-breakpoint
CREATE UNIQUE INDEX "development_goals_group_version_uq" ON "development_goals" USING btree ("goal_group_id","version");--> statement-breakpoint
CREATE INDEX "development_plans_child_idx" ON "development_plans" USING btree ("child_id");--> statement-breakpoint
CREATE INDEX "documents_child_idx" ON "documents" USING btree ("child_id");--> statement-breakpoint
CREATE INDEX "goal_observations_goal_idx" ON "goal_observations" USING btree ("goal_id","observed_on");--> statement-breakpoint
CREATE INDEX "goal_observations_child_idx" ON "goal_observations" USING btree ("child_id","observed_on");--> statement-breakpoint
CREATE INDEX "goal_reviews_goal_idx" ON "goal_reviews" USING btree ("goal_id");--> statement-breakpoint
CREATE INDEX "guardians_org_idx" ON "guardians" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "parent_messages_child_idx" ON "parent_messages" USING btree ("child_id","created_at");--> statement-breakpoint
CREATE INDEX "password_reset_user_idx" ON "password_reset_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "rate_limit_bucket_key_idx" ON "rate_limit_events" USING btree ("bucket","key","created_at");--> statement-breakpoint
CREATE INDEX "reports_child_idx" ON "reports" USING btree ("child_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "services_org_code_uq" ON "services" USING btree ("organization_id","code");--> statement-breakpoint
CREATE INDEX "session_observations_session_idx" ON "session_observations" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "staff_org_idx" ON "staff" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "staff_availability_uq" ON "staff_availability" USING btree ("staff_id","date");--> statement-breakpoint
CREATE INDEX "therapy_sessions_child_idx" ON "therapy_sessions" USING btree ("child_id","session_date");--> statement-breakpoint
CREATE INDEX "therapy_sessions_therapist_idx" ON "therapy_sessions" USING btree ("therapist_staff_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "user_accounts_email_uq" ON "user_accounts" USING btree (lower("email"));