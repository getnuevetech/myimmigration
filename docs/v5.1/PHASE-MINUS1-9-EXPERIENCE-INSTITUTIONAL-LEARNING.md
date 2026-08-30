# Phase −1.9 — Experience & Institutional Learning

**Status:** Authorized umbrella for L0–L8 (capture may start with S1; retrieval gated to L4)  
**Date:** 2026-08-30  
**Parent program:** Phase S (`PHASE-S-SITUATION-FILING-PLAN-EXECUTION.md`)  
**Does not block:** S1 / S2 customer fix  

---

## Purpose

Accumulate **reusable immigration reasoning experience** without training models live on customer traffic and without sharing identities across users.

```
Interaction
     ↓
Structured ExperienceRecord
     ↓
De-identification
     ↓
Observation / Pattern Candidate
     ↓
Validation
     ↓
Review
     ↓
Production Pattern (L4)
     ↓
Retrieval for future Sol reasoning
```

---

## Non-negotiable rules

1. Learn patterns, decision logic, corrections, outcomes — **not identities**.  
2. **No live fine-tuning** of Sol/Opus from production.  
3. Authority precedence: CURRENT AUTHORITY > REVIEWED INTERNAL RULE > VALIDATED PRODUCTION PATTERN > HISTORICAL EXPERIENCE > MODEL INFERENCE.  
4. Outcome ≠ law.  
5. Only **L4 Production** patterns influence ordinary production retrieval.  
6. Negative learning is required (seed: medical-exam premature clarify).  

---

## Pattern promotion

| Level | Name | Production use |
| --- | --- | --- |
| L0 | Observation | Admin only |
| L1 | Candidate | Admin only |
| L2 | Supported | Admin only |
| L3 | Reviewed | Feature-flag / reviewer tools only |
| L4 | Production | Allowed in Experience Search for Sol |

---

## Delivery slices

| Slice | Deliverable | Gate |
| --- | --- | --- |
| **L0** | ExperienceRecord schema + write on Situation/Q&A/Case turns | **Shipped** |
| **L1** | De-identification; block cross-user raw retrieval | **Shipped** — `ExperienceObservation` + `deidentify.ts` |
| **L2** | Decision-changing vs discarded facts; negative learning records | **Shipped** — `what-mattered.ts` + `negative-learning.ts` |
| **L3** | Consultant correction → pattern candidates | **Shipped** — `corrections.ts` + candidate publish (level 1) |
| **L4** | Government outcome signals → candidates (authority check) | **Shipped** — `outcomes.ts` + authority-gated candidates (level 1) |
| **L5** | Pattern Registry admin UI + promotion 0→4 | **Shipped** — `/admin/experience` + `registry.ts` |
| **L6** | Experience Search into Sol (L4 only) | After L5 |
| **L7** | Telemetry: help/harm; stale/authority invalidation | With L6 |
| **S8** | Experience regression fixtures | With L6–L7 |

### L1 acceptance

- Raw L0 may live on the owning Situation (`learningEventJson`).
- Shared store holds only `l1_anon` payloads (keys/ids — no free-text PII).
- Cross-user list APIs never return raw contracts, filenames, receipts, A-numbers, emails, phones, or addresses.
- `listProductionPatterns` requires promotion level **4** (empty until L5).
- Check: `npm run test:phase-minus1-9-l1`

### L2 acceptance

- Every meaningful Situation turn emits `capture_enrichment: "l2"` with:
  - `facts_considered` — situation feature keys + ask keys
  - `decision_changing_facts` — keys that change pathway/answer (e.g. `manner_of_entry`)
  - `facts_discarded` / `facts_not_needed_yet` — suppressed early schema asks (e.g. `medical_exam`)
- `negative_learning_records[]` evaluate seeded lessons as `avoided` | `violated` | `not_applicable`
- Canonical Mexico options fixture: medical-exam lesson **avoided**, preferred fact asked, medical exam **discarded**
- Shared anon payloads include `facts_discarded` + `negative_learning` (keys only)
- Check: `npm run test:phase-minus1-9-l2`

### L3 acceptance

- Consultant/admin can submit a structured correction (`incorrect_key`, `preferred_key`, `note_key`, `failure_type`) — institutional keys only, no PII.
- Correction updates owner-scoped experience (`reviewer_correction`) and publishes a **pattern candidate** at promotion level **1**.
- Shared candidate includes `origin: "consultant_correction"` + `correction` summary; never consultant identity or raw narrative.
- Medical-exam → manner-of-entry corrections auto-link `NEG-FAM-ENTRY-MEDICAL-001`.
- L3 **must not** write promotion level 4 or enable Sol Experience Search.
- Check: `npm run test:phase-minus1-9-l3`

### L4 acceptance

- Government outcome signals use institutional keys (`outcome_kind`, `form_or_notice_key`, `authority_keys`) — no receipts/PII.
- **Authority check required** before publish: recognized publisher (USCIS/EOIR/ICE/CBP/DOL/DOS) + ≥1 catalog `authority_key` (not receipt-shaped).
- **Outcome ≠ law:** candidates carry `signal_precedence: historical_experience` and `outranked_by: current_authority`.
- Publishes pattern candidate at promotion level **1** with `origin: "government_outcome"` (same ladder as L3; not production).
- Optional catalog match against active `AuthoritySource.key` when available.
- L4 delivery **must not** write promotion level 4 or enable Sol Experience Search.
- Check: `npm run test:phase-minus1-9-l4`

### L5 acceptance

- Admin Pattern Registry at `/admin/experience` (area `admin.experience`) lists de-identified observations with promotion levels 0–4.
- Admins can set promotion level **0→4** via `promoteExperiencePatternAction` / `setPatternPromotionLevel`.
- Column `promotionLevel` and `anonJson.promotion_level` stay in sync.
- Production (4) requires a reusable signal (correction, outcome, negative lesson, or decision-changing fact) + `decision_target`.
- `listProductionPatterns` still returns only level **4** (empty until an admin promotes).
- No live fine-tuning; no customer Experience Search until L6.
- Check: `npm run test:phase-minus1-9-l5`

---

## Seeded negative lesson

`NEG-FAM-ENTRY-MEDICAL-001` — USC spouse + border entry + options question must not ask medical exam first; manner of entry is controlling. See `src/lib/experience/negative-lessons.ts`.

---

## Checks

- `npm run test:phase-s` includes L0–L5 checks.  
- `npm run test:phase-minus1-9-l1`  
- `npm run test:phase-minus1-9-l2`  
- `npm run test:phase-minus1-9-l3`  
- `npm run test:phase-minus1-9-l4`  
- `npm run test:phase-minus1-9-l5`  
- Future: full `test:phase-minus1-9` when L6+ lands.
