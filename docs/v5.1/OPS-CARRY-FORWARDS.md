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

---

## 4. Situation Intelligence (Phase SI-6)

**Dashboard / log keys** (institutional only — no narrative PII):

| Event | Target |
| --- | --- |
| `full_personalized_analysis_before_fact_orientation` | **0** for underspecified Situations still in interview |
| `situation_intelligence_interview_ask_count` | Track distribution (target 3–5; max 6) |
| `situation_intelligence_learning_suppress` | Medical-exam / correction suppressions |
| `situation_intelligence_learning_boost` | Prefer-key boosts from lessons/corrections |
| `situation_intelligence_interview_quality_captured` | Fired when interview ready for analysis |

**Regression bans** (enforced by `npm run test:phase-si-6`):

- No I-130 / USC-spouse pathway without Fact Set family basis (Zimbabwe + novel)
- No medical-exam as next ask
- No `ready_for_analysis` while a next orientation question remains
- Complete narratives may stop at 0 asks (`already_sufficient`)

