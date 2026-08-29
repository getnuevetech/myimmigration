/**
 * Phase F reliability ceiling unit checks (no DB).
 * Run: npx tsx scripts/phase-f-reliability-check.ts
 */
import assert from "node:assert/strict";
import {
  PHASE0_RELIABILITY_CEILINGS,
  PHASE_F_AGGREGATE_HINTS,
  canAttemptStep,
  canRetryStructuredOutput,
  canUseFallback,
  emptyStageBudget,
  maxStepsForStageInvocation,
  recordAttempt,
  recordFallback,
  recordStructuredRetry,
} from "../src/lib/ai/reliability-ceilings";

function main() {
  assert.equal(PHASE0_RELIABILITY_CEILINGS.logicalAnalysesPerUserRequest, 1);
  assert.equal(PHASE0_RELIABILITY_CEILINGS.maxModelAttemptsPerStage, 2);
  assert.equal(PHASE0_RELIABILITY_CEILINGS.maxFallbackModelsPerStage, 1);
  assert.equal(PHASE0_RELIABILITY_CEILINGS.maxStructuredOutputRetries, 1);
  assert.equal(PHASE0_RELIABILITY_CEILINGS.duplicateConcurrentLogicalAnalyses, 0);

  let b = emptyStageBudget();
  assert.equal(canAttemptStep(b), true);
  b = recordAttempt(b);
  assert.equal(b.attempts, 1);
  b = recordAttempt(b);
  assert.equal(canAttemptStep(b), false);
  assert.equal(canRetryStructuredOutput(emptyStageBudget()), true);
  assert.equal(canRetryStructuredOutput(recordStructuredRetry(emptyStageBudget())), false);

  let f = emptyStageBudget();
  assert.equal(canUseFallback(f), true);
  f = recordFallback(f);
  assert.equal(canUseFallback(f), false);

  assert.equal(maxStepsForStageInvocation(10), 3);
  assert.equal(maxStepsForStageInvocation(2), 2);

  assert.ok(PHASE_F_AGGREGATE_HINTS.maxTotalModelCallsPerAnalysis > 0);
  assert.equal(PHASE_F_AGGREGATE_HINTS.coalesceChildrenPerParent, 1);

  console.log("phase-f-reliability-check: OK");
}

main();
