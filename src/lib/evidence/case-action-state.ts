import "server-only";
import { evaluateEvidenceAction, type EvidenceActionState } from "./action-intelligence";
import { getCaseEvidenceGateBrief } from "./case-gate";

export async function getEvidenceActionState(caseId: string, actionKey: string): Promise<EvidenceActionState | null> {
  const brief = await getCaseEvidenceGateBrief(caseId);
  return evaluateEvidenceAction(actionKey, brief);
}
