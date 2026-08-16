import "server-only";
import { db } from "./db";

// The clarifying interview: when the analysis is thin (missing amounts,
// years, dates, documents), the app asks the customer targeted questions in a
// chat conversation. Every answer is folded back into the case narrative in a
// form the extraction engine parses, and the analysis re-runs automatically —
// so each answer visibly sharpens the findings.

export type ClarifyQuestion = { key: string; text: string };

// How each answer is written back into the case narrative. The phrasing
// matters: it gives the amount-classifier the context words it needs.
export function situationLine(key: string, questionText: string, answer: string): string {
  const a = answer.trim();
  switch (key) {
    case "tax_year":
      return `[Clarified] Case year(s) involved: ${a}.`;
    case "case_status_expected":
      return `[Clarified] I expected this immigration case status or result: ${a}.`;
    case "case_status_received":
      return `[Clarified] USCIS actually sent this status or result: ${a}.`;
    case "fee_or_balance_amount":
      return `[Clarified] USCIS listed this fee, amount, or balance: ${a}.`;
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
    },
  });
  if (!c || c.status === "closed") return null;

  const answered = new Set(c.clarifyMessages.map((m) => m.questionKey));
  const hasCaseRecord = c.documents.some((d) => d.docKind === "case record");
  const caseUpdateIssue = c.issues.find((i) => i.issueType === "case_update_discrepancy");
  const balanceIssue = c.issues.find((i) => i.issueType === "balance_due");
  const noticeIssue = c.issues.find((i) => i.issueType === "notice_response");
  const unfiledIssue = c.issues.find((i) => i.issueType === "missing_return");
  const hasYear = c.issues.some((i) => i.taxYear);

  const questions: (ClarifyQuestion & { needed: boolean })[] = [
    {
      key: "tax_year",
      text: "Which case year (or years) does your situation involve? For example: 2024, or 2023 and 2024.",
      needed: !hasYear,
    },
    {
      key: "case_status_expected",
      text: "Let's pin down the expected case status. What did you expect USCIS to do or send next?",
      needed: Boolean(caseUpdateIssue && caseUpdateIssue.expectedCents === null),
    },
    {
      key: "case_status_received",
      text: "What status, notice, or result did USCIS actually send, and on what date?",
      needed: Boolean(caseUpdateIssue && caseUpdateIssue.receivedCents === null),
    },
    {
      key: "fee_or_balance_amount",
      text: "Does the USCIS notice list any filing fee, balance, or amount? If yes, what amount and where does it appear?",
      needed: Boolean(balanceIssue && balanceIssue.expectedCents === null && balanceIssue.differenceCents === null),
    },
    {
      key: "notice_details",
      text: "Look at your USCIS letter: what is the notice type, receipt number, notice date, and response deadline printed on it?",
      needed: Boolean(noticeIssue),
    },
    {
      key: "missing_filings",
      text: "Which immigration forms or evidence packets are missing, pending, or not yet filed?",
      needed: Boolean(unfiledIssue),
    },
    {
      key: "have_case_record",
      text: "Do you have your USCIS receipt notice, online case status, or account record? Answer: yes / no / I need help getting it.",
      needed: !hasCaseRecord,
    },
    {
      key: "anything_else",
      text: "Last one: anything else we should know? Prior filings, notices, deadlines, address changes, travel, arrests, or life events that may affect the case.",
      needed: true,
    },
  ];

  for (const q of questions) {
    if (q.needed && !answered.has(q.key)) return { key: q.key, text: q.text };
  }
  return null;
}
