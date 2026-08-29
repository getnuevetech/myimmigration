import "server-only";
import { db } from "../db";
import {
  PHASE0_RELIABILITY_CEILINGS,
  PHASE_F_AGGREGATE_CEILINGS,
  canMakeAggregateModelCall,
  canSpawnCoalesceChild,
  canSpawnRetryChild,
  detectAggregateCeilingBreach,
  emptyStageBudget,
  type AggregateCeilingBreach,
  type StageBudget,
} from "./reliability-ceilings";

export type BeginLogicalAnalysisResult =
  | { kind: "started"; logicalAnalysisId: string; parentId: string | null }
  | { kind: "skipped_concurrent"; logicalAnalysisId: string; runningId: string };

function parseStageBudgets(raw: string): Record<string, StageBudget> {
  try {
    const parsed = JSON.parse(raw || "{}") as Record<string, StageBudget>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

/** Find a still-running logical analysis for this case (concurrency lock). */
export async function findRunningLogicalAnalysis(caseId: string) {
  return db.logicalAnalysis.findFirst({
    where: { caseId, status: "running" },
    orderBy: { startedAt: "desc" },
  });
}

/**
 * Begin one logical analysis for a user-facing (or coalesce/draft) request.
 * Enforces: duplicate concurrent logical analyses = 0 for live case analysis.
 */
export async function beginLogicalAnalysis(opts: {
  caseId: string;
  trigger: "user_request" | "evidence_coalesce" | "admin_draft";
  parentId?: string | null;
  caseVersionId?: string | null;
  allowConcurrent?: boolean;
}): Promise<BeginLogicalAnalysisResult> {
  const allowConcurrent = opts.allowConcurrent === true || opts.trigger === "admin_draft";

  if (!allowConcurrent) {
    const running = await findRunningLogicalAnalysis(opts.caseId);
    if (running) {
      await db.logicalAnalysis.update({
        where: { id: running.id },
        data: { coalescePending: true },
      });
      const skipped = await db.logicalAnalysis.create({
        data: {
          caseId: opts.caseId,
          caseVersionId: opts.caseVersionId ?? null,
          parentId: running.id,
          trigger: opts.trigger,
          status: "skipped_concurrent",
          skipReason: "duplicate_concurrent_logical_analysis",
          finishedAt: new Date(),
          wallClockMs: 0,
        },
      });
      const { logSystem } = await import("../syslog");
      await logSystem(
        "warning",
        "logical_analysis",
        `Skipped concurrent analysis for case ${opts.caseId}; coalesce pending on ${running.id}`,
        `skipped=${skipped.id}`,
      );
      return { kind: "skipped_concurrent", logicalAnalysisId: skipped.id, runningId: running.id };
    }
  }

  // Aggregate lineage: refuse a new coalesce/retry child beyond maxRetryChildren.
  if (opts.parentId && opts.trigger === "evidence_coalesce") {
    const lineageCount = await db.logicalAnalysis.count({
      where: { parentId: opts.parentId },
    });
    if (!canSpawnRetryChild(lineageCount)) {
      const skipped = await db.logicalAnalysis.create({
        data: {
          caseId: opts.caseId,
          caseVersionId: opts.caseVersionId ?? null,
          parentId: opts.parentId,
          trigger: opts.trigger,
          status: "skipped_concurrent",
          skipReason: "max_retry_children",
          finishedAt: new Date(),
          wallClockMs: 0,
        },
      });
      return { kind: "skipped_concurrent", logicalAnalysisId: skipped.id, runningId: opts.parentId };
    }
  }

  const row = await db.logicalAnalysis.create({
    data: {
      caseId: opts.caseId,
      caseVersionId: opts.caseVersionId ?? null,
      parentId: opts.parentId ?? null,
      trigger: opts.trigger,
      status: "running",
    },
  });
  return { kind: "started", logicalAnalysisId: row.id, parentId: opts.parentId ?? null };
}

export async function attachCaseVersionToLogicalAnalysis(logicalAnalysisId: string, caseVersionId: string) {
  await db.logicalAnalysis.update({
    where: { id: logicalAnalysisId },
    data: { caseVersionId },
  });
}

export async function getStageBudget(logicalAnalysisId: string, stageKey: string): Promise<StageBudget> {
  const row = await db.logicalAnalysis.findUnique({ where: { id: logicalAnalysisId }, select: { stageBudgetJson: true } });
  const budgets = parseStageBudgets(row?.stageBudgetJson ?? "{}");
  return budgets[stageKey] ?? emptyStageBudget();
}

export async function setStageBudget(logicalAnalysisId: string, stageKey: string, budget: StageBudget) {
  const row = await db.logicalAnalysis.findUnique({ where: { id: logicalAnalysisId }, select: { stageBudgetJson: true } });
  const budgets = parseStageBudgets(row?.stageBudgetJson ?? "{}");
  budgets[stageKey] = budget;
  await db.logicalAnalysis.update({
    where: { id: logicalAnalysisId },
    data: { stageBudgetJson: JSON.stringify(budgets) },
  });
}

export type RecordModelCallResult = {
  allowed: boolean;
  breach: AggregateCeilingBreach | null;
  modelCallCount: number;
  failedCallCount: number;
  wallClockMs: number;
};

/**
 * Increment call counters and enforce approved aggregate ceilings.
 * Returns allowed=false when further model calls must stop (fail closed to deterministic path).
 */
export async function recordLogicalModelCall(logicalAnalysisId: string, failed: boolean): Promise<RecordModelCallResult> {
  const before = await db.logicalAnalysis.findUnique({
    where: { id: logicalAnalysisId },
    select: { modelCallCount: true, failedCallCount: true, startedAt: true },
  });
  const wallClockMs = before ? Math.max(0, Date.now() - before.startedAt.getTime()) : 0;
  const breachBefore = before
    ? detectAggregateCeilingBreach({
        modelCallCount: before.modelCallCount,
        failedCallCount: before.failedCallCount,
        wallClockMs,
      })
    : null;
  if (breachBefore) {
    return {
      allowed: false,
      breach: breachBefore,
      modelCallCount: before!.modelCallCount,
      failedCallCount: before!.failedCallCount,
      wallClockMs,
    };
  }

  const updated = await db.logicalAnalysis.update({
    where: { id: logicalAnalysisId },
    data: {
      modelCallCount: { increment: 1 },
      ...(failed ? { failedCallCount: { increment: 1 } } : {}),
    },
    select: { modelCallCount: true, failedCallCount: true, startedAt: true },
  });
  const afterWall = Math.max(0, Date.now() - updated.startedAt.getTime());
  const breach = detectAggregateCeilingBreach({
    modelCallCount: updated.modelCallCount,
    failedCallCount: updated.failedCallCount,
    wallClockMs: afterWall,
  });
  return {
    allowed: canMakeAggregateModelCall({
      modelCallCount: updated.modelCallCount,
      failedCallCount: updated.failedCallCount,
      wallClockMs: afterWall,
    }),
    breach,
    modelCallCount: updated.modelCallCount,
    failedCallCount: updated.failedCallCount,
    wallClockMs: afterWall,
  };
}

/** Soft pre-check before starting a provider call (does not increment). */
export async function assertAggregateBudgetAllowsCall(logicalAnalysisId: string): Promise<RecordModelCallResult> {
  const row = await db.logicalAnalysis.findUnique({
    where: { id: logicalAnalysisId },
    select: { modelCallCount: true, failedCallCount: true, startedAt: true },
  });
  const wallClockMs = row ? Math.max(0, Date.now() - row.startedAt.getTime()) : 0;
  const usage = {
    modelCallCount: row?.modelCallCount ?? 0,
    failedCallCount: row?.failedCallCount ?? 0,
    wallClockMs,
  };
  const breach = detectAggregateCeilingBreach(usage);
  return {
    allowed: canMakeAggregateModelCall(usage),
    breach,
    ...usage,
  };
}

export async function finishLogicalAnalysis(
  logicalAnalysisId: string,
  status: "complete" | "failed",
): Promise<{ coalescePending: boolean; caseId: string; childCount: number }> {
  const row = await db.logicalAnalysis.findUnique({ where: { id: logicalAnalysisId } });
  if (!row) return { coalescePending: false, caseId: "", childCount: 0 };
  const wallClockMs = Math.max(0, Date.now() - row.startedAt.getTime());
  await db.logicalAnalysis.update({
    where: { id: logicalAnalysisId },
    data: {
      status,
      finishedAt: new Date(),
      wallClockMs,
      coalescePending: false,
    },
  });
  const childCount = await db.logicalAnalysis.count({
    where: { parentId: logicalAnalysisId, trigger: "evidence_coalesce" },
  });
  return { coalescePending: row.coalescePending, caseId: row.caseId, childCount };
}

/**
 * After a logical analysis completes, optionally spawn one coalesce child if
 * concurrent triggers arrived during the run (upload/clarify/comment storm).
 */
export async function maybeSpawnCoalesceChild(opts: {
  parentId: string;
  caseId: string;
  coalescePending: boolean;
  childCount: number;
}): Promise<boolean> {
  if (!opts.coalescePending) return false;
  if (!canSpawnCoalesceChild(opts.childCount)) {
    const { logSystem } = await import("../syslog");
    await logSystem(
      "warning",
      "logical_analysis",
      `Coalesce suppressed for case ${opts.caseId}: child ceiling reached (${PHASE_F_AGGREGATE_CEILINGS.coalesceChildrenPerParent})`,
      `parent=${opts.parentId}`,
    );
    return false;
  }
  return true;
}

export function phase0Ceilings() {
  return PHASE0_RELIABILITY_CEILINGS;
}

export function phaseFAggregateCeilings() {
  return PHASE_F_AGGREGATE_CEILINGS;
}
