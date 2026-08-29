import "server-only";
import { db } from "@/lib/db";
import type { ApprovalGateAudit } from "@/lib/approval-gate";

export async function persistApprovalGateAudit(input: {
  caseId: string;
  versionId?: string | null;
  logicalAnalysisId?: string | null;
  audit: ApprovalGateAudit;
}) {
  const audit = {
    ...input.audit,
    case_id: input.caseId,
    case_version_id: input.versionId ?? input.audit.case_version_id,
    logical_analysis_id: input.logicalAnalysisId ?? input.audit.logical_analysis_id,
  };
  const row = await db.caseApprovalGateAudit.create({
    data: {
      caseId: input.caseId,
      versionId: input.versionId ?? null,
      logicalAnalysisId: input.logicalAnalysisId ?? null,
      gateResult: audit.gate_result,
      ruleIdsJson: JSON.stringify(audit.rule_ids),
      reasonsJson: JSON.stringify(audit.reasons),
      blocksJson: JSON.stringify(audit.blocks),
      warningsJson: JSON.stringify(audit.warnings),
      auditJson: JSON.stringify(audit),
      overrideBy: audit.override_by ?? "",
      overrideReason: audit.override_reason ?? "",
      overrideAt: audit.override_time ? new Date(audit.override_time) : null,
      previousGateResult: audit.previous_gate_result ?? "",
    },
  });
  await db.canonicalCaseState.upsert({
    where: { caseId: input.caseId },
    update: { gateResultJson: JSON.stringify(audit) },
    create: { caseId: input.caseId, gateResultJson: JSON.stringify(audit) },
  }).catch(() => null);
  return { row, audit };
}

export async function latestApprovalGateAudit(caseId: string): Promise<ApprovalGateAudit | null> {
  const row = await db.caseApprovalGateAudit.findFirst({
    where: { caseId },
    orderBy: { createdAt: "desc" },
  });
  if (!row) {
    const canonical = await db.canonicalCaseState.findUnique({
      where: { caseId },
      select: { gateResultJson: true },
    });
    if (!canonical?.gateResultJson || canonical.gateResultJson === "{}") return null;
    try {
      return JSON.parse(canonical.gateResultJson) as ApprovalGateAudit;
    } catch {
      return null;
    }
  }
  try {
    return JSON.parse(row.auditJson) as ApprovalGateAudit;
  } catch {
    return null;
  }
}
