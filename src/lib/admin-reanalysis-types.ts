import type { PresentationContract } from "./case-presentation-contract";

export type SnapshotIssue = {
  id: string;
  issueType: string;
  caseYear: number | null;
  title: string;
  description: string;
  expectedCents: number | null;
  receivedCents: number | null;
  differenceCents: number | null;
  confidence: string;
  priority: string;
  state: string;
  nextAction: string;
  uscisBasis: string;
  evidenceJson: string;
  itemKind: string;
  evidenceStatus: string;
  evidenceStrength: string;
  conclusion: string;
  unclearJson: string;
  explanationsJson: string;
  altAction: string;
};

export type SnapshotPathStep = {
  id: string;
  sortOrder: number;
  title: string;
  description: string;
  actionKey: string;
  status: string;
};

export type SnapshotActionNode = {
  id: string;
  actionKey: string;
  title: string;
  description: string;
  priority: number;
  dependsOnJson: string;
  resolvesJson: string;
  requiresJson: string;
  status: string;
  sourceFindingIdsJson: string;
};

export type SnapshotPresentation = {
  id: string;
  versionId: string | null;
  heroJson: string;
  whatThisMeansJson: string;
  timelineJson: string;
  findingsJson: string;
  deadlinesJson: string;
  actionsJson: string;
  evidenceJson: string;
  professionalReviewJson: string;
};

export type CustomerFacingSnapshot = {
  capturedAt: string;
  case: {
    status: string;
    readinessScore: number;
    evidenceAvailableScore: number;
    evidenceProcessedScore: number;
    actionReadinessScore: number;
    conflictsJson: string;
  };
  issues: SnapshotIssue[];
  pathSteps: SnapshotPathStep[];
  actionNodes: SnapshotActionNode[];
  reconstruction: {
    summary: string;
    currentPosition: string;
    timelineJson: string;
    pendingActionsJson: string;
    confidence: string;
    briefJson?: string;
  } | null;
  canonical: {
    approvedStateJson: string;
    stateJson: string;
    versionId: string | null;
    evidenceSnapshotHash: string;
  } | null;
  presentation: SnapshotPresentation | null;
  presentationIds: string[];
  latestVersion: { id: string; status: string; reason: string; completedAt: string | null } | null;
};

export type ReanalysisSideDiff = {
  current: string;
  proposed: string;
  changed: boolean;
};

export type ReanalysisComparison = {
  changed: boolean;
  posture: ReanalysisSideDiff;
  nextAction: ReanalysisSideDiff;
  summary: ReanalysisSideDiff;
  status: ReanalysisSideDiff;
  readiness: { current: number; proposed: number; changed: boolean };
  findingsAdded: string[];
  findingsRemoved: string[];
  stepsAdded: string[];
  stepsRemoved: string[];
};

export type { PresentationContract };
