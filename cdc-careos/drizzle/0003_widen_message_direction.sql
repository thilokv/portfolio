-- "from_guardian" is 13 characters; widen the column. Policies that reference
-- the column must be dropped and re-created around the type change.
DROP POLICY parent_messages_insert ON parent_messages;--> statement-breakpoint
DROP POLICY parent_messages_update ON parent_messages;--> statement-breakpoint
ALTER TABLE "parent_messages" ALTER COLUMN "direction" SET DATA TYPE varchar(16);--> statement-breakpoint
CREATE POLICY parent_messages_insert ON parent_messages FOR INSERT
  WITH CHECK (organization_id = app_current_org() AND (app_is_staff()
         OR (direction = 'from_guardian' AND sender_guardian_id = app_guardian_id()
             AND child_id IN (SELECT app_guardian_children()))));--> statement-breakpoint
CREATE POLICY parent_messages_update ON parent_messages FOR UPDATE
  USING (organization_id = app_current_org() AND (app_is_staff()
         OR (direction = 'to_guardian' AND status = 'sent' AND child_id IN (SELECT app_guardian_children()))))
  WITH CHECK (organization_id = app_current_org());
