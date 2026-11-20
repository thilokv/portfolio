/** Individual Development Plans and versioned goals. */
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { Tx } from "@/db";
import { childAssignments, developmentGoals, developmentPlans, goalReviews, services, staff } from "@/db/schema";
import type { GoalInput, GoalReviewInput, PlanInput, ReviseGoalInput } from "@/lib/validation/plans";
import type { StaffActor } from "../auth/actor";
import { audit, diff } from "../audit";
import { assertChildAccess } from "../authz";
import { AppError, ForbiddenError, NotFoundError } from "../errors";
import { intOrNull, nn } from "../text";

export async function createPlan(tx: Tx, actor: StaffActor, input: PlanInput) {
  await assertChildAccess(tx, actor, input.childId, "canWriteClinical");
  const [row] = await tx
    .insert(developmentPlans)
    .values({
      organizationId: actor.orgId,
      childId: input.childId,
      title: input.title,
      startDate: input.startDate,
      reviewDate: input.reviewDate,
      familyPriorities: nn(input.familyPriorities),
      createdBy: actor.staffId,
    })
    .returning({ id: developmentPlans.id });
  await audit(tx, actor, { action: "plan.created", entityType: "development_plan", entityId: row.id, childId: input.childId, summary: input.title });
  return row.id;
}

async function loadPlan(tx: Tx, planId: string) {
  const [plan] = await tx.select().from(developmentPlans).where(eq(developmentPlans.id, planId));
  if (!plan) throw new NotFoundError("plan");
  return plan;
}

export async function setPlanStatus(tx: Tx, actor: StaffActor, planId: string, status: "active" | "closed" | "under_review") {
  const plan = await loadPlan(tx, planId);
  await assertChildAccess(tx, actor, plan.childId, "canWriteClinical");
  if (!actor.permissions.includes("plans.approve")) throw new ForbiddenError("plans.approve");
  if (plan.status === "closed") throw new AppError("errors.invalidStatus");
  await tx
    .update(developmentPlans)
    .set(status === "active" ? { status, approvedBy: actor.staffId, approvedAt: new Date() } : { status })
    .where(eq(developmentPlans.id, planId));
  await audit(tx, actor, { action: `plan.${status}`, entityType: "development_plan", entityId: planId, childId: plan.childId, changes: { status: { from: plan.status, to: status } } });
}

async function assertResponsibleOnTeam(tx: Tx, childId: string, staffId: string) {
  const [row] = await tx
    .select({ id: childAssignments.id })
    .from(childAssignments)
    .where(and(eq(childAssignments.childId, childId), eq(childAssignments.staffId, staffId), isNull(childAssignments.endedAt)));
  if (!row) throw new AppError("errors.assigneeNotOnTeam");
}

function goalValues(input: Omit<GoalInput, "planId">) {
  return {
    domain: input.domain,
    serviceId: nn(input.serviceId),
    title: input.title,
    baseline: input.baseline,
    target: input.target,
    measurementMethod: input.measurementMethod,
    targetPercent: intOrNull(input.targetPercent),
    strategies: input.strategies,
    responsibleStaffId: input.responsibleStaffId,
    reviewDate: input.reviewDate,
    status: input.status,
  };
}

export async function addGoal(tx: Tx, actor: StaffActor, input: GoalInput) {
  const plan = await loadPlan(tx, input.planId);
  await assertChildAccess(tx, actor, plan.childId, "canWriteClinical");
  if (plan.status === "closed") throw new AppError("errors.invalidStatus");
  await assertResponsibleOnTeam(tx, plan.childId, input.responsibleStaffId);
  const [row] = await tx
    .insert(developmentGoals)
    .values({
      ...goalValues(input),
      organizationId: actor.orgId,
      planId: plan.id,
      childId: plan.childId,
      goalGroupId: crypto.randomUUID(),
      version: 1,
      createdBy: actor.staffId,
    })
    .returning({ id: developmentGoals.id });
  await audit(tx, actor, { action: "goal.created", entityType: "development_goal", entityId: row.id, childId: plan.childId, summary: input.title });
  return row.id;
}

async function loadCurrentGoalForChange(tx: Tx, actor: StaffActor, goalId: string) {
  const [goal] = await tx.select().from(developmentGoals).where(eq(developmentGoals.id, goalId));
  if (!goal) throw new NotFoundError("goal");
  await assertChildAccess(tx, actor, goal.childId, "canWriteClinical");
  if (!goal.isCurrent) throw new AppError("errors.recordLocked");
  // Only the responsible professional or a coordinator may change a goal.
  if (goal.responsibleStaffId !== actor.staffId && !actor.permissions.includes("plans.approve")) {
    throw new AppError("errors.notYourRecord");
  }
  return goal;
}

/** Creates a new version; the previous version becomes read-only history. */
export async function reviseGoal(tx: Tx, actor: StaffActor, input: ReviseGoalInput) {
  const goal = await loadCurrentGoalForChange(tx, actor, input.goalId);
  await assertResponsibleOnTeam(tx, goal.childId, input.responsibleStaffId);
  await tx.update(developmentGoals).set({ isCurrent: false }).where(eq(developmentGoals.id, goal.id));
  const values = goalValues(input);
  const [row] = await tx
    .insert(developmentGoals)
    .values({
      ...values,
      organizationId: actor.orgId,
      planId: goal.planId,
      childId: goal.childId,
      goalGroupId: goal.goalGroupId,
      version: goal.version + 1,
      previousGoalId: goal.id,
      revisionReason: input.revisionReason,
      createdBy: actor.staffId,
    })
    .returning({ id: developmentGoals.id, version: developmentGoals.version });
  await audit(tx, actor, {
    action: "goal.revised",
    entityType: "development_goal",
    entityId: row.id,
    childId: goal.childId,
    summary: `v${row.version}: ${input.revisionReason}`,
    changes: diff(goal as unknown as Record<string, unknown>, values),
  });
  return row;
}

export async function reviewGoal(tx: Tx, actor: StaffActor, input: GoalReviewInput) {
  const goal = await loadCurrentGoalForChange(tx, actor, input.goalId);
  await tx.insert(goalReviews).values({
    organizationId: actor.orgId,
    goalId: goal.id,
    reviewedOn: input.reviewedOn,
    reviewerStaffId: actor.staffId,
    statusBefore: goal.status,
    statusAfter: input.statusAfter,
    summary: input.summary,
  });
  if (goal.status !== input.statusAfter) {
    await tx.update(developmentGoals).set({ status: input.statusAfter }).where(eq(developmentGoals.id, goal.id));
  }
  await audit(tx, actor, {
    action: "goal.reviewed",
    entityType: "development_goal",
    entityId: goal.id,
    childId: goal.childId,
    changes: { status: { from: goal.status, to: input.statusAfter } },
  });
}

export async function getPlans(tx: Tx, actor: StaffActor, childId: string) {
  await assertChildAccess(tx, actor, childId, "canViewClinical");
  const approver = alias(staff, "approver");
  const plans = await tx
    .select({ plan: developmentPlans, approverName: approver.fullName })
    .from(developmentPlans)
    .leftJoin(approver, eq(approver.id, developmentPlans.approvedBy))
    .where(eq(developmentPlans.childId, childId))
    .orderBy(desc(developmentPlans.startDate));
  const goals = await tx
    .select({ goal: developmentGoals, responsibleName: staff.fullName, serviceCode: services.code })
    .from(developmentGoals)
    .innerJoin(staff, eq(staff.id, developmentGoals.responsibleStaffId))
    .leftJoin(services, eq(services.id, developmentGoals.serviceId))
    .where(eq(developmentGoals.childId, childId))
    .orderBy(asc(developmentGoals.createdAt));
  const goalIds = goals.map((g) => g.goal.id);
  const reviews = goalIds.length
    ? await tx
        .select({ review: goalReviews, reviewerName: staff.fullName })
        .from(goalReviews)
        .innerJoin(staff, eq(staff.id, goalReviews.reviewerStaffId))
        .where(inArray(goalReviews.goalId, goalIds))
        .orderBy(desc(goalReviews.reviewedOn))
    : [];
  return plans.map((p) => ({
    ...p.plan,
    approverName: p.approverName,
    goals: goals
      .filter((g) => g.goal.planId === p.plan.id && g.goal.isCurrent)
      .map((g) => ({
        ...g.goal,
        responsibleName: g.responsibleName,
        serviceCode: g.serviceCode,
        history: goals
          .filter((h) => h.goal.goalGroupId === g.goal.goalGroupId && !h.goal.isCurrent)
          .sort((a, b) => b.goal.version - a.goal.version)
          .map((h) => ({ ...h.goal, responsibleName: h.responsibleName })),
        reviews: reviews
          .filter((r) => goals.some((x) => x.goal.goalGroupId === g.goal.goalGroupId && x.goal.id === r.review.goalId))
          .map((r) => ({ ...r.review, reviewerName: r.reviewerName })),
        canChange: g.goal.responsibleStaffId === actor.staffId || actor.permissions.includes("plans.approve"),
      })),
  }));
}

/** Care-team members eligible to be responsible for goals. */
export async function careTeamOptions(tx: Tx, childId: string) {
  return tx
    .selectDistinct({ id: staff.id, fullName: staff.fullName })
    .from(childAssignments)
    .innerJoin(staff, eq(staff.id, childAssignments.staffId))
    .where(and(eq(childAssignments.childId, childId), isNull(childAssignments.endedAt), eq(staff.isActive, true)))
    .orderBy(asc(staff.fullName));
}
