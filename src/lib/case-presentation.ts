import "server-only";
import { db } from "./db";
import { assemblePresentationContract, parsePresentationRecord, type PresentationContract } from "./case-presentation-contract";
import { buildPresentationBrief } from "./case-presentation-brief";
import { parseCanonicalApprovedState, buildApprovedCaseView, type ApprovedCaseView } from "./canonical-case-state";

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
  const view = await loadApprovedViewsByCaseIds([caseId]);
  return view.get(caseId)?.presentation ?? null;
}

export async function getCasePresentationBrief(caseId: string) {
  const contract = await resolveCasePresentation(caseId);
  if (!contract) return null;
  return { contract, ...buildPresentationBrief(contract) };
}

export async function loadApprovedViewsByCaseIds(caseIds: string[]) {
  const map = new Map<string, ApprovedCaseView>();
  const uniqueIds = [...new Set(caseIds.filter(Boolean))];
  if (uniqueIds.length === 0) return map;

  const [canonicalRows, presentationRows] = await Promise.all([
    db.canonicalCaseState.findMany({
      where: { caseId: { in: uniqueIds } },
      select: { caseId: true, approvedStateJson: true },
    }).catch(() => []),
    db.casePresentation.findMany({
      where: { caseId: { in: uniqueIds } },
      orderBy: { createdAt: "desc" },
    }).catch(() => []),
  ]);
  const canonicalByCase = new Map<string, ReturnType<typeof parseCanonicalApprovedState>>();
  for (const row of canonicalRows) {
    canonicalByCase.set(row.caseId, parseCanonicalApprovedState(row.approvedStateJson));
  }
  const storedByCase = new Map<string, ReturnType<typeof parsePresentationRecord>>();
  for (const row of presentationRows) {
    if (!storedByCase.has(row.caseId)) storedByCase.set(row.caseId, parsePresentationRecord(row));
  }

  const needsLive = uniqueIds.filter((id) => {
    const selected = buildApprovedCaseView({
      canonical: canonicalByCase.get(id),
      stored: storedByCase.get(id),
    });
    map.set(id, selected);
    return !selected.presentation;
  });
  if (needsLive.length === 0) return map;

  const cases = await db.case.findMany({
    where: { id: { in: needsLive } },
    include: CASE_PRESENTATION_INCLUDE,
  }).catch(() => []);
  for (const c of cases) {
    map.set(c.id, buildApprovedCaseView({
      canonical: canonicalByCase.get(c.id),
      stored: storedByCase.get(c.id),
      live: assembleFromLoadedCase(c),
    }));
  }
  return map;
}

export async function loadPresentationsByCaseIds(caseIds: string[]) {
  const views = await loadApprovedViewsByCaseIds(caseIds);
  const map = new Map<string, PresentationContract>();
  for (const [id, view] of views) {
    if (view.presentation) map.set(id, view.presentation);
  }
  return map;
}
