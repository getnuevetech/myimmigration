# V5.1 Phase E — Approval gate (BLOCK / WARNING) + audit trail

**Status:** Implemented — review/merge  
**Date:** 2026-08-29  
**Sequence:** after Phase 0 (frozen), F, A, B, C on `main`

## What shipped

1. **`evaluateApprovalGate`** (`src/lib/approval-gate.ts`) — fail-closed BLOCKs + operable WARNINGs for the golden rule set (§10 / `approval_gate` in golden JSON).
2. **Audit trail** — `CaseApprovalGateAudit` rows + `CanonicalCaseState.gateResultJson`; payload includes `gate_result`, `rule_ids[]`, reasons, analysis/version ids, timestamp; override fields (`override_by` / `override_time` / `override_reason` / `previous_gate_result`) for non-silent staff override later.
3. **Orchestrator wiring** — before `finalizeCaseVersion`, evaluate gate; on **BLOCK** set status `gate_blocked`, strip customer presentation from approved state, persist audit.
4. **Customer approve refusal** — `selectApprovedPresentation` returns null when `approval_gate` is BLOCK (no fallthrough to live/stored).
5. **Stale + unsupported-authority** — `BLOCK-STATE-STALE-*` when `customerOutputStale` / pending invalidation; `BLOCK-AUTHORITY-UNSUPPORTED-LEGAL-INTERPRETATION` when material legal meaning lacks `interpretation_id` + USCIS/DOJ/DOS/EOIR authorities.

## Checks

- `npm run test:phase-e`
- Healthy VAWA fixture → WARN (gaps/unverified), not BLOCK
- Negative cases for each BLOCK id in the golden list

## Deploy

`prisma migrate deploy` for `20260829160000_approval_gate`.

## Next

Phase D — deterministic action ranking formula.
