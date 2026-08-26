import {
  parseCanonicalApprovedState,
} from "./canonical-case-state";
import { parsePresentationRecord, type PresentationContract } from "./case-presentation-contract";
import type {
  CustomerFacingSnapshot,
  ReanalysisComparison,
  ReanalysisSideDiff,
} from "./admin-reanalysis-types";

export type { CustomerFacingSnapshot, ReanalysisComparison, ReanalysisSideDiff, SnapshotIssue, SnapshotPathStep, SnapshotActionNode, SnapshotPresentation } from "./admin-reanalysis-types";

export function parseCustomerFacingSnapshot(value: string | CustomerFacingSnapshot | null | undefined): CustomerFacingSnapshot | null {
  if (!value) return null;
  if (typeof value === "object") return value.case && Array.isArray(value.issues) ? value : null;
  try {
    const parsed = JSON.parse(value) as CustomerFacingSnapshot;
    if (!parsed?.case || !Array.isArray(parsed.issues)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function parseReanalysisComparison(value: string | ReanalysisComparison | null | undefined): ReanalysisComparison | null {
  if (!value) return null;
  if (typeof value === "object") return typeof value.changed === "boolean" ? value : null;
  try {
    const parsed = JSON.parse(value) as ReanalysisComparison;
    return parsed && typeof parsed.changed === "boolean" ? parsed : null;
  } catch {
    return null;
  }
}

export function presentationFromSnapshot(snapshot: CustomerFacingSnapshot | null | undefined): PresentationContract | null {
  if (!snapshot) return null;
  const approved = parseCanonicalApprovedState(snapshot.canonical?.approvedStateJson);
  if (approved?.presentation) return approved.presentation;
  if (snapshot.presentation) return parsePresentationRecord(snapshot.presentation);
  return null;
}

function sideDiff(current: string, proposed: string): ReanalysisSideDiff {
  const left = current.trim();
  const right = proposed.trim();
  return { current: left, proposed: right, changed: left !== right };
}

export function compareCustomerSnapshots(
  current: CustomerFacingSnapshot | null | undefined,
  proposed: CustomerFacingSnapshot | null | undefined,
): ReanalysisComparison {
  const currentPres = presentationFromSnapshot(current ?? null);
  const proposedPres = presentationFromSnapshot(proposed ?? null);
  const currentFindings = (currentPres?.findings ?? []).map((item) => item.title).filter(Boolean);
  const proposedFindings = (proposedPres?.findings ?? []).map((item) => item.title).filter(Boolean);
  const currentSteps = (current?.pathSteps ?? []).map((item) => item.title).filter(Boolean);
  const proposedSteps = (proposed?.pathSteps ?? []).map((item) => item.title).filter(Boolean);
  const posture = sideDiff(currentPres?.hero.current_posture ?? "", proposedPres?.hero.current_posture ?? "");
  const nextAction = sideDiff(
    currentPres?.hero.next_best_action?.title ?? "",
    proposedPres?.hero.next_best_action?.title ?? "",
  );
  const summary = sideDiff(currentPres?.what_this_means.summary ?? "", proposedPres?.what_this_means.summary ?? "");
  const status = sideDiff(current?.case.status ?? "", proposed?.case.status ?? "");
  const readiness = {
    current: current?.case.readinessScore ?? 0,
    proposed: proposed?.case.readinessScore ?? 0,
    changed: (current?.case.readinessScore ?? 0) !== (proposed?.case.readinessScore ?? 0),
  };
  const findingsAdded = proposedFindings.filter((title) => !currentFindings.includes(title));
  const findingsRemoved = currentFindings.filter((title) => !proposedFindings.includes(title));
  const stepsAdded = proposedSteps.filter((title) => !currentSteps.includes(title));
  const stepsRemoved = currentSteps.filter((title) => !proposedSteps.includes(title));
  return {
    changed:
      posture.changed ||
      nextAction.changed ||
      summary.changed ||
      status.changed ||
      readiness.changed ||
      findingsAdded.length > 0 ||
      findingsRemoved.length > 0 ||
      stepsAdded.length > 0 ||
      stepsRemoved.length > 0,
    posture,
    nextAction,
    summary,
    status,
    readiness,
    findingsAdded,
    findingsRemoved,
    stepsAdded,
    stepsRemoved,
  };
}

export function reanalysisVisibleTo(
  row: { visibleToCustomer: boolean; visibleToConsultant: boolean; status: string; overriddenAt?: Date | string | null },
  role: "customer" | "consultant" | "admin",
): boolean {
  if (row.overriddenAt) return false;
  if (!["completed", "shared"].includes(row.status)) return false;
  if (role === "admin") return true;
  if (role === "customer") return row.visibleToCustomer;
  return row.visibleToConsultant;
}
