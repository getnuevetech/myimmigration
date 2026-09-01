"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getOrCreateGuestSession } from "@/lib/guest";
import { saveUpload } from "@/lib/uploads";
import { situationTitleFromNarrative } from "@/lib/situation";
import type { ConversationIntelligence } from "@/lib/conversation";
import type { ActionState } from "@/actions/auth";
import { reconcileSituationFacts, serializeFactSet } from "@/lib/situation-intelligence";

/**
 * Persist a Situation workspace (Phase S Option B).
 * Never runs V5.1 Case analysis.
 * Phase SI-1: persists reconciled Situation Fact Set into knownFactsJson.
 */
export async function createSituationFromIntelligence(opts: {
  situation: string;
  goal: string;
  intel: ConversationIntelligence;
  assistantReply: string;
  files?: File[];
}): Promise<{ id: string; userId: string | null }> {
  const user = await getCurrentUser();
  const guest = user ? null : await getOrCreateGuestSession();
  const files = opts.files ?? [];

  const factSet = reconcileSituationFacts(opts.situation, opts.goal);

  const row = await db.situation.create({
    data: {
      userId: user?.id ?? null,
      guestSessionId: user ? null : guest!.id,
      title: situationTitleFromNarrative(
        opts.situation,
        opts.intel.question_contract.explicit_question,
      ),
      originalNarrative: opts.situation,
      goal: opts.goal,
      questionContractJson: JSON.stringify(opts.intel.question_contract),
      currentDecisionTarget: opts.intel.question_contract.decision_target,
      knownFactsJson: serializeFactSet(factSet),
      currentPathwaysJson: JSON.stringify(
        opts.intel.strategy.branches.map((b) => ({ id: b.id, condition: b.condition, explanation: b.explanation })),
      ),
      currentRisksJson: "[]",
      status: "guiding",
      intelligenceJson: JSON.stringify(opts.intel),
      learningEventJson: JSON.stringify(opts.intel.experience_record ?? opts.intel.learning_event),
      assistantReply: opts.assistantReply,
      updatedAt: new Date(),
    },
  });

  const docKind = "identity";
  for (const file of files.slice(0, 10)) {
    const { filePath, sizeBytes } = await saveUpload(file);
    await db.document.create({
      data: {
        userId: user?.id ?? null,
        guestSessionId: user ? null : guest!.id,
        situationId: row.id,
        fileName: file.name,
        filePath,
        mimeType: file.type || "application/octet-stream",
        sizeBytes,
        docKind,
      },
    });
  }

  const experience = opts.intel.experience_record;
  after(() => publishSituationExperience(row.id, experience));

  return { id: row.id, userId: user?.id ?? null };
}

/** After Situation create — publish L1 anon observation (best-effort; never blocks intake). */
export async function publishSituationExperience(situationId: string, record: unknown) {
  try {
    const { publishAnonymizedObservation } = await import("@/lib/experience/publish");
    if (!record || typeof record !== "object") return;
    const r = record as import("@/lib/experience").ExperienceRecordV0;
    if (r.schema_version !== "l0") return;
    await publishAnonymizedObservation({ record: r, situationId });
  } catch {
    /* L1 publish must not fail customer intake */
  }
}

export async function redirectToSituation(id: string, userId: string | null) {
  redirect(userId ? `/app/situations/${id}` : `/start/situation?id=${id}`);
}

/** No-op placeholder so after() callers have a typed import path for future enrichment. */
export async function recordSituationLearningEvent(situationId: string) {
  after(async () => {
    try {
      const row = await db.situation.findUnique({ where: { id: situationId }, select: { learningEventJson: true } });
      if (!row?.learningEventJson) return;
      // S7 will consume learningEventJson into Experience Memory; S1 only persists on the Situation.
    } catch {
      /* ignore */
    }
  });
}

export type { ActionState };
