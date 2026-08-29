# V5.1 Phase G — Multi-fixture pack (positive + negative isolation)

**Status:** Implemented — review/merge  
**Date:** 2026-08-29  
**Sequence:** after Phase 0 (frozen), F, A, B, C, E, D on `main`

## What shipped

1. **12 fixtures** in `src/lib/v51-fixture-pack.ts` covering Correction Spec §13.G:
   - VAWA I-360 + pending I-485 (pos)
   - VAWA neg — forbid I-589 / country conditions
   - Marriage I-130 open options + filed I-130 (pos)
   - Asylum I-589 with country-conditions allowed (pos)
   - RFE / NOID / EAD I-765 / N-400 / consular I-130 / AOS w/o petition / EOIR court notice
2. **Isolation rules** — `must_allow` / `must_forbid` on customer text, primary-form / lock expectations, doc-kind include/exclude.
3. **Brief pathway locks** extended for asylum, N-400, I-765, NOID, consular, EOIR.
4. **Customer fillers** for I-589 (incl. country-conditions), N-400, I-765, NOID, I-485 AOS, I-130 filed.
5. **Full pack runner** — `npm run test:phase-g`; all V5.1 phase checks — `npm run test:v51`.

## Checks

- `npm run test:phase-g`
- `npm run test:v51` (F→A→B→C→E→D→G)

## Sequence complete

`0 → F → A → B → C → E → D → G`
