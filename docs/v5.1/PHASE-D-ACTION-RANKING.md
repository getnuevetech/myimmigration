# V5.1 Phase D — Deterministic action ranking

**Status:** Implemented — review/merge  
**Date:** 2026-08-29  
**Sequence:** after Phase 0 (frozen), F, A, B, C, E on `main`

## What shipped

1. **`computePriorityScore` / `rankScoredActions`** (`src/lib/action-priority.ts`) — Correction Spec §5.7 additive formula, weights, and tie-breaks.
2. **Ledger-driven actions** — `buildLedgerDrivenActions` emits golden VAWA scored actions only while gaps/unverified claims remain open; scores match `next_actions_ordered` (59 → 55 → 52 → 50 → 38).
3. **INV-ACT-01** — `mergeRankedCustomerActions` demotes `REVIEW_FORM` / `ASK_FOLLOW_UP` / keep-notice generics below material gap resolvers.
4. **System vs customer** — `UPDATE_GREEN_CARD_PATH_EXPLANATION` is ranked as a **system** consequence and excluded from customer `whatToDoNext` CTAs.
5. **Wiring** — `assembleV5CustomerPresentation` ranks next steps from the fact ledger; `buildCaseActionGraph` prefers ledger priority and appends missing gap actions.

## Checks

- `npm run test:phase-d`

## Next

Phase G — multi-fixture pack with positive and negative isolation tests.
