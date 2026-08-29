/**
 * V5.1 Phase F — Phase 0 per-stage ceilings + approved aggregate ceilings (F exit).
 *
 * Aggregate numbers adopted from golden `provisional_measurement_hints_only`
 * as production hard-stops (Phase F exit / Option B closed).
 */

export const PHASE0_RELIABILITY_CEILINGS = {
  logicalAnalysesPerUserRequest: 1,
  maxModelAttemptsPerStage: 2,
  maxFallbackModelsPerStage: 1,
  maxStructuredOutputRetries: 1,
  uncaughtModelFailuresInCustomerOutput: 0,
  duplicateConcurrentLogicalAnalyses: 0,
} as const;

/**
 * Approved aggregate ceilings (Phase F exit — 2026-08-29).
 * Source: golden-vawa-prima-facie.json → phase_f_aggregate_ceilings_to_establish.provisional_measurement_hints_only
 * Coalesce children stay at 1 (prefer coalesce over concurrent); lineage retry children ≤ 3.
 */
export const PHASE_F_AGGREGATE_CEILINGS = {
  maxTotalModelCallsPerAnalysis: 24,
  maxTotalFailedModelCalls: 4,
  maxRetryChildren: 3,
  /** Active coalesce: at most one evidence_coalesce child per parent run. */
  coalesceChildrenPerParent: 1,
  maxWallClockSeconds: 180,
  targetSuccessRate: 0.95,
  maxTokenBudgetHint: 250_000,
  approvedAt: "2026-08-29",
  approvedSource: "golden_provisional_hints_promoted",
} as const;

/** @deprecated Use PHASE_F_AGGREGATE_CEILINGS — kept as alias for older imports. */
export const PHASE_F_AGGREGATE_HINTS = PHASE_F_AGGREGATE_CEILINGS;

export type StageBudget = {
  attempts: number;
  fallbacksUsed: number;
  structuredRetries: number;
};

export type AggregateUsage = {
  modelCallCount: number;
  failedCallCount: number;
  wallClockMs: number;
};

export type AggregateCeilingBreach =
  | "max_total_model_calls"
  | "max_total_failed_model_calls"
  | "max_wall_clock_seconds";

export function emptyStageBudget(): StageBudget {
  return { attempts: 0, fallbacksUsed: 0, structuredRetries: 0 };
}

/** Each enabled step may attempt the provider up to maxModelAttemptsPerStage times (call + retries). */
export function canAttemptStep(budget: StageBudget, ceilings = PHASE0_RELIABILITY_CEILINGS): boolean {
  return budget.attempts < ceilings.maxModelAttemptsPerStage;
}

export function canUseFallback(budget: StageBudget, ceilings = PHASE0_RELIABILITY_CEILINGS): boolean {
  return budget.fallbacksUsed < ceilings.maxFallbackModelsPerStage;
}

export function canRetryStructuredOutput(budget: StageBudget, ceilings = PHASE0_RELIABILITY_CEILINGS): boolean {
  return budget.structuredRetries < ceilings.maxStructuredOutputRetries;
}

export function recordAttempt(budget: StageBudget): StageBudget {
  return { ...budget, attempts: budget.attempts + 1 };
}

export function recordFallback(budget: StageBudget): StageBudget {
  return { ...budget, fallbacksUsed: budget.fallbacksUsed + 1, attempts: budget.attempts + 1 };
}

export function recordStructuredRetry(budget: StageBudget): StageBudget {
  return { ...budget, structuredRetries: budget.structuredRetries + 1, attempts: budget.attempts + 1 };
}

/**
 * Cap fan-out for a single stage invocation.
 * Consensus roles still run, but admin multi-provider cloning cannot exceed this hard cap.
 */
export function maxStepsForStageInvocation(stepCount: number, ceilings = PHASE0_RELIABILITY_CEILINGS): number {
  const softCap = Math.max(ceilings.maxModelAttemptsPerStage + ceilings.maxFallbackModelsPerStage, 3);
  return Math.min(stepCount, softCap);
}

/** Whether another model call is allowed under approved aggregate ceilings. */
export function canMakeAggregateModelCall(
  usage: AggregateUsage,
  ceilings = PHASE_F_AGGREGATE_CEILINGS,
): boolean {
  if (usage.modelCallCount >= ceilings.maxTotalModelCallsPerAnalysis) return false;
  if (usage.failedCallCount >= ceilings.maxTotalFailedModelCalls) return false;
  if (usage.wallClockMs >= ceilings.maxWallClockSeconds * 1000) return false;
  return true;
}

export function detectAggregateCeilingBreach(
  usage: AggregateUsage,
  ceilings = PHASE_F_AGGREGATE_CEILINGS,
): AggregateCeilingBreach | null {
  if (usage.modelCallCount >= ceilings.maxTotalModelCallsPerAnalysis) return "max_total_model_calls";
  if (usage.failedCallCount >= ceilings.maxTotalFailedModelCalls) return "max_total_failed_model_calls";
  if (usage.wallClockMs >= ceilings.maxWallClockSeconds * 1000) return "max_wall_clock_seconds";
  return null;
}

export function canSpawnCoalesceChild(
  existingChildCount: number,
  ceilings = PHASE_F_AGGREGATE_CEILINGS,
): boolean {
  return existingChildCount < ceilings.coalesceChildrenPerParent;
}

export function canSpawnRetryChild(
  lineageChildCount: number,
  ceilings = PHASE_F_AGGREGATE_CEILINGS,
): boolean {
  return lineageChildCount < ceilings.maxRetryChildren;
}
