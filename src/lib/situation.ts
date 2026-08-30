import { formatCaseNumber } from "@/lib/case-number";

/** Customer-facing Situation reference — never labeled as a Case IMM- id. */
export function formatSituationNumber(n: number): string {
  return `SIT-${String(n).padStart(6, "0")}`;
}

export function situationTitleFromNarrative(narrative: string, explicitQuestion?: string): string {
  const q = (explicitQuestion || "").trim();
  if (q) return q.slice(0, 80);
  return narrative.trim().slice(0, 80) || "Immigration situation";
}

/** Prefer Situation number in chrome; never present as IMM Case for Situations. */
export function situationRefLabel(number: number): string {
  return `Situation ${formatSituationNumber(number)}`;
}

export function legacyCaseRefForAudit(caseNumber: number): string {
  return formatCaseNumber(caseNumber);
}
