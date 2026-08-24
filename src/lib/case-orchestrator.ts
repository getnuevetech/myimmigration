import "server-only";
import { db } from "./db";
import { buildAnalysisPlan, parseAnalysisPlan, type AnalysisPlan } from "./case-analysis-plan";

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

  const plan = buildAnalysisPlan({
    caseStatus: c.status,
    documentCount: c.documents.length,
    documents: c.documents,
    issues: c.issues,
    unknowns: c.unknowns,
    evidenceAuditStatus: c.evidenceAudits[0]?.status ?? null,
    evidenceFactKeys: c.evidenceFacts.map((fact) => fact.key),
    situation: c.situation,
    goal: c.goal,
  });

  return db.caseAnalysisPlan.create({
    data: {
      caseId,
      versionId: versionId ?? null,
      complexity: plan.case_complexity,
      reasoningLevel: plan.reasoning_level,
      reviewRequired: plan.review_required,
      humanReviewRequired: plan.human_review_required,
      planJson: JSON.stringify(plan),
      status: "planned",
    },
  });
}

export async function markAnalysisPlanRunning(planId: string) {
  return db.caseAnalysisPlan.update({ where: { id: planId }, data: { status: "running" } });
}

export async function finishAnalysisPlan(planId: string, plan: AnalysisPlan, status: "complete" | "skipped" | "blocked") {
  return db.caseAnalysisPlan.update({
    where: { id: planId },
    data: { status, planJson: JSON.stringify(plan) },
  });
}

export function planFromRecord(planJson: string): AnalysisPlan | null {
  return parseAnalysisPlan(planJson);
}
