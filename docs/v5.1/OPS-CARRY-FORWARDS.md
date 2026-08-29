# Ops carry-forwards — gate override, posture rename, monitoring

**Status:** Implemented  
**Date:** 2026-08-29  
**Depends on:** V5.1 Phases A–G + Phase E approval gate on `main`

## 1. Approval-gate override UI

- Admin case page shows BLOCK reasons + audited override form
- `overrideApprovalGateAction` → `applyStaffApprovalGateOverride`
- Uses `withGateOverride` (BLOCK → WARN), persists audit, finalizes version with presentation restored
- No silent overrides; reason ≥ 12 chars required

## 2. Posture rename

- Canonical ledger value: `PENDING_PRIMA_FACIE_ISSUED`
- Dual-read: `isPrimaFacieIssuedPosture` still accepts legacy `PRIMA_FACIE_PENDING`
- Customer/staff strings use `postureCustomerLabel` (no raw enum leak)

## 3. Monitoring (Phase F soft targets)

Admin analytics AI engine card adds:
- Logical analysis success rate vs 95% target
- Sum of model calls / failed calls
- Avg / max wall-clock
- Ceiling breach count (30d, from SystemLog)
- Token budget hint (250k, not metered)

## Checks

`npm run test:ops-carry` / included in `npm run test:v51` via ops script + phase-b/e updates
