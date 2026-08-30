"use server";

import { db } from "@/lib/db";
import { requireUser, isAdmin } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import {
  applyConsultantCorrection,
  buildPatternCandidate,
  publishPatternCandidateFromCorrection,
  type ConsultantCorrectionInput,
  type CorrectionFailureType,
  CORRECTION_FAILURE_TYPES,
  type ExperienceRecordV0,
} from "@/lib/experience";
import type { ActionState } from "@/actions/auth";

function canCorrectExperience(user: { role: string }): boolean {
  return user.role === ROLES.CONSULTANT || isAdmin(user);
}

function parseCorrectionFromForm(formData: FormData): ConsultantCorrectionInput {
  const failure = String(formData.get("failure_type") ?? "other").trim() as CorrectionFailureType;
  return {
    failure_type: CORRECTION_FAILURE_TYPES.includes(failure) ? failure : "other",
    incorrect_key: String(formData.get("incorrect_key") ?? "").trim(),
    preferred_key: String(formData.get("preferred_key") ?? "").trim(),
    note_key: String(formData.get("note_key") ?? "").trim(),
    lesson_id: String(formData.get("lesson_id") ?? "").trim() || null,
    corrected_decision_target: String(formData.get("corrected_decision_target") ?? "").trim() || undefined,
  };
}

/**
 * L3 — consultant/admin records a structured correction against a Situation's
 * experience capture and publishes a de-identified pattern candidate (level 1).
 */
export async function recordConsultantExperienceCorrectionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  if (!canCorrectExperience(user)) {
    return { error: "Only consultants or admins can record experience corrections." };
  }

  const situationId = String(formData.get("situationId") ?? "").trim();
  if (!situationId) return { error: "Missing situation." };

  const situation = await db.situation.findUnique({
    where: { id: situationId },
    select: { id: true, learningEventJson: true },
  });
  if (!situation) return { error: "Situation not found." };

  let record: ExperienceRecordV0;
  try {
    const parsed = JSON.parse(situation.learningEventJson || "{}") as ExperienceRecordV0;
    if (!parsed?.schema_version || !parsed?.question_contract) {
      return { error: "Situation has no experience record to correct." };
    }
    record = parsed;
  } catch {
    return { error: "Situation experience record is invalid." };
  }

  let correction: ConsultantCorrectionInput;
  try {
    correction = parseCorrectionFromForm(formData);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Invalid correction." };
  }

  try {
    const { corrected } = await publishPatternCandidateFromCorrection({
      record,
      correction,
      situationId: situation.id,
    });

    // Keep owner-scoped learning JSON updated with the correction (still not shared raw).
    await db.situation.update({
      where: { id: situation.id },
      data: {
        learningEventJson: JSON.stringify(corrected),
        updatedAt: new Date(),
      },
    });

    return { ok: true, info: "Correction recorded as a pattern candidate." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to publish pattern candidate." };
  }
}

/** Programmatic helper for tests / consultant tooling (no FormData). */
export async function recordConsultantExperienceCorrection(opts: {
  situationId: string;
  correction: ConsultantCorrectionInput;
}): Promise<{ candidateId: string; corrected: ExperienceRecordV0 }> {
  const user = await requireUser();
  if (!canCorrectExperience(user)) {
    throw new Error("Only consultants or admins can record experience corrections.");
  }

  const situation = await db.situation.findUnique({
    where: { id: opts.situationId },
    select: { id: true, learningEventJson: true },
  });
  if (!situation?.learningEventJson) throw new Error("Situation has no experience record.");

  const record = JSON.parse(situation.learningEventJson) as ExperienceRecordV0;
  const { id, corrected } = await publishPatternCandidateFromCorrection({
    record,
    correction: opts.correction,
    situationId: situation.id,
  });

  await db.situation.update({
    where: { id: situation.id },
    data: { learningEventJson: JSON.stringify(corrected), updatedAt: new Date() },
  });

  return { candidateId: id, corrected };
}

/** Pure helper re-export for unit-style checks without DB. */
export { applyConsultantCorrection, buildPatternCandidate };
