import type { PresentationContract, PresentationEvidenceStrength } from "./case-presentation-contract";
import { evidenceStrengthFromScores } from "./case-presentation-contract";
import { formatPresentationDate } from "./case-presentation-ui";

export type CaseListSummary = {
  posture: string;
  nextActionTitle: string | null;
  deadlineTitle: string | null;
  deadlineDate: string | null;
  evidenceStrength: PresentationEvidenceStrength;
  unresolvedCount: number;
  professionalReview: boolean;
  meaning: string | null;
};

export function caseListSummary(input: {
  status: string;
  actionReadinessScore?: number;
  presentation?: PresentationContract | null;
  reconstructionPosition?: string | null;
}): CaseListSummary {
  const presentation = input.presentation;
  if (presentation) {
    return {
      posture: presentation.hero.current_posture || input.status.replace(/_/g, " "),
      nextActionTitle: presentation.hero.next_best_action?.title ?? null,
      deadlineTitle: presentation.hero.nearest_deadline?.title ?? null,
      deadlineDate: presentation.hero.nearest_deadline?.due_date
        ? formatPresentationDate(presentation.hero.nearest_deadline.due_date)
        : null,
      evidenceStrength: presentation.hero.evidence_strength,
      unresolvedCount: presentation.what_this_means.unresolved_count,
      professionalReview: presentation.hero.professional_review_recommended,
      meaning: presentation.what_this_means.summary || null,
    };
  }
  return {
    posture: input.reconstructionPosition || input.status.replace(/_/g, " "),
    nextActionTitle: null,
    deadlineTitle: null,
    deadlineDate: null,
    evidenceStrength: evidenceStrengthFromScores(input.actionReadinessScore ?? 0),
    unresolvedCount: 0,
    professionalReview: input.status === "consultant_recommended",
    meaning: null,
  };
}

export function caseListActionLine(summary: CaseListSummary): string {
  const action = summary.nextActionTitle ? `Next: ${summary.nextActionTitle}` : "No action is ready yet";
  const deadline = summary.deadlineTitle
    ? `Deadline: ${summary.deadlineTitle}${summary.deadlineDate ? ` (${summary.deadlineDate})` : ""}`
    : null;
  return deadline ? `${action} · ${deadline}` : action;
}

export function caseListEvidenceLine(summary: CaseListSummary): string {
  return [
    `Evidence ${summary.evidenceStrength.toLowerCase()}`,
    summary.unresolvedCount > 0 ? `${summary.unresolvedCount} open item${summary.unresolvedCount === 1 ? "" : "s"}` : null,
    summary.professionalReview ? "Professional review recommended" : null,
  ].filter(Boolean).join(" · ");
}
