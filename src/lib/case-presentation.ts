import "server-only";
import { db } from "./db";
import { assemblePresentationContract, parsePresentationRecord, type PresentationContract } from "./case-presentation-contract";

const CASE_PRESENTATION_INCLUDE = {
  reconstruction: true,
  issues: { orderBy: [{ priority: "asc" as const }, { createdAt: "asc" as const }] },
  deadlines: { where: { status: "open" as const }, orderBy: { dueDate: "asc" as const }, take: 5 },
  documents: { where: { deletedAt: null }, take: 20 },
  actionNodes: { orderBy: [{ priority: "asc" as const }, { createdAt: "asc" as const }] },
  unknowns: { orderBy: { createdAt: "asc" as const }, take: 8 },
  evidenceAudits: { orderBy: { createdAt: "desc" as const }, take: 1 },
};

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value || "") as T;
  } catch {
    return fallback;
  }
}

function assembleFromLoadedCase(c: {
  status: string;
  actionReadinessScore: number;
  conflictsJson: string;
  reconstruction: {
    currentPosition: string;
    summary: string;
    timelineJson: string;
    pendingActionsJson: string;
  } | null;
  issues: {
    id: string;
    title: string;
    itemKind: string;
    state: string;
    evidenceStatus: string;
    evidenceStrength: string;
    conclusion: string;
    nextAction: string;
    issueType: string;
    altAction: string;
  }[];
  deadlines: { id: string; title: string; dueDate: Date; source: string }[];
  actionNodes: { id: string; title: string; actionKey: string; status: string; priority: number }[];
  documents: { id: string; fileName: string; documentType: string | null; docKind: string; processingStatus: string }[];
  unknowns: { question: string }[];
  evidenceAudits: { status: string }[];
}): PresentationContract {
  return assemblePresentationContract({
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
}

export async function assembleLivePresentation(caseId: string) {
  const c = await db.case.findUnique({
    where: { id: caseId },
    include: CASE_PRESENTATION_INCLUDE,
  });
  if (!c) return null;
  return assembleFromLoadedCase(c);
}

export async function buildCasePresentation(caseId: string, versionId?: string | null) {
  const contract = await assembleLivePresentation(caseId);
  if (!contract) return null;

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

export async function resolveCasePresentation(caseId: string) {
  const row = await getLatestCasePresentation(caseId).catch(() => null);
  if (row) return parsePresentationRecord(row);
  return assembleLivePresentation(caseId);
}

export async function loadPresentationsByCaseIds(caseIds: string[]) {
  const map = new Map<string, PresentationContract>();
  const uniqueIds = [...new Set(caseIds.filter(Boolean))];
  if (uniqueIds.length === 0) return map;
  const rows = await db.casePresentation.findMany({
    where: { caseId: { in: uniqueIds } },
    orderBy: { createdAt: "desc" },
  }).catch(() => []);
  for (const row of rows) {
    if (!map.has(row.caseId)) map.set(row.caseId, parsePresentationRecord(row));
  }
  const missing = uniqueIds.filter((id) => !map.has(id));
  if (missing.length === 0) return map;
  const cases = await db.case.findMany({
    where: { id: { in: missing } },
    include: CASE_PRESENTATION_INCLUDE,
  }).catch(() => []);
  for (const c of cases) {
    map.set(c.id, assembleFromLoadedCase(c));
  }
  return map;
}
