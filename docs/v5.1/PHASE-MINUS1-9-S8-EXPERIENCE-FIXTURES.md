# Phase −1.9 S8 — Experience regression fixtures

**Status:** Shipped  
**Date:** 2026-08-30  
**Parent:** `PHASE-MINUS1-9-EXPERIENCE-INSTITUTIONAL-LEARNING.md`

## Purpose

Single fixture pack that locks Experience / institutional-learning invariants after L0–L7:

1. Canonical Mexico / USC-spouse options → Situation capture, medical exam discarded, negative lesson **avoided**.  
2. Premature medical-exam ask → negative lesson **violated**.  
3. Consultant correction → pattern candidate (level 1), no PII.  
4. Government outcome authority gates (receipt-shaped keys blocked; Outcome ≠ law).  
5. Experience Search ranks **L4 only**; ask hints suppress medical exam.  
6. Stale / non-production patterns are not servable.  
7. Telemetry harm threshold auto-stales.  
8. Prompt block refuses non-production patterns.

No live fine-tuning. Shared payloads use institutional keys only.

## Check

```bash
npx tsx scripts/phase-minus1-9-s8-experience-fixtures-check.ts
# or
npm run test:phase-minus1-9-s8
npm run test:phase-minus1-9   # L0 + L1–L7 + S8
npm run test:phase-s          # includes S8
```

## Pack source

`src/lib/experience/fixture-pack.ts` — `EXPERIENCE_FIXTURE_PACK` / `runExperienceFixturePack()`.
