import { db } from "@/lib/db";
import {
  analysisToAssistantReply,
  analysisToPathwaysJson,
  mergeAnalysisIntoIntelligenceJson,
  parseSituationAnalysis,
  runSituationAnalysis,
} from "./analysis";
import { parseFactSet, reconcileSituationFacts, serializeFactSet } from "./reconcile";
import { emptyInterviewState, runQuestionDirector } from "./question-director";
import type { SituationFactSet } from "./types";

function interviewFrom(set: SituationFactSet) {
  if (set.interview) {
    return {
      asked_count: set.interview.asked_count,
      asked_candidates: set.interview.asked_candidates ?? [],
      stopped: Boolean(set.interview.stopped),
      stop_reason: set.interview.stop_reason as
        | "threshold"
        | "max_questions"
        | "no_candidates"
        | "already_sufficient"
        | undefined,
    };
  }
  return emptyInterviewState();
}

/** Run and persist SI-4 analysis when interview is ready (idempotent if already analyzed). */
export async function ensureSituationAnalysisPersisted(
  situationId: string,
  opts?: { force?: boolean },
): Promise<{ ran: boolean; already?: boolean }> {
  const row = await db.situation.findUnique({ where: { id: situationId } });
  if (!row) return { ran: false };

  if (!opts?.force && parseSituationAnalysis(row.intelligenceJson)) {
    return { ran: false, already: true };
  }

  const factSet =
    parseFactSet(row.knownFactsJson) ?? reconcileSituationFacts(row.originalNarrative, row.goal);
  const director = runQuestionDirector(factSet, interviewFrom(factSet));
  if (!director.ready_for_analysis && director.next) {
    return { ran: false };
  }

  const analysis = await runSituationAnalysis(factSet, { enrichAuthority: true });
  const stoppedInterview = {
    ...factSet,
    schema_version: "si-1" as const,
    interview: {
      asked_count: director.interview.asked_count,
      asked_candidates: director.interview.asked_candidates,
      stopped: true,
      stop_reason: director.interview.stop_reason ?? "threshold",
    },
  };

  await db.situation.update({
    where: { id: situationId },
    data: {
      knownFactsJson: serializeFactSet(stoppedInterview),
      intelligenceJson: mergeAnalysisIntoIntelligenceJson(row.intelligenceJson, analysis),
      assistantReply: analysisToAssistantReply(analysis),
      currentPathwaysJson: analysisToPathwaysJson(analysis),
      currentRisksJson: JSON.stringify({
        unresolved: analysis.brief.unresolved,
        not_recommended: analysis.presentation.not_recommended,
        conflicts: analysis.conflicts,
      }),
      updatedAt: new Date(),
    },
  });

  return { ran: true };
}
