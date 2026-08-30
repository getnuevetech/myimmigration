"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser, requireUser } from "@/lib/auth";
import { getOrCreateGuestSession } from "@/lib/guest";
import { buildFilingPlanContent, parsePathwaysJson } from "@/lib/filing-plan";
import type { ActionState } from "@/actions/auth";

/**
 * Build a Filing Plan from a Situation. Never creates a Case / never runs V5.1.
 */
export async function createFilingPlanAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const situationId = String(formData.get("situationId") ?? "").trim();
  const selectedPathway = String(formData.get("selectedPathway") ?? "").trim();
  if (!situationId) return { error: "Missing situation." };

  const user = await getCurrentUser();
  const guest = user ? null : await getOrCreateGuestSession();

  const situation = await db.situation.findFirst({
    where: user
      ? { id: situationId, userId: user.id }
      : { id: situationId, guestSessionId: guest!.id },
  });
  if (!situation) return { error: "Situation not found." };

  const pathways = parsePathwaysJson(situation.currentPathwaysJson);
  const content = buildFilingPlanContent({
    selectedPathway: selectedPathway || pathways[0]?.id,
    pathways,
    narrative: situation.originalNarrative,
  });

  const plan = await db.filingPlan.create({
    data: {
      situationId: situation.id,
      selectedPathway: content.selectedPathway,
      eligibilityJson: JSON.stringify(content.eligibility),
      blockersJson: JSON.stringify(content.blockers),
      filingsJson: JSON.stringify(content.filings),
      evidenceNeedsJson: JSON.stringify(content.evidenceNeeds),
      sequenceJson: JSON.stringify(content.sequence),
      preparationStatus: content.preparationStatus,
      updatedAt: new Date(),
    },
  });

  await db.situation.update({
    where: { id: situation.id },
    data: { status: "filing_plan", updatedAt: new Date() },
  });

  redirect(user ? `/app/filing-plans/${plan.id}` : `/start/filing-plan?id=${plan.id}`);
}

/** Authenticated helper for tests / programmatic create. */
export async function createFilingPlanForSituation(situationId: string, selectedPathway?: string) {
  const user = await requireUser();
  const situation = await db.situation.findFirst({ where: { id: situationId, userId: user.id } });
  if (!situation) throw new Error("Situation not found");
  const pathways = parsePathwaysJson(situation.currentPathwaysJson);
  const content = buildFilingPlanContent({
    selectedPathway: selectedPathway || pathways[0]?.id,
    pathways,
    narrative: situation.originalNarrative,
  });
  return db.filingPlan.create({
    data: {
      situationId,
      selectedPathway: content.selectedPathway,
      eligibilityJson: JSON.stringify(content.eligibility),
      blockersJson: JSON.stringify(content.blockers),
      filingsJson: JSON.stringify(content.filings),
      evidenceNeedsJson: JSON.stringify(content.evidenceNeeds),
      sequenceJson: JSON.stringify(content.sequence),
      preparationStatus: "draft",
      updatedAt: new Date(),
    },
  });
}
