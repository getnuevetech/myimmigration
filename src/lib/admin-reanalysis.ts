import "server-only";
import { db } from "./db";
import {
  parseCanonicalApprovedState,
  type CanonicalApprovedState,
} from "./canonical-case-state";
import { ensureCaseVersion, finalizeCaseVersion } from "./case-versioning";
import {
  compareCustomerSnapshots,
  parseCustomerFacingSnapshot,
  presentationFromSnapshot,
  reanalysisVisibleTo,
} from "./admin-reanalysis-compare";
import type { CustomerFacingSnapshot, SnapshotActionNode, SnapshotIssue, SnapshotPathStep } from "./admin-reanalysis-types";

export const REANALYSIS_STATUSES = ["pending", "running", "completed", "failed", "shared", "overridden"] as const;
export type ReanalysisStatus = (typeof REANALYSIS_STATUSES)[number];

export {
  compareCustomerSnapshots,
  parseCustomerFacingSnapshot,
  parseReanalysisComparison,
  presentationFromSnapshot,
  reanalysisVisibleTo,
} from "./admin-reanalysis-compare";
export type {
  CustomerFacingSnapshot,
  ReanalysisComparison,
  ReanalysisSideDiff,
  SnapshotActionNode,
  SnapshotIssue,
  SnapshotPathStep,
  SnapshotPresentation,
} from "./admin-reanalysis-types";

export async function captureCustomerFacingSnapshot(caseId: string): Promise<CustomerFacingSnapshot> {
  const [c, presentations, latestVersion] = await Promise.all([
    db.case.findUnique({
      where: { id: caseId },
      select: {
        status: true,
        readinessScore: true,
        evidenceAvailableScore: true,
        evidenceProcessedScore: true,
        actionReadinessScore: true,
        conflictsJson: true,
        issues: { orderBy: { createdAt: "asc" } },
        pathSteps: { orderBy: { sortOrder: "asc" } },
        actionNodes: { orderBy: [{ priority: "asc" }, { createdAt: "asc" }] },
        reconstruction: true,
        canonicalState: true,
      },
    }),
    db.casePresentation.findMany({
      where: { caseId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        versionId: true,
        heroJson: true,
        whatThisMeansJson: true,
        timelineJson: true,
        findingsJson: true,
        deadlinesJson: true,
        actionsJson: true,
        evidenceJson: true,
        professionalReviewJson: true,
      },
    }),
    db.caseVersion.findFirst({
      where: { caseId },
      orderBy: { version: "desc" },
      select: { id: true, status: true, reason: true, completedAt: true },
    }),
  ]);
  if (!c) {
    return {
      capturedAt: new Date().toISOString(),
      case: {
        status: "intake",
        readinessScore: 0,
        evidenceAvailableScore: 0,
        evidenceProcessedScore: 0,
        actionReadinessScore: 0,
        conflictsJson: "[]",
      },
      issues: [],
      pathSteps: [],
      actionNodes: [],
      reconstruction: null,
      canonical: null,
      presentation: null,
      presentationIds: [],
      latestVersion: null,
    };
  }
  return {
    capturedAt: new Date().toISOString(),
    case: {
      status: c.status,
      readinessScore: c.readinessScore,
      evidenceAvailableScore: c.evidenceAvailableScore,
      evidenceProcessedScore: c.evidenceProcessedScore,
      actionReadinessScore: c.actionReadinessScore,
      conflictsJson: c.conflictsJson,
    },
    issues: c.issues.map((issue) => ({
      id: issue.id,
      issueType: issue.issueType,
      caseYear: issue.caseYear,
      title: issue.title,
      description: issue.description,
      expectedCents: issue.expectedCents,
      receivedCents: issue.receivedCents,
      differenceCents: issue.differenceCents,
      confidence: issue.confidence,
      priority: issue.priority,
      state: issue.state,
      nextAction: issue.nextAction,
      uscisBasis: issue.uscisBasis,
      evidenceJson: issue.evidenceJson,
      itemKind: issue.itemKind,
      evidenceStatus: issue.evidenceStatus,
      evidenceStrength: issue.evidenceStrength,
      conclusion: issue.conclusion,
      unclearJson: issue.unclearJson,
      explanationsJson: issue.explanationsJson,
      altAction: issue.altAction,
    })),
    pathSteps: c.pathSteps.map((step) => ({
      id: step.id,
      sortOrder: step.sortOrder,
      title: step.title,
      description: step.description,
      actionKey: step.actionKey,
      status: step.status,
    })),
    actionNodes: c.actionNodes.map((node) => ({
      id: node.id,
      actionKey: node.actionKey,
      title: node.title,
      description: node.description,
      priority: node.priority,
      dependsOnJson: node.dependsOnJson,
      resolvesJson: node.resolvesJson,
      requiresJson: node.requiresJson,
      status: node.status,
      sourceFindingIdsJson: node.sourceFindingIdsJson,
    })),
    reconstruction: c.reconstruction
      ? {
          summary: c.reconstruction.summary,
          currentPosition: c.reconstruction.currentPosition,
          timelineJson: c.reconstruction.timelineJson,
          pendingActionsJson: c.reconstruction.pendingActionsJson,
          confidence: c.reconstruction.confidence,
        }
      : null,
    canonical: c.canonicalState
      ? {
          approvedStateJson: c.canonicalState.approvedStateJson,
          stateJson: c.canonicalState.stateJson,
          versionId: c.canonicalState.versionId,
          evidenceSnapshotHash: c.canonicalState.evidenceSnapshotHash,
        }
      : null,
    presentation: presentations[0] ?? null,
    presentationIds: presentations.map((row) => row.id),
    latestVersion: latestVersion
      ? {
          id: latestVersion.id,
          status: latestVersion.status,
          reason: latestVersion.reason,
          completedAt: latestVersion.completedAt ? latestVersion.completedAt.toISOString() : null,
        }
      : null,
  };
}

async function replaceIssues(caseId: string, issues: SnapshotIssue[]) {
  await db.issue.deleteMany({ where: { caseId } });
  if (issues.length === 0) return;
  await db.issue.createMany({
    data: issues.map((issue) => ({
      id: issue.id,
      caseId,
      issueType: issue.issueType,
      caseYear: issue.caseYear,
      title: issue.title,
      description: issue.description,
      expectedCents: issue.expectedCents,
      receivedCents: issue.receivedCents,
      differenceCents: issue.differenceCents,
      confidence: issue.confidence,
      priority: issue.priority,
      state: issue.state,
      nextAction: issue.nextAction,
      uscisBasis: issue.uscisBasis,
      evidenceJson: issue.evidenceJson,
      itemKind: issue.itemKind,
      evidenceStatus: issue.evidenceStatus,
      evidenceStrength: issue.evidenceStrength,
      conclusion: issue.conclusion,
      unclearJson: issue.unclearJson,
      explanationsJson: issue.explanationsJson,
      altAction: issue.altAction,
    })),
  });
}

async function replacePathSteps(caseId: string, steps: SnapshotPathStep[]) {
  await db.pathStep.deleteMany({ where: { caseId } });
  if (steps.length === 0) return;
  await db.pathStep.createMany({
    data: steps.map((step) => ({
      id: step.id,
      caseId,
      sortOrder: step.sortOrder,
      title: step.title,
      description: step.description,
      actionKey: step.actionKey,
      status: step.status,
    })),
  });
}

async function replaceActionNodes(caseId: string, nodes: SnapshotActionNode[]) {
  await db.caseActionNode.deleteMany({ where: { caseId } });
  if (nodes.length === 0) return;
  await db.caseActionNode.createMany({
    data: nodes.map((node) => ({
      id: node.id,
      caseId,
      actionKey: node.actionKey,
      title: node.title,
      description: node.description,
      priority: node.priority,
      dependsOnJson: node.dependsOnJson,
      resolvesJson: node.resolvesJson,
      requiresJson: node.requiresJson,
      status: node.status,
      sourceFindingIdsJson: node.sourceFindingIdsJson,
    })),
  });
}

async function restoreReconstruction(caseId: string, reconstruction: CustomerFacingSnapshot["reconstruction"]) {
  if (!reconstruction) return;
  await db.caseReconstruction.upsert({
    where: { caseId },
    update: reconstruction,
    create: { caseId, ...reconstruction },
  });
}

export async function restoreCustomerFacingSnapshot(caseId: string, snapshot: CustomerFacingSnapshot): Promise<void> {
  await db.case.update({
    where: { id: caseId },
    data: {
      status: snapshot.case.status,
      readinessScore: snapshot.case.readinessScore,
      evidenceAvailableScore: snapshot.case.evidenceAvailableScore,
      evidenceProcessedScore: snapshot.case.evidenceProcessedScore,
      actionReadinessScore: snapshot.case.actionReadinessScore,
      conflictsJson: snapshot.case.conflictsJson,
    },
  });
  await replaceIssues(caseId, snapshot.issues);
  await replacePathSteps(caseId, snapshot.pathSteps);
  await replaceActionNodes(caseId, snapshot.actionNodes);
  await restoreReconstruction(caseId, snapshot.reconstruction);
  if (snapshot.presentationIds.length > 0) {
    await db.casePresentation.deleteMany({
      where: { caseId, id: { notIn: snapshot.presentationIds } },
    });
  } else {
    await db.casePresentation.deleteMany({ where: { caseId } });
  }
  if (snapshot.canonical) {
    await db.canonicalCaseState.upsert({
      where: { caseId },
      update: {
        approvedStateJson: snapshot.canonical.approvedStateJson,
        stateJson: snapshot.canonical.stateJson,
        versionId: snapshot.canonical.versionId,
        evidenceSnapshotHash: snapshot.canonical.evidenceSnapshotHash,
      },
      create: {
        caseId,
        approvedStateJson: snapshot.canonical.approvedStateJson,
        stateJson: snapshot.canonical.stateJson,
        versionId: snapshot.canonical.versionId,
        evidenceSnapshotHash: snapshot.canonical.evidenceSnapshotHash,
      },
    });
  }
  if (snapshot.latestVersion) {
    await db.caseVersion.update({
      where: { id: snapshot.latestVersion.id },
      data: {
        status: snapshot.latestVersion.status,
        reason: snapshot.latestVersion.reason,
        completedAt: snapshot.latestVersion.completedAt ? new Date(snapshot.latestVersion.completedAt) : null,
      },
    }).catch(() => null);
  }
}

export async function overrideCustomerOutputWithSnapshot(caseId: string, snapshot: CustomerFacingSnapshot): Promise<void> {
  await db.case.update({
    where: { id: caseId },
    data: {
      status: snapshot.case.status === "analyzing" ? "analyzed" : snapshot.case.status,
      readinessScore: snapshot.case.readinessScore,
      evidenceAvailableScore: snapshot.case.evidenceAvailableScore,
      evidenceProcessedScore: snapshot.case.evidenceProcessedScore,
      actionReadinessScore: snapshot.case.actionReadinessScore,
      conflictsJson: snapshot.case.conflictsJson,
    },
  });
  await replaceIssues(caseId, snapshot.issues);
  await replacePathSteps(caseId, snapshot.pathSteps);
  await replaceActionNodes(caseId, snapshot.actionNodes);
  await restoreReconstruction(caseId, snapshot.reconstruction);
  if (snapshot.presentation) {
    await db.casePresentation.create({
      data: {
        caseId,
        heroJson: snapshot.presentation.heroJson,
        whatThisMeansJson: snapshot.presentation.whatThisMeansJson,
        timelineJson: snapshot.presentation.timelineJson,
        findingsJson: snapshot.presentation.findingsJson,
        deadlinesJson: snapshot.presentation.deadlinesJson,
        actionsJson: snapshot.presentation.actionsJson,
        evidenceJson: snapshot.presentation.evidenceJson,
        professionalReviewJson: snapshot.presentation.professionalReviewJson,
      },
    });
  }
  const approved = parseCanonicalApprovedState(snapshot.canonical?.approvedStateJson);
  const presentation = presentationFromSnapshot(snapshot);
  const version = await ensureCaseVersion(caseId, "admin_override");
  const approvedState: CanonicalApprovedState = {
    version: version.version,
    reason: "admin_override",
    pipeline_config_version: version.pipelineConfigVersion,
    evidence_snapshot_hash: snapshot.canonical?.evidenceSnapshotHash ?? "",
    status: snapshot.case.status === "analyzing" ? "analyzed" : snapshot.case.status,
    readiness_score: snapshot.case.readinessScore,
    evidence_available_score: snapshot.case.evidenceAvailableScore,
    evidence_processed_score: snapshot.case.evidenceProcessedScore,
    action_readiness_score: snapshot.case.actionReadinessScore,
    presentation,
    analysis_plan: approved?.analysis_plan ?? null,
  };
  await finalizeCaseVersion(version.id, caseId, approvedState);
}

export async function getRunningReanalysis(caseId: string) {
  return db.adminCaseReanalysis.findFirst({
    where: { caseId, status: { in: ["pending", "running"] } },
    orderBy: { createdAt: "desc" },
  });
}

export async function getSharedReanalysisForViewer(caseId: string, role: "customer" | "consultant" | "admin") {
  const rows = await db.adminCaseReanalysis.findMany({
    where: { caseId, status: { in: ["completed", "shared"] }, overriddenAt: null },
    orderBy: { createdAt: "desc" },
    take: 8,
  });
  return rows.find((row) => reanalysisVisibleTo(row, role)) ?? null;
}

export async function runAdminDraftReanalysis(reanalysisId: string): Promise<void> {
  const row = await db.adminCaseReanalysis.findUnique({ where: { id: reanalysisId } });
  if (!row) return;
  const current = await captureCustomerFacingSnapshot(row.caseId);
  await db.adminCaseReanalysis.update({
    where: { id: reanalysisId },
    data: { status: "running", currentSnapshotJson: JSON.stringify(current), error: "" },
  });
  let providerIds: string[] = [];
  try {
    const parsed = JSON.parse(row.providerIdsJson || "[]");
    if (Array.isArray(parsed)) providerIds = parsed.map(String).filter(Boolean);
  } catch {
    providerIds = [];
  }
  try {
    const { runCaseAnalysis } = await import("./ai/orchestrator");
    await runCaseAnalysis(row.caseId, { persistMode: "draft", providerIds });
    const proposed = await captureCustomerFacingSnapshot(row.caseId);
    await restoreCustomerFacingSnapshot(row.caseId, current);
    const comparison = compareCustomerSnapshots(current, proposed);
    await db.adminCaseReanalysis.update({
      where: { id: reanalysisId },
      data: {
        status: "completed",
        proposedSnapshotJson: JSON.stringify(proposed),
        comparisonJson: JSON.stringify(comparison),
      },
    });
  } catch (err) {
    await restoreCustomerFacingSnapshot(row.caseId, current).catch(() => null);
    await db.adminCaseReanalysis.update({
      where: { id: reanalysisId },
      data: { status: "failed", error: String(err).slice(0, 2000) },
    });
    throw err;
  }
}
