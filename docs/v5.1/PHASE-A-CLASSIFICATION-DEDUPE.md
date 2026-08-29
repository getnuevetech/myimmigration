# V5.1 Phase A — Document classification + dedupe + plan honesty

**Status:** Implemented — review/merge  
**Date:** 2026-08-29  
**Sequence:** after frozen Phase 0 + Phase F on `main`

## Defects addressed

1. **I-360 receipt / personal declaration shown as Identity & Entry**
   - Classifier: upload default `docKind=identity` / declared `identity_document` no longer wins without identity cues (passport/visa/I-94/etc.).
   - Stronger I-360 receipt filename/text hints.
   - Customer takeaway renderer re-resolves type via `resolveImmigrationDocumentType` (filename-aware); bare `docKind: identity` cannot paint Identity & Entry over an I-360 receipt or declaration filename.
2. **Duplicate Prima Facie rows**
   - Customer assemble path excludes `duplicateOfId` and collapses same `contentHash` / prima-facie group to one row (`dedupeDocumentsForCustomerPresentation`).
   - Case customer query excludes duplicates; processing skips fact/event double-writes when `duplicateOfId` is set.
3. **“Document processing is not needed for this options review”**
   - `processDocumentsSkipReason`: if any documents are on the case, use “Documents already processed and current” (INV-PLAN-01). Options-review wording only when `documentCount === 0`.

## Upload default

`InlineUpload` default kind: `evidence` (was `identity`). I-360 matching document preference: **notice** first (then declaration / relationship).

## Checks

- `npm run test:phase-a`
- Extended assertions in `scripts/v32-evidence-check.ts` for INV-PLAN-01

## Out of scope (later phases)

- Full fact-ledger promotion / invalidation (Phase B) — done
- I-130 / I-589 presentation lock copy cleanup in `goal-documents` hints (Phase C) — done
- Action ranking (Phase D)
