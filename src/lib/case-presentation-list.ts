import type { PresentationContract, PresentationEvidenceStrength } from "./case-presentation-contract";
import { evidenceStrengthFromScores } from "./case-presentation-contract";
import { formatPresentationDate } from "./case-presentation-ui";
import { versionReasonLabel, type ApprovedCaseView } from "./canonical-case-state";
import type { VersionMatchInput } from "./goal-versions";

export type CaseListSummary = {
  posture: string;
  nextActionTitle: string | null;
  deadlineTitle: string | null;
  deadlineDate: string | null;
  evidenceStrength: PresentationEvidenceStrength;
  unresolvedCount: number;
  professionalReview: boolean;
  meaning: string | null;
  version: number | null;
  reasonLabel: string | null;
};

export function caseListSummary(input: {
  status: string;
  actionReadinessScore?: number;
  presentation?: PresentationContract | null;
  reconstructionPosition?: string | null;
  version?: number | null;
  reasonLabel?: string | null;
}): CaseListSummary {
  const presentation = input.presentation;
  const version = input.version ?? null;
  const reasonLabel = input.reasonLabel ?? null;
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
      version,
      reasonLabel,
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
    version,
    reasonLabel,
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

export function caseListVersionLine(summary: CaseListSummary): string | null {
  if (!summary.version) return null;
  return summary.reasonLabel ? `Version ${summary.version} · ${summary.reasonLabel}` : `Version ${summary.version}`;
}

export function caseListSummaryFromView(
  input: {
    status: string;
    actionReadinessScore?: number;
    reconstructionPosition?: string | null;
  },
  view?: ApprovedCaseView | null,
  match?: VersionMatchInput,
): CaseListSummary {
  return caseListSummary({
    status: input.status,
    actionReadinessScore: input.actionReadinessScore,
    presentation: view?.presentation ?? null,
    reconstructionPosition: view?.presentation ? undefined : input.reconstructionPosition,
    version: view?.version ?? null,
    reasonLabel: view?.reason ? versionReasonLabel(view.reason, match) : null,
  });
}
