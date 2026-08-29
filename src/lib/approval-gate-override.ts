import "server-only";
import { db } from "@/lib/db";
import { withGateOverride, type ApprovalGateAudit } from "@/lib/approval-gate";
import { latestApprovalGateAudit, persistApprovalGateAudit } from "@/lib/approval-gate-persist";
import { buildCanonicalApprovedState, parseCanonicalApprovedState } from "@/lib/canonical-case-state";
import { assembleLivePresentation, buildCasePresentation } from "@/lib/case-presentation";
import { ensureCaseVersion, finalizeCaseVersion } from "@/lib/case-versioning";
import { logSystem } from "@/lib/syslog";

/**
 * Staff override of an approval-gate BLOCK.
 * Records override fields (no silent override), persists a new audit row,
 * rebuilds/attaches presentation, and finalizes a new case version so
 * customers can see approved output again.
 */
export async function applyStaffApprovalGateOverride(input: {
  caseId: string;
  adminUserId: string;
  adminEmail: string;
  reason: string;
}): Promise<{ audit: ApprovalGateAudit; versionId: string }> {
  const reason = input.reason.trim();
  if (reason.length < 12) {
    throw new Error("Override reason must be at least 12 characters.");
  }

  const current = await latestApprovalGateAudit(input.caseId);
  if (!current) throw new Error("No approval-gate audit found for this case.");
  if (current.gate_result !== "BLOCK") {
    throw new Error("Only BLOCK results can be overridden.");
  }

  const overridden = withGateOverride(current, {
    overrideBy: input.adminEmail,
    overrideReason: reason,
  });

  const caseRow = await db.case.findUnique({
    where: { id: input.caseId },
    select: {
      id: true,
      status: true,
      readinessScore: true,
      evidenceAvailableScore: true,
      evidenceProcessedScore: true,
      actionReadinessScore: true,
      canonicalState: { select: { approvedStateJson: true, evidenceSnapshotHash: true } },
    },
  });
  if (!caseRow) throw new Error("Case not found.");

  const prior = parseCanonicalApprovedState(caseRow.canonicalState?.approvedStateJson);
  const presentation =
    (await assembleLivePresentation(input.caseId)) ?? prior?.presentation ?? null;
  if (!presentation) {
    throw new Error("Cannot override: no presentation available to approve. Re-run analysis first.");
  }

  const version = await ensureCaseVersion(input.caseId, "gate_override");
  await buildCasePresentation(input.caseId, version.id).catch(() => null);

  await persistApprovalGateAudit({
    caseId: input.caseId,
    versionId: version.id,
    logicalAnalysisId: overridden.logical_analysis_id,
    audit: overridden,
  });

  const status =
    caseRow.status === "consultant_recommended" || prior?.status === "consultant_recommended"
      ? "consultant_recommended"
      : "analyzed";

  await finalizeCaseVersion(
    version.id,
    input.caseId,
    buildCanonicalApprovedState({
      version: version.version,
      reason: "gate_override",
      pipelineConfigVersion: version.pipelineConfigVersion,
      evidenceSnapshotHash: caseRow.canonicalState?.evidenceSnapshotHash ?? "",
      status,
      readinessScore: caseRow.readinessScore,
      evidenceAvailableScore: caseRow.evidenceAvailableScore,
      evidenceProcessedScore: caseRow.evidenceProcessedScore,
      actionReadinessScore: caseRow.actionReadinessScore,
      presentation,
      analysisPlan: prior?.analysis_plan ?? null,
      situationBrief: prior?.situation_brief ?? null,
      approvalGate: overridden,
    }),
  );

  if (caseRow.status === "analyzing" || caseRow.status === "gate_blocked") {
    await db.case.update({
      where: { id: input.caseId },
      data: { status },
    }).catch(() => null);
  }

  await logSystem(
    "warning",
    "approval_gate",
    `Staff override BLOCK for case ${input.caseId} by ${input.adminEmail} (${input.adminUserId})`,
    reason.slice(0, 500),
  ).catch(() => null);

  return { audit: overridden, versionId: version.id };
}
