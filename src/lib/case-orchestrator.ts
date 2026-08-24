import "server-only";
import { db } from "./db";

type AnalysisPlan = {
  case_complexity: "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
  tasks_required: string[];
  tasks_skipped: { task: string; reason: string }[];
  documents_to_process: string[];
  deterministic_tools: string[];
  authority_queries_needed: string[];
  reasoning_level: "DIRECT" | "VERIFIED" | "HIGH_RISK";
  review_required: boolean;
  human_review_required: boolean;
  questions_may_be_needed: boolean;
  blocking_conditions: string[];
  stop_conditions: string[];
};

function uniq(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

export async function createCaseAnalysisPlan(caseId: string, versionId?: string | null) {
  const c = await db.case.findUnique({
    where: { id: caseId },
    include: {
      documents: { where: { deletedAt: null }, select: { id: true, processingStatus: true, documentType: true } },
      issues: { select: { priority: true, issueType: true, state: true } },
      unknowns: { where: { status: "open" }, select: { key: true } },
      evidenceAudits: { orderBy: { createdAt: "desc" }, take: 1 },
      evidenceFacts: { select: { key: true }, take: 50 },
    },
  });
  if (!c) return null;

  const latestAudit = c.evidenceAudits[0] ?? null;
  const docsToProcess = c.documents
    .filter((doc) => ["uploaded", "failed"].includes(doc.processingStatus))
    .map((doc) => doc.id);
  const highRiskIssue = c.issues.some((issue) =>
    issue.priority === "urgent" ||
    ["professional_review", "deadline_tracking", "uscis_notice_response"].includes(issue.issueType),
  );
  const needsReview = latestAudit?.status === "needs_review" || latestAudit?.status === "blocked" || highRiskIssue;
  const humanReview = latestAudit?.status === "blocked" || c.issues.some((issue) => issue.issueType === "professional_review");
  const complexity: AnalysisPlan["case_complexity"] =
    humanReview ? "CRITICAL" : needsReview ? "HIGH" : c.unknowns.length > 0 || c.documents.length > 2 ? "MODERATE" : "LOW";
  const reasoningLevel: AnalysisPlan["reasoning_level"] =
    humanReview ? "HIGH_RISK" : needsReview || c.unknowns.length > 0 ? "VERIFIED" : "DIRECT";

  const plan: AnalysisPlan = {
    case_complexity: complexity,
    tasks_required: uniq([
      docsToProcess.length ? "PROCESS_DOCUMENTS" : "",
      "RECONSTRUCT_CASE",
      "RETRIEVE_AUTHORITY",
      "PRIMARY_REASONING",
      needsReview ? "INDEPENDENT_REVIEW" : "",
      c.unknowns.length ? "QUESTION_PLANNING" : "",
      "PRESENT_APPROVED_STATE",
    ]),
    tasks_skipped: [
      ...(docsToProcess.length ? [] : [{ task: "PROCESS_DOCUMENTS", reason: "No stale or failed documents require processing." }]),
      ...(needsReview ? [] : [{ task: "INDEPENDENT_REVIEW", reason: "No high-risk issue, audit block, or material conflict detected." }]),
    ],
    documents_to_process: docsToProcess,
    deterministic_tools: uniq(["EVIDENCE_RECONCILIATION", "READINESS_SPLIT", c.issues.length ? "ACTION_GRAPH" : ""]),
    authority_queries_needed: uniq(c.evidenceFacts.map((fact) => fact.key).filter((key) => ["form_type", "notice_type", "response_deadline"].includes(key))),
    reasoning_level: reasoningLevel,
    review_required: needsReview,
    human_review_required: humanReview,
    questions_may_be_needed: c.unknowns.length > 0,
    blocking_conditions: latestAudit?.status === "blocked" ? ["Evidence audit is blocked."] : [],
    stop_conditions: c.status === "closed" ? ["Case is closed."] : [],
  };

  return db.caseAnalysisPlan.create({
    data: {
      caseId,
      versionId: versionId ?? null,
      complexity,
      reasoningLevel,
      reviewRequired: needsReview,
      humanReviewRequired: humanReview,
      planJson: JSON.stringify(plan),
      status: "planned",
    },
  });
}
