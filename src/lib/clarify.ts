import "server-only";
import { db } from "./db";
import { nextPlannedQuestion } from "./question-planner";
import { classifyImmigrationInquiry, INQUIRY_MODES, OPEN_OPTIONS_POSTURE } from "./immigration-inquiry";
import { selectNextClarifyQuestion, type ClarifyQuestionPick } from "./goal-suggestions";
import { resolveCasePresentation } from "./case-presentation";

// The clarifying interview: when the analysis is thin, the app asks the
// customer targeted questions. Answers are stored as clarify messages and
// user-reported facts. They are not appended to the customer-facing situation
// narrative. The situation brief reconstructs them, then analysis re-runs.

export type ClarifyQuestion = ClarifyQuestionPick;

export { suggestionQuestionKey, situationLine } from "./goal-suggestions";

export async function caseUsesOpenOptionsInterview(caseId: string): Promise<boolean> {
  const c = await db.case.findUnique({
    where: { id: caseId },
    select: { situation: true, goal: true, reconstruction: { select: { currentPosition: true } } },
  });
  if (!c) return false;
  const inquiry = classifyImmigrationInquiry({ situation: c.situation, goal: c.goal });
  if (inquiry.mode === INQUIRY_MODES.EXISTING_CASE) return false;
  const presentation = await resolveCasePresentation(caseId).catch(() => null);
  const posture = presentation?.hero.current_posture || c.reconstruction?.currentPosition || "";
  return inquiry.mode === INQUIRY_MODES.OPEN_OPTIONS || posture === OPEN_OPTIONS_POSTURE;
}

/**
 * The next unanswered question for this case, or null when the interview is
 * complete. Questions are derived from what the analysis actually lacks.
 */
export async function nextClarifyQuestion(caseId: string): Promise<ClarifyQuestion | null> {
  const c = await db.case.findUnique({
    where: { id: caseId },
    include: {
      issues: true,
      documents: { where: { deletedAt: null } },
      clarifyMessages: { where: { role: "user" } },
      unknowns: { where: { status: "open" }, orderBy: { createdAt: "asc" } },
      suppressedQuestions: true,
    },
  });
  if (!c || c.status === "closed") return null;

  const answered = c.clarifyMessages.map((m) => m.questionKey);
  // Phase −1.7: prefer need-to-know critical asks aligned to Question Contract.
  try {
    const { intelligenceForCase, needToKnowClarifyQuestion } = await import("@/lib/conversation");
    const row = await db.case.findUnique({ where: { id: caseId }, select: { intelligenceJson: true } });
    const intel = intelligenceForCase({
      situation: c.situation,
      goal: c.goal,
      intelligenceJson: row?.intelligenceJson,
    });
    if (!intel.answerability.clarify_first_required) {
      const ntk = needToKnowClarifyQuestion(intel, answered);
      if (ntk) {
        return { key: ntk.key, text: ntk.text };
      }
      // Answer-first complete and no critical ask left — do not dump schema unknowns.
      if (intel.strategy.mode === "answer" || intel.strategy.ask_now.length === 0) {
        const openOptions = await caseUsesOpenOptionsInterview(caseId);
        if (openOptions && intel.route.pipeline === "assistant") return null;
      }
    }
  } catch {
    /* fall through to legacy planner */
  }

  const suppressedEvidenceKeys = new Set(c.suppressedQuestions.map((q) => q.evidenceFactId || q.questionKey));
  const hasCaseRecord =
    c.documents.some((d) => ["case_record", "case record", "receipt"].includes(d.docKind)) ||
    (suppressedEvidenceKeys.has("receipt_number") && suppressedEvidenceKeys.has("form_type"));
  const plannedQuestion = await nextPlannedQuestion(caseId);
  const openOptions = await caseUsesOpenOptionsInterview(caseId);
  const presentation = openOptions ? null : await resolveCasePresentation(caseId).catch(() => null);
  const hasYear = c.issues.some((i) => i.caseYear);
  return selectNextClarifyQuestion({
    openOptions,
    answeredKeys: answered,
    planned: plannedQuestion ? { unknownKey: plannedQuestion.unknownKey, question: plannedQuestion.question } : null,
    presentationUnknowns: presentation?.what_this_means.unknowns ?? [],
    hasYear,
    hasCaseUpdate: Boolean(c.issues.find((i) => i.issueType === "case_update_discrepancy")),
    hasFee: Boolean(c.issues.find((i) => i.issueType === "fee_or_payment_issue")),
    hasNotice: Boolean(c.issues.find((i) => i.issueType === "uscis_notice_response")),
    hasFiling: Boolean(c.issues.find((i) => ["missing_filing", "missing_evidence"].includes(i.issueType))),
    hasCaseRecord,
  });
}
