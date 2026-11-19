-- Rows attached to a signed session (goals addressed, measurements,
-- observations) are locked together with the session note.
CREATE OR REPLACE FUNCTION session_children_lock() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE sid uuid; s session_status;
BEGIN
  sid := COALESCE(NEW.session_id, OLD.session_id);
  IF sid IS NOT NULL THEN
    SELECT status INTO s FROM therapy_sessions WHERE id = sid;
    IF s = 'signed' THEN
      RAISE EXCEPTION 'Signed session records are locked';
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;--> statement-breakpoint
CREATE TRIGGER goal_observations_session_lock BEFORE INSERT OR UPDATE OR DELETE ON goal_observations
  FOR EACH ROW EXECUTE FUNCTION session_children_lock();--> statement-breakpoint
CREATE TRIGGER session_goals_session_lock BEFORE INSERT OR UPDATE OR DELETE ON session_goals
  FOR EACH ROW EXECUTE FUNCTION session_children_lock();--> statement-breakpoint
CREATE TRIGGER session_observations_session_lock BEFORE INSERT OR UPDATE OR DELETE ON session_observations
  FOR EACH ROW EXECUTE FUNCTION session_children_lock();
