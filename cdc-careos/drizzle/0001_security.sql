-- CDC CareOS security migration
-- Row Level Security (organization isolation + guardian row filters),
-- tamper protection for audit logs and signed clinical records,
-- double-booking prevention and cross-organization foreign keys.
-- Runs as the schema OWNER. The runtime role (careos_app) is NOT the owner
-- and has no BYPASSRLS, so these policies apply to every application query.

CREATE EXTENSION IF NOT EXISTS btree_gist;--> statement-breakpoint

-- ---------------------------------------------------------------- helpers
CREATE OR REPLACE FUNCTION app_current_org() RETURNS uuid
  LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.current_org', true), '')::uuid $$;--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_guardian_id() RETURNS uuid
  LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.guardian_id', true), '')::uuid $$;--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_is_staff() RETURNS boolean
  LANGUAGE sql STABLE AS $$ SELECT app_guardian_id() IS NULL AND app_current_org() IS NOT NULL $$;--> statement-breakpoint

-- Children a guardian session may see (portal access only).
CREATE OR REPLACE FUNCTION app_guardian_children() RETURNS SETOF uuid
  LANGUAGE sql STABLE AS $$
    SELECT cg.child_id FROM child_guardians cg
     WHERE cg.guardian_id = app_guardian_id() AND cg.portal_access = true
$$;--> statement-breakpoint

-- --------------------------------------------- staff-only clinical tables
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'org_counters','staff_roles','staff_availability','child_assignments','consents',
    'assessments','assessment_domains','development_plans','development_goals','goal_reviews',
    'therapy_sessions','session_goals','session_observations','goal_observations','ai_drafts'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY staff_org_isolation ON %I USING (organization_id = app_current_org() AND app_is_staff()) WITH CHECK (organization_id = app_current_org() AND app_is_staff())',
      t);
  END LOOP;
END $$;--> statement-breakpoint

-- ------------------------------------------------------- shared tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY org_self ON organizations USING (id = app_current_org());--> statement-breakpoint

ALTER TABLE staff ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY staff_read ON staff FOR SELECT USING (organization_id = app_current_org());--> statement-breakpoint
CREATE POLICY staff_write ON staff FOR INSERT WITH CHECK (organization_id = app_current_org() AND app_is_staff());--> statement-breakpoint
CREATE POLICY staff_update ON staff FOR UPDATE USING (organization_id = app_current_org() AND app_is_staff()) WITH CHECK (organization_id = app_current_org());--> statement-breakpoint

ALTER TABLE services ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY services_read ON services FOR SELECT USING (organization_id = app_current_org());--> statement-breakpoint
CREATE POLICY services_insert ON services FOR INSERT WITH CHECK (organization_id = app_current_org() AND app_is_staff());--> statement-breakpoint
CREATE POLICY services_update ON services FOR UPDATE USING (organization_id = app_current_org() AND app_is_staff()) WITH CHECK (organization_id = app_current_org());--> statement-breakpoint

ALTER TABLE children ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY children_access ON children
  USING (organization_id = app_current_org() AND (app_is_staff() OR id IN (SELECT app_guardian_children())))
  WITH CHECK (organization_id = app_current_org() AND app_is_staff());--> statement-breakpoint

ALTER TABLE child_guardians ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY child_guardians_access ON child_guardians
  USING (organization_id = app_current_org() AND (app_is_staff() OR guardian_id = app_guardian_id()))
  WITH CHECK (organization_id = app_current_org() AND app_is_staff());--> statement-breakpoint

ALTER TABLE guardians ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY guardians_select ON guardians FOR SELECT
  USING (organization_id = app_current_org() AND (app_is_staff() OR id = app_guardian_id()));--> statement-breakpoint
CREATE POLICY guardians_insert ON guardians FOR INSERT
  WITH CHECK (organization_id = app_current_org() AND app_is_staff());--> statement-breakpoint
-- Guardians may update their OWN contact details only.
CREATE POLICY guardians_update ON guardians FOR UPDATE
  USING (organization_id = app_current_org() AND (app_is_staff() OR id = app_guardian_id()))
  WITH CHECK (organization_id = app_current_org());--> statement-breakpoint

ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY appointments_access ON appointments
  USING (organization_id = app_current_org() AND (app_is_staff() OR child_id IN (SELECT app_guardian_children())))
  WITH CHECK (organization_id = app_current_org() AND app_is_staff());--> statement-breakpoint

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY reports_access ON reports
  USING (organization_id = app_current_org() AND (app_is_staff()
         OR (status = 'shared' AND child_id IN (SELECT app_guardian_children()))))
  WITH CHECK (organization_id = app_current_org() AND app_is_staff());--> statement-breakpoint

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY documents_access ON documents
  USING (organization_id = app_current_org() AND (app_is_staff()
         OR (visible_to_guardians AND archived_at IS NULL AND NOT is_restricted
             AND child_id IN (SELECT app_guardian_children()))))
  WITH CHECK (organization_id = app_current_org() AND app_is_staff());--> statement-breakpoint

ALTER TABLE parent_messages ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY parent_messages_select ON parent_messages FOR SELECT
  USING (organization_id = app_current_org() AND (app_is_staff()
         OR (status = 'sent' AND child_id IN (SELECT app_guardian_children()))));--> statement-breakpoint
CREATE POLICY parent_messages_insert ON parent_messages FOR INSERT
  WITH CHECK (organization_id = app_current_org() AND (app_is_staff()
         OR (direction = 'from_guardian' AND sender_guardian_id = app_guardian_id()
             AND child_id IN (SELECT app_guardian_children()))));--> statement-breakpoint
CREATE POLICY parent_messages_update ON parent_messages FOR UPDATE
  USING (organization_id = app_current_org() AND (app_is_staff()
         OR (direction = 'to_guardian' AND status = 'sent' AND child_id IN (SELECT app_guardian_children()))))
  WITH CHECK (organization_id = app_current_org());--> statement-breakpoint

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY audit_insert ON audit_logs FOR INSERT WITH CHECK (organization_id = app_current_org());--> statement-breakpoint
CREATE POLICY audit_select ON audit_logs FOR SELECT USING (organization_id = app_current_org() AND app_is_staff());--> statement-breakpoint

-- --------------------------------------------------- tamper protection
CREATE OR REPLACE FUNCTION audit_logs_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only';
END $$;--> statement-breakpoint
CREATE TRIGGER audit_logs_no_update BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION audit_logs_immutable();--> statement-breakpoint

-- Signed session notes cannot be changed.
CREATE OR REPLACE FUNCTION therapy_sessions_lock() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'signed' THEN
    RAISE EXCEPTION 'Signed session records are locked';
  END IF;
  RETURN NEW;
END $$;--> statement-breakpoint
CREATE TRIGGER therapy_sessions_locked BEFORE UPDATE OR DELETE ON therapy_sessions
  FOR EACH ROW EXECUTE FUNCTION therapy_sessions_lock();--> statement-breakpoint

-- Finalized assessments cannot be changed.
CREATE OR REPLACE FUNCTION assessments_lock() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'finalized' THEN
    RAISE EXCEPTION 'Finalized assessments are locked';
  END IF;
  RETURN NEW;
END $$;--> statement-breakpoint
CREATE TRIGGER assessments_locked BEFORE UPDATE OR DELETE ON assessments
  FOR EACH ROW EXECUTE FUNCTION assessments_lock();--> statement-breakpoint

CREATE OR REPLACE FUNCTION assessment_domains_lock() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE s record_status;
BEGIN
  SELECT status INTO s FROM assessments WHERE id = COALESCE(NEW.assessment_id, OLD.assessment_id);
  IF s = 'finalized' THEN
    RAISE EXCEPTION 'Finalized assessments are locked';
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;--> statement-breakpoint
CREATE TRIGGER assessment_domains_locked BEFORE INSERT OR UPDATE OR DELETE ON assessment_domains
  FOR EACH ROW EXECUTE FUNCTION assessment_domains_lock();--> statement-breakpoint

-- Superseded goal versions are read-only except for the is_current flag.
CREATE OR REPLACE FUNCTION development_goals_history_lock() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.is_current = false THEN
    RAISE EXCEPTION 'Superseded goal versions are read-only';
  END IF;
  RETURN NEW;
END $$;--> statement-breakpoint
CREATE TRIGGER development_goals_history_locked BEFORE UPDATE ON development_goals
  FOR EACH ROW EXECUTE FUNCTION development_goals_history_lock();--> statement-breakpoint

-- updated_at maintenance
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;--> statement-breakpoint
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT table_name FROM information_schema.columns
            WHERE table_schema = 'public' AND column_name = 'updated_at' LOOP
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
                   t || '_set_updated_at', t);
  END LOOP;
END $$;--> statement-breakpoint

-- ------------------------------------------------ double-booking guard
ALTER TABLE appointments ADD CONSTRAINT appointments_staff_no_overlap
  EXCLUDE USING gist (staff_id WITH =, tstzrange(starts_at, ends_at) WITH &&)
  WHERE (status NOT IN ('cancelled', 'no_show'));--> statement-breakpoint
ALTER TABLE appointments ADD CONSTRAINT appointments_child_no_overlap
  EXCLUDE USING gist (child_id WITH =, tstzrange(starts_at, ends_at) WITH &&)
  WHERE (status NOT IN ('cancelled', 'no_show'));--> statement-breakpoint

-- -------------------------------- cross-organization reference protection
-- A plain FK ignores RLS, so a row in org A could otherwise reference a child
-- or staff member in org B. Composite FKs make that impossible.
ALTER TABLE children ADD CONSTRAINT children_org_id_uq UNIQUE (organization_id, id);--> statement-breakpoint
ALTER TABLE staff ADD CONSTRAINT staff_org_id_uq UNIQUE (organization_id, id);--> statement-breakpoint
ALTER TABLE guardians ADD CONSTRAINT guardians_org_id_uq UNIQUE (organization_id, id);--> statement-breakpoint
ALTER TABLE development_goals ADD CONSTRAINT development_goals_org_id_uq UNIQUE (organization_id, id);--> statement-breakpoint
ALTER TABLE therapy_sessions ADD CONSTRAINT therapy_sessions_org_id_uq UNIQUE (organization_id, id);--> statement-breakpoint
ALTER TABLE services ADD CONSTRAINT services_org_id_uq UNIQUE (organization_id, id);--> statement-breakpoint
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('child_assignments','child_id','children'), ('child_assignments','staff_id','staff'),
    ('child_guardians','child_id','children'), ('child_guardians','guardian_id','guardians'),
    ('consents','child_id','children'), ('assessments','child_id','children'),
    ('assessments','assessor_staff_id','staff'), ('development_plans','child_id','children'),
    ('development_goals','child_id','children'), ('development_goals','responsible_staff_id','staff'),
    ('goal_observations','child_id','children'), ('goal_observations','goal_id','development_goals'),
    ('appointments','child_id','children'), ('appointments','staff_id','staff'),
    ('appointments','service_id','services'),
    ('therapy_sessions','child_id','children'), ('therapy_sessions','therapist_staff_id','staff'),
    ('session_goals','session_id','therapy_sessions'), ('session_goals','goal_id','development_goals'),
    ('session_observations','session_id','therapy_sessions'),
    ('documents','child_id','children'), ('parent_messages','child_id','children'),
    ('reports','child_id','children'), ('staff_roles','staff_id','staff'),
    ('staff_availability','staff_id','staff')
  ) AS v(tbl, col, ref) LOOP
    EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (organization_id, %I) REFERENCES %I (organization_id, id)',
                   r.tbl, r.tbl || '_' || r.col || '_org_fk', r.col, r.ref);
  END LOOP;
END $$;
