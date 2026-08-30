"use server";

import { db } from "@/lib/db";
import { requireUser, isAdmin } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import {
  publishPatternCandidateFromOutcome,
  OUTCOME_KINDS,
  GOVERNMENT_SYSTEMS,
  ALLOWED_AUTHORITY_PUBLISHERS,
  type GovernmentOutcomeInput,
  type OutcomeKind,
  type GovernmentSystem,
  type ExperienceRecordV0,
} from "@/lib/experience";
import type { ActionState } from "@/actions/auth";

function canRecordOutcome(user: { role: string }): boolean {
  return user.role === ROLES.CONSULTANT || isAdmin(user);
}

function parseOutcomeFromForm(formData: FormData): GovernmentOutcomeInput {
  const kindRaw = String(formData.get("outcome_kind") ?? "").trim() as OutcomeKind;
  const systemRaw = String(formData.get("government_system") ?? "").trim() as GovernmentSystem;
  const authorityKeysRaw = String(formData.get("authority_keys") ?? "")
    .split(/[\s,]+/)
    .map((k) => k.trim())
    .filter(Boolean);
  const factsRaw = String(formData.get("decision_changing_facts") ?? "")
    .split(/[\s,]+/)
    .map((k) => k.trim())
    .filter(Boolean);

  return {
    outcome_kind: OUTCOME_KINDS.includes(kindRaw) ? kindRaw : "other_government_action",
    government_system: GOVERNMENT_SYSTEMS.includes(systemRaw) ? systemRaw : "uscis",
    form_or_notice_key: String(formData.get("form_or_notice_key") ?? "").trim(),
    decision_changing_facts: factsRaw,
    authority_keys: authorityKeysRaw,
    authority_publisher: String(formData.get("authority_publisher") ?? "USCIS").trim(),
    note_key: String(formData.get("note_key") ?? "").trim(),
  };
}

/**
 * L4 — consultant/admin records a government outcome signal against a Situation
 * experience capture and publishes an authority-checked pattern candidate (level 1).
 * Outcome ≠ law; never writes production (level 4) patterns.
 */
export async function recordGovernmentOutcomeAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  if (!canRecordOutcome(user)) {
    return { error: "Only consultants or admins can record government outcome signals." };
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
      return { error: "Situation has no experience record for outcome capture." };
    }
    record = parsed;
  } catch {
    return { error: "Situation experience record is invalid." };
  }

  const outcome = parseOutcomeFromForm(formData);
  if (!(ALLOWED_AUTHORITY_PUBLISHERS as readonly string[]).includes(String(outcome.authority_publisher).toUpperCase())) {
    return { error: `authority_publisher must be one of ${ALLOWED_AUTHORITY_PUBLISHERS.join(", ")}.` };
  }

  const catalog = await db.authoritySource.findMany({
    where: { isActive: true },
    select: { key: true },
  });
  const catalogKeys = catalog.map((row) => row.key);

  try {
    const { updated } = await publishPatternCandidateFromOutcome({
      record,
      outcome,
      situationId: situation.id,
      authorityCatalogKeys: catalogKeys.length ? catalogKeys : undefined,
    });

    await db.situation.update({
      where: { id: situation.id },
      data: {
        learningEventJson: JSON.stringify(updated),
        updatedAt: new Date(),
      },
    });

    return { success: "Government outcome recorded as a pattern candidate (historical experience only)." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to publish outcome candidate." };
  }
}

/** Programmatic helper for tests / tooling. */
export async function recordGovernmentOutcome(opts: {
  situationId: string;
  outcome: GovernmentOutcomeInput;
}): Promise<{ candidateId: string; updated: ExperienceRecordV0 }> {
  const user = await requireUser();
  if (!canRecordOutcome(user)) {
    throw new Error("Only consultants or admins can record government outcome signals.");
  }

  const situation = await db.situation.findUnique({
    where: { id: opts.situationId },
    select: { id: true, learningEventJson: true },
  });
  if (!situation?.learningEventJson) throw new Error("Situation has no experience record.");

  const record = JSON.parse(situation.learningEventJson) as ExperienceRecordV0;
  const catalog = await db.authoritySource.findMany({
    where: { isActive: true },
    select: { key: true },
  });

  const { id, updated } = await publishPatternCandidateFromOutcome({
    record,
    outcome: opts.outcome,
    situationId: situation.id,
    authorityCatalogKeys: catalog.length ? catalog.map((r) => r.key) : undefined,
  });

  await db.situation.update({
    where: { id: situation.id },
    data: { learningEventJson: JSON.stringify(updated), updatedAt: new Date() },
  });

  return { candidateId: id, updated };
}
