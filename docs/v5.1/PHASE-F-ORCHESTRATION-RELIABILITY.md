# V5.1 Phase F — Orchestration Reliability

**Status:** Complete — aggregate ceilings **approved and enforced** (Phase F exit closed 2026-08-29)  
**Date:** 2026-08-29  
**Depends on:** Phase 0 Correction Spec Rev 3 + Golden VAWA Fixture v3 (**FROZEN**)

---

## Phase 0 freeze (recorded)

Phase 0 / V5.1 Correction Specification Rev 3 and Golden VAWA Fixture v3 are **approved and frozen**.

Delivery sequence remains locked: `0 → F → A → B → C → E → D → G` (implemented on `main`).

### Carry-forward notes (not Phase 0 blockers)

1. ~~**Posture naming:** Prefer renaming internal current posture `PRIMA_FACIE_PENDING` → `PENDING_PRIMA_FACIE_ISSUED`~~ **Done** (see `case-posture.ts`).
2. **Customer vs system actions (Phase D):** `UPDATE_GREEN_CARD_PATH_EXPLANATION` is a **system consequence** (implemented in Phase D).

---

## Root cause of the “78 failed calls / many runs” storm

| Cause | Effect |
| --- | --- |
| **No concurrency lock** | Overlapping `runCaseAnalysis` on the same case |
| **`AnalysisRun` = stage, not logical analysis** | Stage counts looked like “many runs” |
| **Seeded multi-model fan-out** | ~11 model calls/pass typical |
| **Provider failure multiplier** | Bad keys → every step fails; fan-out × re-entrancy ≈ ~78 |

**Fix shape:** logical analysis ID + concurrency lock + per-stage ceilings + **approved aggregate hard-stops**.

---

## What Phase F implemented

1. **`LogicalAnalysis` model** — counters, stage budgets, coalesce, parent/child
2. **Concurrency lock** — `skipped_concurrent` + coalesce pending
3. **Coalesce child** — ≤ 1 sequential `evidence_coalesce` child per parent
4. **Per-stage ceilings (Phase 0):** ≤2 attempts/step, ≤1 fallback/stage, ≤1 structured retry, fan-out cap
5. **Call accounting** — `modelCallCount` / `failedCallCount` / `wallClockMs`
6. **Admin diagnostics** — logical analyses on case detail / analytics
7. **Aggregate hard-stops (F exit):** see below

---

## Approved aggregate ceilings (Phase F exit)

Adopted from golden `provisional_measurement_hints_only` as production hard-stops (`PHASE_F_AGGREGATE_CEILINGS`):

| Metric | Approved value | Enforcement |
| --- | --- | --- |
| Max total model calls / logical analysis | **24** | Pre-check before each provider call; stop further AI calls |
| Max total failed model calls / logical analysis | **4** | Same; fail closed toward deterministic fallback |
| Max coalesce children / parent | **1** | `maybeSpawnCoalesceChild` |
| Max retry children in lineage | **3** | `beginLogicalAnalysis` for `evidence_coalesce` |
| Max wall-clock seconds | **180** | Pre-check using `startedAt` elapsed |
| Target success rate | **0.95** | Monitoring target (not a hard abort) |
| Token / cost envelope | **250_000** hint | Soft budget hint; measure in ops |

---

## Exit criteria — closed

- [x] Root cause write-up accepted (this doc)
- [x] Logical analysis ID behavior accepted
- [x] Aggregate ceilings approved **and enforced**
- [x] Phases A–G delivered on `main`

## Checks

- `npm run test:phase-f`
- `npm run test:v51`

---

*End of Phase F write-up (exit closed).*
