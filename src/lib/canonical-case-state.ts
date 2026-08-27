import type { PresentationContract } from "./case-presentation-contract";
import type { AnalysisPlan } from "./case-analysis-plan";
import { analysisPlanSummary } from "./case-analysis-plan";
import { resolveVersionChrome, versionReasonLabel as versionReasonLabelForSurface, FILED_VERSION_REASON_LABELS, type VersionMatchInput } from "./goal-versions";
import { parseSituationBrief, type SituationBrief } from "./situation-brief";

export type CanonicalApprovedState = {
  version: number;
  reason: string;
  pipeline_config_version: string;
  evidence_snapshot_hash: string;
  status: string;
  readiness_score: number;
  evidence_available_score: number;
  evidence_processed_score: number;
  action_readiness_score: number;
  presentation: PresentationContract | null;
  analysis_plan: AnalysisPlan | null;
  situation_brief?: SituationBrief | null;
};

export const VERSION_REASON_LABELS: Record<string, string> = FILED_VERSION_REASON_LABELS;

export function versionReasonLabel(reason: string, input?: VersionMatchInput): string {
  return versionReasonLabelForSurface(reason, input);
}

export function parseCanonicalApprovedState(value: string | CanonicalApprovedState | null | undefined): CanonicalApprovedState | null {
  if (!value) return null;
  if (typeof value === "object") {
    if (typeof value.version !== "number") return null;
    return { ...value, situation_brief: parseSituationBrief(value.situation_brief) };
  }
  try {
    const parsed = JSON.parse(value) as CanonicalApprovedState;
    if (!parsed || typeof parsed.version !== "number") return null;
    return { ...parsed, situation_brief: parseSituationBrief(parsed.situation_brief) };
  } catch {
    return null;
  }
}

export function buildCanonicalApprovedState(input: {
  version: number;
  reason: string;
  pipelineConfigVersion: string;
  evidenceSnapshotHash: string;
  status: string;
  readinessScore: number;
  evidenceAvailableScore?: number;
  evidenceProcessedScore?: number;
  actionReadinessScore?: number;
  presentation?: PresentationContract | null;
  analysisPlan?: AnalysisPlan | null;
  situationBrief?: SituationBrief | string | null;
}): CanonicalApprovedState {
  return {
    version: input.version,
    reason: input.reason,
    pipeline_config_version: input.pipelineConfigVersion,
    evidence_snapshot_hash: input.evidenceSnapshotHash,
    status: input.status,
    readiness_score: input.readinessScore,
    evidence_available_score: input.evidenceAvailableScore ?? 0,
    evidence_processed_score: input.evidenceProcessedScore ?? 0,
    action_readiness_score: input.actionReadinessScore ?? 0,
    presentation: input.presentation ?? null,
    analysis_plan: input.analysisPlan ?? null,
    situation_brief: parseSituationBrief(input.situationBrief) ?? null,
  };
}

export function canonicalStateSummary(state: CanonicalApprovedState, input?: VersionMatchInput): {
  versionLabel: string;
  reasonLabel: string;
  posture: string | null;
  nextAction: string | null;
  complexityLabel: string | null;
} {
  const planSummary = state.analysis_plan ? analysisPlanSummary(state.analysis_plan) : null;
  return {
    versionLabel: resolveVersionChrome(input).versionLabel(state.version),
    reasonLabel: versionReasonLabel(state.reason, input),
    posture: state.presentation?.hero.current_posture ?? null,
    nextAction: state.presentation?.hero.next_best_action?.title ?? null,
    complexityLabel: planSummary?.complexityLabel ?? null,
  };
}

export type ApprovedPresentationSource = "canonical" | "stored" | "live";

export type ApprovedCaseView = {
  presentation: PresentationContract | null;
  version: number | null;
  reason: string | null;
  source: ApprovedPresentationSource | null;
};

export function selectApprovedPresentation(input: {
  canonical?: CanonicalApprovedState | null;
  stored?: PresentationContract | null;
  live?: PresentationContract | null;
}): { presentation: PresentationContract; source: ApprovedPresentationSource } | null {
  if (input.canonical?.presentation) {
    return { presentation: input.canonical.presentation, source: "canonical" };
  }
  if (input.stored) return { presentation: input.stored, source: "stored" };
  if (input.live) return { presentation: input.live, source: "live" };
  return null;
}

export function buildApprovedCaseView(input: {
  canonical?: CanonicalApprovedState | null;
  stored?: PresentationContract | null;
  live?: PresentationContract | null;
}): ApprovedCaseView {
  const selected = selectApprovedPresentation(input);
  return {
    presentation: selected?.presentation ?? null,
    version: input.canonical?.version ?? null,
    reason: input.canonical?.reason ?? null,
    source: selected?.source ?? null,
  };
}
