# Phase S6 — Consolidated workspace regression gate

**Status:** Shipped  
**Date:** 2026-08-30  
**Parent:** `PHASE-S-SITUATION-FILING-PLAN-EXECUTION.md`

## Purpose

Single regression entry that locks the customer-visible Phase S invariants after S1–S4:

1. Canonical Mexico / USC-spouse options → **Situation** (not Case / not V5.1 / not medical exam).  
2. `existing_case` + document question → answer, **not** `case_review`.  
3. Pending matter + full strategy → `case_review`.  
4. Filing Plan buildable from Situation pathways without Case.  
5. Legacy options narrative would reclassify to Situation.  
6. Product surfaces: Situation / Filing Plan chrome; no customer `forceCase`.

## Check

```bash
npx tsx scripts/phase-s6-workspace-regression-check.ts
# or
npm run test:phase-s6
npm run test:phase-s   # includes S6
```
