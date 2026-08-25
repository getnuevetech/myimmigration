import "server-only";
import { db } from "./db";
import { nextPlannedQuestion } from "./question-planner";
import { classifyImmigrationInquiry, INQUIRY_MODES, OPEN_OPTIONS_POSTURE } from "./immigration-inquiry";
import { selectNextClarifyQuestion, type ClarifyQuestionPick } from "./goal-suggestions";
import { resolveCasePresentation } from "./case-presentation";

// The clarifying interview: when the analysis is thin (missing timeline years,
// forms, receipt numbers, dates, notices, or documents), the app asks the customer targeted questions in a
// chat conversation. Every answer is folded back into the case narrative in a
// form the extraction engine parses, and the analysis re-runs automatically —
// so each answer visibly sharpens the findings.

export type ClarifyQuestion = ClarifyQuestionPick;

export { suggestionQuestionKey } from "./goal-suggestions";

// How each answer is written back into the case narrative. The phrasing
// matters: it gives the extraction engine the USCIS context words it needs.
export function situationLine(key: string, questionText: string, answer: string): string {
  const a = answer.trim();
  if (key.startsWith("evidence:")) return `[Clarified evidence] ${questionText}: ${a}.`;
  switch (key) {
    case "case_year":
      return `[Clarified] Immigration matter year(s): ${a}.`;
    case "case_status_expected":
      return `[Clarified] I expected this immigration case status or result: ${a}.`;
    case "case_status_received":
      return `[Clarified] USCIS actually sent this status or result: ${a}.`;
    case "fee_or_payment_issue":
      return `[Clarified] USCIS listed this fee or payment issue: ${a}.`;
    case "notice_details":
      return `[Clarified] My USCIS notice: ${a}.`;
    case "missing_filings":
      return `[Clarified] Missing or pending filing details: ${a}.`;
    case "have_case_record":
      return `[Clarified] About my USCIS case record: ${a}.`;
    default:
      return `[Clarified] ${questionText} — ${a}.`;
  }
}

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
