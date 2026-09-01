"use server";

import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getOrCreateGuestSession } from "@/lib/guest";
import {
  applyInterviewAnswer,
  buildInterviewQualityCapture,
  emptyInterviewState,
  mergeInterviewQualityIntoLearningJson,
  parseFactSet,
  reconcileSituationFacts,
  runQuestionDirector,
  serializeFactSet,
  type DirectorResult,
  type InterviewState,
  type SituationFactSet,
} from "@/lib/situation-intelligence";

async function loadOwnedSituation(situationId: string) {
  const user = await getCurrentUser();
  const guest = user ? null : await getOrCreateGuestSession();
  const row = await db.situation.findFirst({
    where: {
      id: situationId,
      ...(user ? { userId: user.id } : { guestSessionId: guest!.id }),
    },
  });
  return row;
}

function interviewFromFactSet(set: SituationFactSet): InterviewState {
  if (set.interview) {
    return {
      asked_count: set.interview.asked_count,
      asked_candidates: set.interview.asked_candidates ?? [],
      stopped: Boolean(set.interview.stopped),
      stop_reason: set.interview.stop_reason as InterviewState["stop_reason"],
    };
  }
  return emptyInterviewState();
}

function withInterview(set: SituationFactSet, interview: InterviewState): SituationFactSet {
  return {
    ...set,
    schema_version: "si-1",
    interview: {
      asked_count: interview.asked_count,
      asked_candidates: interview.asked_candidates,
      stopped: interview.stopped,
      stop_reason: interview.stop_reason,
    },
  };
}

function ensureFactSet(row: { knownFactsJson: string; originalNarrative: string; goal: string }): SituationFactSet {
  const parsed = parseFactSet(row.knownFactsJson);
  if (parsed) return parsed;
  return reconcileSituationFacts(row.originalNarrative, row.goal);
}

/** Next high-value interview question (or ready_for_analysis). */
export async function getSituationInterviewNextAction(
  situationId: string,
): Promise<{ ok: true; result: DirectorResult } | { ok: false; error: string }> {
  const row = await loadOwnedSituation(situationId);
  if (!row) return { ok: false, error: "Situation not found." };

  const factSet = ensureFactSet(row);
  const interview = interviewFromFactSet(factSet);
  const result = runQuestionDirector(factSet, interview);

  const persisted = withInterview(factSet, result.interview);
  await db.situation.update({
    where: { id: row.id },
    data: { knownFactsJson: serializeFactSet(persisted), updatedAt: new Date() },
  });

  return { ok: true, result };
}

/** Record an answer, re-rank, return next question. */
export async function answerSituationInterviewAction(
  situationId: string,
  candidateId: string,
  answer: string,
): Promise<{ ok: true; result: DirectorResult } | { ok: false; error: string }> {
  const row = await loadOwnedSituation(situationId);
  if (!row) return { ok: false, error: "Situation not found." };
  if (!candidateId.trim() || !answer.trim()) return { ok: false, error: "Answer required." };

  const factSet = ensureFactSet(row);
  const interview = interviewFromFactSet(factSet);
  if (interview.stopped || interview.asked_count >= 6) {
    const result = runQuestionDirector(factSet, { ...interview, stopped: true, stop_reason: "max_questions" });
    return { ok: true, result: { ...result, ready_for_analysis: true } };
  }

  const applied = applyInterviewAnswer(factSet, interview, candidateId, answer);
  const result = runQuestionDirector(applied.factSet, applied.interview);
  const persisted = withInterview(applied.factSet, result.interview);

  const quality = result.ready_for_analysis
    ? buildInterviewQualityCapture({
        asked_candidates: result.interview.asked_candidates,
        ask_count: result.interview.asked_count,
        stop_reason: result.interview.stop_reason,
        ready_for_analysis: true,
        hints: result.learning_hints,
        ranked: result.ranked,
      })
    : null;

  await db.situation.update({
    where: { id: row.id },
    data: {
      knownFactsJson: serializeFactSet(persisted),
      ...(quality
        ? { learningEventJson: mergeInterviewQualityIntoLearningJson(row.learningEventJson, quality) }
        : {}),
      updatedAt: new Date(),
    },
  });

  if (result.ready_for_analysis) {
    const { ensureSituationAnalysisPersisted } = await import("@/lib/situation-intelligence");
    await ensureSituationAnalysisPersisted(row.id);
  }

  return { ok: true, result };
}

export type SituationInterviewFormState = { ok?: boolean; error?: string } | null;

/** Form-friendly wrapper for the interview UI (useActionState). */
export async function answerSituationInterviewFormAction(
  _prev: SituationInterviewFormState,
  formData: FormData,
): Promise<SituationInterviewFormState> {
  const situationId = String(formData.get("situationId") ?? "");
  const candidateId = String(formData.get("candidateId") ?? "");
  const answer = String(formData.get("answer") ?? "");
  const res = await answerSituationInterviewAction(situationId, candidateId, answer);
  if (!res.ok) return { error: res.error };
  return { ok: true };
}
