/** AI drafting: de-identify → generate → log as "pending review". Never writes clinical records. */
import { and, desc, eq } from "drizzle-orm";
import type { Tx } from "@/db";
import { aiDrafts, childGuardians, children, developmentGoals, guardians } from "@/db/schema";
import { redact } from "@/lib/ai-redact";
import { ageFrom } from "@/lib/dates";
import type { StaffActor } from "../auth/actor";
import { audit } from "../audit";
import { assertChildAccess } from "../authz";
import { ForbiddenError, NotFoundError } from "../errors";
import { getProvider, type AiFeature } from "../ai/providers";
import { hasConsent } from "./children";

export async function generateDraft(tx: Tx, actor: StaffActor, input: { feature: AiFeature; text: string; childId?: string }) {
  if (!actor.permissions.includes("ai.use")) throw new ForbiddenError("ai.use");
  const names = [actor.name];
  let context: string | undefined;
  let consentUsed = false;
  if (input.childId) {
    await assertChildAccess(tx, actor, input.childId, "canViewClinical");
    const [child] = await tx.select().from(children).where(eq(children.id, input.childId));
    const gs = await tx
      .select({ name: guardians.fullName })
      .from(childGuardians)
      .innerJoin(guardians, eq(guardians.id, childGuardians.guardianId))
      .where(eq(childGuardians.childId, input.childId));
    names.push(child.fullName, child.preferredName ?? "", child.emergencyContactName ?? "", ...gs.map((g) => g.name));
    // Child context is used only with recorded AI-assistance consent.
    if (await hasConsent(tx, input.childId, "ai_assistance")) {
      consentUsed = true;
      const age = ageFrom(child.dateOfBirth);
      const goals = await tx
        .select({ title: developmentGoals.title, domain: developmentGoals.domain })
        .from(developmentGoals)
        .where(and(eq(developmentGoals.childId, input.childId), eq(developmentGoals.isCurrent, true)));
      context = `Child age: ${age.years}y ${age.months}m\nCurrent goals:\n${goals.map((g) => `- (${g.domain}) ${g.title}`).join("\n") || "- none recorded"}`;
    }
  }
  const safeInput = redact(input.text, names);
  const safeContext = context ? redact(context, names) : undefined;
  const provider = getProvider();
  const output = await provider.generate({ feature: input.feature, input: safeInput, context: safeContext });
  const [row] = await tx
    .insert(aiDrafts)
    .values({
      organizationId: actor.orgId,
      requestedBy: actor.staffId,
      childId: input.childId ?? null,
      feature: input.feature,
      provider: provider.name,
      promptRedacted: `${safeContext ? `${safeContext}\n---\n` : ""}${safeInput}`,
      output,
    })
    .returning({ id: aiDrafts.id });
  await audit(tx, actor, { action: "ai.draft_generated", entityType: "ai_draft", entityId: row.id, childId: input.childId ?? null, summary: `${input.feature} via ${provider.name}` });
  return { id: row.id, output, provider: provider.name, consentUsed, redactedInput: safeInput };
}

export async function reviewDraft(tx: Tx, actor: StaffActor, id: string, status: "accepted" | "discarded") {
  const [d] = await tx.select().from(aiDrafts).where(eq(aiDrafts.id, id));
  if (!d) throw new NotFoundError("draft");
  if (d.requestedBy !== actor.staffId) throw new ForbiddenError("not your draft");
  await tx.update(aiDrafts).set({ status, reviewedAt: new Date() }).where(eq(aiDrafts.id, id));
  await audit(tx, actor, { action: `ai.draft_${status}`, entityType: "ai_draft", entityId: id, childId: d.childId });
}

export async function myRecentDrafts(tx: Tx, actor: StaffActor) {
  return tx
    .select({ id: aiDrafts.id, feature: aiDrafts.feature, provider: aiDrafts.provider, status: aiDrafts.status, output: aiDrafts.output, createdAt: aiDrafts.createdAt })
    .from(aiDrafts)
    .where(eq(aiDrafts.requestedBy, actor.staffId))
    .orderBy(desc(aiDrafts.createdAt))
    .limit(10);
}
