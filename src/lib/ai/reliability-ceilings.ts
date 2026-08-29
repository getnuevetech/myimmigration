/**
 * V5.1 Phase F — Phase 0 frozen per-stage ceilings + measurement helpers.
 * Aggregate call/latency/cost ceilings remain Phase F exit criteria (not frozen).
 */

export const PHASE0_RELIABILITY_CEILINGS = {
  logicalAnalysesPerUserRequest: 1,
  maxModelAttemptsPerStage: 2,
  maxFallbackModelsPerStage: 1,
  maxStructuredOutputRetries: 1,
  uncaughtModelFailuresInCustomerOutput: 0,
  duplicateConcurrentLogicalAnalyses: 0,
} as const;

/** Provisional measurement hints only — not Phase 0 freeze numbers. */
export const PHASE_F_AGGREGATE_HINTS = {
  maxTotalModelCallsPerAnalysis: 24,
  maxTotalFailedModelCalls: 4,
  maxRetryChildren: 3,
  maxWallClockSeconds: 180,
  targetSuccessRate: 0.95,
  maxTokenBudgetHint: 250_000,
  /** Phase F implements at most one coalesce child per parent until aggregates are approved. */
  coalesceChildrenPerParent: 1,
} as const;

export type StageBudget = {
  attempts: number;
  fallbacksUsed: number;
  structuredRetries: number;
};

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
  // Allow seeded multi-role consensus (typically ≤3) while blocking unbounded provider cloning.
  const softCap = Math.max(ceilings.maxModelAttemptsPerStage + ceilings.maxFallbackModelsPerStage, 3);
  return Math.min(stepCount, softCap);
}
