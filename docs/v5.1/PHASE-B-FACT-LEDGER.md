# V5.1 Phase B — Fact ledger + provenance + invalidation

**Status:** Implemented — merge to main  
**Date:** 2026-08-29  
**Sequence:** after Phase 0 (frozen), F, A on `main`

## What shipped

1. **`buildFactLedger`** (`src/lib/evidence/fact-ledger.ts`) — golden material facts with VERIFIED / REPORTED / UNKNOWN, `UNVERIFIED_CLAIM` vs `EVIDENCE_GAP`, empty conflicts for the VAWA fixture, resolve vs promote semantics (`promotion_on`).
2. **Authority** (`src/lib/evidence/authority.ts`) — independent `source_channel` / `issuer` / `authority_rank`; USCIS PDFs stay government authority when customer-uploaded.
3. **Provenance on EvidenceFact writes** — `sourceAnchorJson` includes `document_id`, `content_hash` (`sha256:…`), issuer, authority rank.
4. **Marriage split in situation brief** — verified civil marriage vs reported spouse USC (not one collapsed “married to USC” verified claim).
5. **Event timeline vs posture** — timeline events never supersede; `I360_CURRENT_POSTURE` can supersede `FILED_PENDING` → `PRIMA_FACIE_PENDING`.
6. **Invalidation** — `DOCUMENT_CLASSIFICATION_CHANGED` marks `customerOutputStale`, coalesces 30s, rebuilds ledger/brief, then Phase F analysis coalesce / child run.
7. **Persistence** — `CaseReconstruction.factLedgerJson`; `Case.customerOutputStale` / `invalidationPendingAt` / `invalidationReason`.

## Checks

- `npm run test:phase-b`
- Existing `v32-evidence-check` (marriage brief wording updated)

## Deploy

`prisma migrate deploy` for `20260829140000_fact_ledger`.

## Next

Phase C — three locks — done (`docs/v5.1/PHASE-C-THREE-LOCKS.md`).  
Phase E — approval gate.
