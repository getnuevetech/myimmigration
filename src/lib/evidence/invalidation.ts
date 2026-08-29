import "server-only";
import { db } from "@/lib/db";

const DEFAULT_COALESCE_SECONDS = 30;

/** In-process debounce timers for classification invalidation (single Node process). */
const pendingTimers = new Map<string, ReturnType<typeof setTimeout>>();

export async function markCustomerOutputStale(caseId: string, reason: string) {
  await db.case.update({
    where: { id: caseId },
    data: {
      customerOutputStale: true,
      invalidationPendingAt: new Date(),
      invalidationReason: reason.slice(0, 500),
    },
  }).catch(() => null);
}

export async function clearCustomerOutputStale(caseId: string) {
  await db.case.update({
    where: { id: caseId },
    data: {
      customerOutputStale: false,
      invalidationPendingAt: null,
      invalidationReason: "",
    },
  }).catch(() => null);
}

/**
 * DOCUMENT_CLASSIFICATION_CHANGED → coalesce → rebuild ledger/brief → optional analysis child.
 * Phase 0 contract: coalesce_window_seconds = 30; stale_customer_output_allowed = false.
 */
export function scheduleClassificationInvalidation(caseId: string, opts?: { coalesceSeconds?: number }) {
  const seconds = opts?.coalesceSeconds ?? DEFAULT_COALESCE_SECONDS;
  const existing = pendingTimers.get(caseId);
  if (existing) clearTimeout(existing);

  void markCustomerOutputStale(caseId, "DOCUMENT_CLASSIFICATION_CHANGED");

  const timer = setTimeout(() => {
    pendingTimers.delete(caseId);
    void runCoalescedInvalidation(caseId).catch(async (err) => {
      const { logSystem } = await import("@/lib/syslog");
      await logSystem("error", "evidence_invalidation", `Coalesced invalidation failed for case ${caseId}`, String(err));
    });
  }, Math.max(1, seconds) * 1000);

  pendingTimers.set(caseId, timer);
}

async function runCoalescedInvalidation(caseId: string) {
  const { rebuildCaseEvidenceState } = await import("./case-state");
  await rebuildCaseEvidenceState(caseId, { skipInvalidationSchedule: true });
  await clearCustomerOutputStale(caseId);

  const { findRunningLogicalAnalysis } = await import("@/lib/ai/logical-analysis");
  const running = await findRunningLogicalAnalysis(caseId);
  if (running) {
    await db.logicalAnalysis.update({ where: { id: running.id }, data: { coalescePending: true } });
    return;
  }

  const { runCaseAnalysis } = await import("@/lib/ai/orchestrator");
  void runCaseAnalysis(caseId, { trigger: "evidence_coalesce" }).catch(async (err) => {
    const { logSystem } = await import("@/lib/syslog");
    await logSystem("error", "evidence_invalidation", `Analysis after classification change failed for ${caseId}`, String(err));
  });
}

export function coalesceWindowSeconds(): number {
  return DEFAULT_COALESCE_SECONDS;
}
