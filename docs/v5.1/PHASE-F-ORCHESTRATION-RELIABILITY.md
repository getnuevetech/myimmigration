# V5.1 Phase F — Orchestration Reliability

**Status:** Implementation complete — awaiting approval of aggregate ceilings (Phase F exit)  
**Date:** 2026-08-29  
**Depends on:** Phase 0 Correction Spec Rev 3 + Golden VAWA Fixture v3 (**FROZEN**)

---

## Phase 0 freeze (recorded)

Phase 0 / V5.1 Correction Specification Rev 3 and Golden VAWA Fixture v3 are **approved and frozen**.

Delivery sequence remains locked: `0 → F → A → B → C → E → D → G`.

### Carry-forward notes (not Phase 0 blockers)

1. **Posture naming:** Prefer renaming internal current posture `PRIMA_FACIE_PENDING` → something like `PENDING_PRIMA_FACIE_ISSUED` later so it is not misread as “prima facie not yet issued.” Event/posture separation itself is correct.
2. **Customer vs system actions (Phase D):** Treat `UPDATE_GREEN_CARD_PATH_EXPLANATION` as a **system consequence** (regenerate explanation), not a customer upload/confirm action.

---

## Root cause of the “78 failed calls / many runs” storm

Code inspection of the live orchestration path (`runCaseAnalysis` via Next.js `after()`, no queue):

| Cause | Effect |
| --- | --- |
| **No concurrency lock** | Upload + clarify + comment + intake can all schedule overlapping `runCaseAnalysis` on the same case. Each pass clears issues/path and creates a full set of stage runs. |
| **`AnalysisRun` = stage, not logical analysis** | Admin “analysis runs” counted stages. One logical pass ≈ 5–6 stage runs; several overlapping passes looked like “many runs.” |
| **Seeded multi-model fan-out** | Default ~11 model calls/pass (summary 3 + goal 2 + document 2 + situation 3 + presenter 1; independent review can add another situation stage). |
| **Provider failure multiplier** | Bad/missing API keys → every step fails and is logged. ~11 failures × ~7 overlapping/historical passes ≈ **~77**, matching “78 failed.” |
| **No structured-output retry ceiling** | Not the primary storm driver (retries were mostly absent); Phase F still enforces max 1 structured retry per step when JSON is missing. |

**Not the primary cause:** exponential backoff retry loops (they did not exist). The storm is structural: **fan-out × re-entrancy × failed providers**.

---

## What Phase F implemented

1. **`LogicalAnalysis` model** — owns one logical analysis: counters, stage budgets, coalesce flag, optional parent/child, link to `CaseVersion` and `AnalysisRun`s.
2. **Concurrency lock** — live analyses: if a logical analysis is already `running` for the case, new triggers are recorded as `skipped_concurrent` and set `coalescePending` on the runner (`duplicate_concurrent_logical_analyses = 0`).
3. **Coalesce child** — when the runner finishes with `coalescePending`, at most **one** sequential child (`evidence_coalesce`) is spawned (provisional child ceiling until aggregates approved).
4. **Per-stage / per-step ceilings (Phase 0 frozen):**
   - ≤ 2 attempts per step (call + structured-output retry)
   - ≤ 1 fallback model per stage if all steps fail
   - stage step fan-out hard-capped (blocks unbounded admin provider cloning)
5. **Call accounting** — `modelCallCount` / `failedCallCount` / `wallClockMs` on each logical analysis.
6. **Admin diagnostics** — case detail shows logical analyses; platform analytics include logical-analysis counts.
7. **Check script** — `scripts/phase-f-reliability-check.ts`.

---

## Proposed aggregate ceilings (Phase F exit — needs written approval)

After measuring production post-deploy, approve or revise:

| Metric | Proposed starting point | Notes |
| --- | --- | --- |
| Max total model calls / logical analysis | **24** | Hint from golden fixture; one full pass is typically ≤ ~12–14 with review |
| Max total failed model calls / logical analysis | **4** | Fail closed to deterministic fallback beyond this (future hard stop) |
| Max coalesce / retry children | **1** (implemented) → up to **3** if needed | Prefer coalesce over concurrent |
| Max wall-clock / p95 | **180s** wall / measure p95 | Hung calls already time out at 90s each |
| Target success rate | **0.95** | Logical analyses completing without uncaught customer failure |
| Token / cost envelope | measure first | Do not invent a hard $ cap before baseline |

Phase F does **not** invent these as production hard-stops yet (Option B from Phase 0). It implements tracking + per-stage ceilings + concurrency lock so the next storm is diagnosable and largely prevented.

---

## Exit criteria for Phase F

Approve Phase F when:

- [ ] Root cause write-up accepted  
- [ ] Logical analysis ID behavior accepted  
- [ ] Aggregate ceilings approved (or explicitly deferred with interim soft monitoring)  
- [ ] Then begin Phase A only  

---

*End of Phase F write-up.*
