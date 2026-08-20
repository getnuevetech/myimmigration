import type { ReconciledEvidenceState } from "./reconcile";

export type EvidenceReadinessInput = {
  documentsCount: number;
  documentsExpected: number;
  extractedDocumentsCount: number;
  needsReviewDocumentsCount: number;
  reconciled: Pick<ReconciledEvidenceState, "audit" | "facts" | "unknowns" | "conflicts">;
};

export type EvidenceReadinessSplit = {
  evidenceAvailableScore: number;
  evidenceProcessedScore: number;
  actionReadinessScore: number;
};

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function computeEvidenceReadinessSplit(input: EvidenceReadinessInput): EvidenceReadinessSplit {
  const expected = Math.max(input.documentsExpected, 1);
  const evidenceAvailableScore = clampScore((input.documentsCount / expected) * 100);
  const processableDocuments = Math.max(input.documentsCount, 1);
  const processedWeight = input.extractedDocumentsCount + input.needsReviewDocumentsCount * 0.35;
  const evidenceProcessedScore = input.documentsCount === 0 ? 0 : clampScore((processedWeight / processableDocuments) * 100);

  const coreFactKeys = new Set(input.reconciled.facts.map((fact) => fact.key));
  const coreReadinessKeys = ["receipt_number", "form_type", "notice_type"] as const;
  const coreFactScore = coreReadinessKeys.filter((key) => coreFactKeys.has(key)).length * (30 / 3);
  const auditBase =
    input.reconciled.audit.status === "pass"
      ? 50
      : input.reconciled.audit.status === "needs_more_evidence"
        ? 32
        : input.reconciled.audit.status === "needs_review"
          ? 22
          : 10;
  const unknownPenalty = input.reconciled.unknowns.length * 7;
  const conflictPenalty = input.reconciled.conflicts.length * 12;
  const actionReadinessScore = clampScore(auditBase + coreFactScore + evidenceProcessedScore * 0.2 - unknownPenalty - conflictPenalty);

  return {
    evidenceAvailableScore,
    evidenceProcessedScore,
    actionReadinessScore,
  };
}
