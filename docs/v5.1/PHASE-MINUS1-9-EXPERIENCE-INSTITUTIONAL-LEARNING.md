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
| **L0** | ExperienceRecord schema + write on Situation/Q&A/Case turns | Parallel with S1+ |
| **L1** | De-identification; block cross-user raw retrieval | Before any shared store |
| **L2** | Decision-changing vs discarded facts; negative learning records | Parallel with S2+ |
| **L3** | Consultant correction → pattern candidates | After S2 |
| **L4** | Government outcome signals → candidates (authority check) | After S4 helpful |
| **L5** | Pattern Registry admin UI + promotion 0→4 | Before L6 |
| **L6** | Experience Search into Sol (L4 only) | After L5 |
| **L7** | Telemetry: help/harm; stale/authority invalidation | With L6 |
| **S8** | Experience regression fixtures | With L6–L7 |

---

## Seeded negative lesson

`NEG-FAM-ENTRY-MEDICAL-001` — USC spouse + border entry + options question must not ask medical exam first; manner of entry is controlling. See `src/lib/experience/negative-lessons.ts`.

---

## Checks

- `npm run test:phase-s` includes learning-event + negative-lesson assertions.  
- Future: `npm run test:phase-minus1-9` when L5+ lands.
