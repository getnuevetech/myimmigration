import "server-only";
import { db } from "./db";
import { assemblePresentationContract } from "./case-presentation-contract";

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value || "") as T;
  } catch {
    return fallback;
  }
}

export async function buildCasePresentation(caseId: string, versionId?: string | null) {
  const c = await db.case.findUnique({
    where: { id: caseId },
    include: {
      reconstruction: true,
      issues: { orderBy: [{ priority: "asc" }, { createdAt: "asc" }] },
      deadlines: { where: { status: "open" }, orderBy: { dueDate: "asc" }, take: 5 },
      documents: { where: { deletedAt: null }, take: 20 },
      actionNodes: { orderBy: [{ priority: "asc" }, { createdAt: "asc" }] },
      unknowns: { orderBy: { createdAt: "asc" }, take: 8 },
      evidenceAudits: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!c) return null;

  const contract = assemblePresentationContract({
    status: c.status,
    actionReadinessScore: c.actionReadinessScore,
    reconstruction: c.reconstruction
      ? {
          currentPosition: c.reconstruction.currentPosition,
          summary: c.reconstruction.summary,
          timeline: parseJson(c.reconstruction.timelineJson, []),
          pendingActions: parseJson(c.reconstruction.pendingActionsJson, []),
        }
      : null,
    issues: c.issues,
    deadlines: c.deadlines,
    actionNodes: c.actionNodes,
    documents: c.documents,
    unknowns: c.unknowns,
    evidenceGateStatus: c.evidenceAudits[0]?.status ?? null,
    conflicts: parseJson(c.conflictsJson, []),
  });

  return db.casePresentation.create({
    data: {
      caseId,
      versionId: versionId ?? null,
      heroJson: JSON.stringify(contract.hero),
      whatThisMeansJson: JSON.stringify(contract.what_this_means),
      timelineJson: JSON.stringify(contract.timeline),
      findingsJson: JSON.stringify(contract.findings),
      deadlinesJson: JSON.stringify(contract.deadlines),
      actionsJson: JSON.stringify(contract.actions),
      evidenceJson: JSON.stringify(contract.evidence),
      professionalReviewJson: JSON.stringify(contract.professional_review),
    },
  });
}

export async function getLatestCasePresentation(caseId: string) {
  return db.casePresentation.findFirst({
    where: { caseId },
    orderBy: { createdAt: "desc" },
  });
}
