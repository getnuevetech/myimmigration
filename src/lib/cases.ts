import { Prisma, IssueSeverity } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { CaseAnalysis, CaseGoal, PersistedCaseResponse } from "@/types/case";
import { getCaseAccess } from "@/lib/subscriptions";

const CASE_WITH_LATEST_ANALYSIS = {
  analysisRuns: {
    orderBy: { createdAt: "desc" as const },
    take: 1,
  },
} satisfies Prisma.CaseInclude;

function createCaseTitle(narrative: string) {
  const normalized = narrative.replace(/\s+/g, " ").trim();
  return normalized.length > 80 ? `${normalized.slice(0, 77)}...` : normalized;
}

function parseAnalysis(value: string | null | undefined): CaseAnalysis | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as CaseAnalysis;
  } catch {
    return null;
  }
}

function buildIssues(analysis: CaseAnalysis) {
  const findingIssues = analysis.findings
    .filter((finding) => finding.status === "warning" || finding.status === "critical")
    .map((finding) => ({
      label: finding.label,
      detail: finding.detail,
      severity:
        finding.status === "critical" ? IssueSeverity.CRITICAL : IssueSeverity.WARNING,
    }));

  const inconsistencyIssues = analysis.inconsistencies.map((item) => ({
    label: `${item.field} mismatch`,
    detail: `Narrative: ${item.narrativeSays}. Documents: ${item.documentSays}.`,
    severity:
      item.severity === "critical" ? IssueSeverity.CRITICAL : IssueSeverity.WARNING,
  }));

  return [...findingIssues, ...inconsistencyIssues];
}

export async function upsertGuestCaseDraft(params: {
  caseId?: string | null;
  guestSessionId: string;
  narrative: string;
  goals: CaseGoal[];
  userId?: string | null;
}) {
  const payload = {
    title: createCaseTitle(params.narrative),
    narrative: params.narrative,
    goalsJson: JSON.stringify(params.goals),
    guestSessionId: params.guestSessionId,
    userId: params.userId ?? null,
  };

  const existing =
    params.caseId &&
    (await prisma.case.findFirst({
      where: {
        id: params.caseId,
        guestSessionId: params.guestSessionId,
      },
    }));

  const record = existing
    ? await prisma.case.update({
        where: { id: existing.id },
        data: payload,
      })
    : await prisma.case.create({
        data: payload,
      });

  await prisma.guestSession.update({
    where: { id: params.guestSessionId },
    data: {
      linkedUserId: params.userId ?? undefined,
      caseDraftJson: JSON.stringify({
        caseId: record.id,
        narrative: params.narrative,
        goals: params.goals,
      }),
    },
  });

  return record;
}

export async function saveAnalysisForCase(params: {
  caseId: string;
  userId?: string | null;
  documents: { name: string; text: string }[];
  analysis: CaseAnalysis;
}) {
  const run = await prisma.analysisRun.create({
    data: {
      caseId: params.caseId,
      initiatedByUserId: params.userId ?? null,
      status: "RUNNING",
    },
  });

  await prisma.document.deleteMany({
    where: { caseId: params.caseId },
  });

  if (params.documents.length > 0) {
    await prisma.document.createMany({
      data: params.documents.map((document) => ({
        caseId: params.caseId,
        userId: params.userId ?? null,
        fileName: document.name,
        storagePath: `guest-case/${params.caseId}/${document.name}`,
        extractedText: document.text,
      })),
    });
  }

  await prisma.issue.deleteMany({
    where: { caseId: params.caseId },
  });

  const issues = buildIssues(params.analysis);
  if (issues.length > 0) {
    await prisma.issue.createMany({
      data: issues.map((issue) => ({
        caseId: params.caseId,
        label: issue.label,
        detail: issue.detail,
        severity: issue.severity,
      })),
    });
  }

  const summaryResultJson = JSON.stringify({
    currentSituation: params.analysis.currentSituation,
    importantFindings: params.analysis.importantFindings,
  });

  await prisma.analysisRun.update({
    where: { id: run.id },
    data: {
      status: "COMPLETE",
      summaryResultJson,
      presentationJson: JSON.stringify(params.analysis),
      verificationJson: JSON.stringify({
        majorIssues: params.analysis.majorIssues,
        inconsistencies: params.analysis.inconsistencies.length,
      }),
    },
  });

  await prisma.case.update({
    where: { id: params.caseId },
    data: {
      summary: params.analysis.currentSituation,
      status: params.analysis.majorIssues > 0 ? "REVIEW_REQUIRED" : "COMPLETE",
    },
  });

  return run.id;
}

export async function claimGuestCasesForUser(guestSessionId: string, userId: string) {
  const cases = await prisma.case.findMany({
    where: { guestSessionId },
    select: { id: true },
  });
  const caseIds = cases.map((item) => item.id);

  await prisma.case.updateMany({
    where: {
      guestSessionId,
      userId: null,
    },
    data: { userId },
  });

  await prisma.document.updateMany({
    where: {
      caseId: { in: caseIds },
      userId: null,
    },
    data: { userId },
  });

  await prisma.analysisRun.updateMany({
    where: {
      caseId: { in: caseIds },
      initiatedByUserId: null,
    },
    data: { initiatedByUserId: userId },
  });
}

export async function getPersistedCase(params: {
  caseId: string;
  guestSessionId: string;
  userId?: string | null;
}): Promise<PersistedCaseResponse | null> {
  const record = await prisma.case.findFirst({
    where: {
      id: params.caseId,
      OR: [
        { guestSessionId: params.guestSessionId },
        ...(params.userId ? [{ userId: params.userId }] : []),
      ],
    },
    include: CASE_WITH_LATEST_ANALYSIS,
  });

  if (!record) {
    return null;
  }

  const latestRun = record.analysisRuns[0];
  const analysis = parseAnalysis(latestRun?.presentationJson);
  const access = await getCaseAccess(record.userId);

  return {
    caseId: record.id,
    analysis,
    access,
  };
}
