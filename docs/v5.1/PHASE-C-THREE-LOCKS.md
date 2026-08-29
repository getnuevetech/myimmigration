# V5.1 Phase C — Three locks (retrieval / presentation / recommendation)

**Status:** Implemented — review/merge  
**Date:** 2026-08-29  
**Sequence:** after Phase 0 (frozen), F, A, B on `main`

## Defects addressed

1. **I-130 / I-589 instructional bleed** in evidence “why it matters” / document hints  
   - Catalog hints no longer cite “Form I-130 instructions describe” or “Form I-589 and similar packets”.  
   - `documentHintForLock` + presentation lock scrub under locked matters.
2. **Ranking lock ≠ copy/recommendation lock**  
   - **Retrieval lock** (`passesRetrievalLock` / `filterByRetrievalLock`) hard-filters competing pathway knowledge before soft scoring.  
   - **Presentation lock** (`passesPresentationLock`) gates customer-facing strings (needed-doc hints, still-need copy).  
   - **Recommendation lock** (`passesRecommendationLock`) drops competing starter-petition recommendations while allowing explicit anti-recommendations.
3. **Anti-I-130 allowed, not global**  
   - `shouldEmitAntiI130` emits only when locked away from family/I-130 **and** `detectI130ContaminationRisk` is true (e.g. marriage→I-130 misconception).  
   - Golden VAWA fixture still requires the anti-I-130 line because contamination risk is present.

## Invariants

- `INV-LOCK-01` — VAWA I-360 lock must not surface I-589 / country-conditions as requirements or recommendations.  
- `INV-LOCK-02` — VAWA I-360 lock must not recommend a new I-130; contrast / anti-recommendation allowed.

## Checks

- `npm run test:phase-c`
- Golden `exact_must_not_include` phrases covered by catalog + presentation assembly

## Next

Phase E — approval gate — done (`docs/v5.1/PHASE-E-APPROVAL-GATE.md`).  
Phase D — action ranking.
