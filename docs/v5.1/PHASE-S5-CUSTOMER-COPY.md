# Phase S5 — Customer-facing copy / intake cleanup

**Status:** Shipped  
**Date:** 2026-08-30  
**Parent:** `PHASE-S-SITUATION-FILING-PLAN-EXECUTION.md`

## Purpose

Finish customer chrome so the product matches Phase S workspace principles:

1. Never ask “Do you want to open a case?”  
2. Options / pre-filing → **Situation** language.  
3. **Case** only when a government immigration matter exists.  
4. No customer `forceCase` intake control.  
5. Drop “full case review” as a customer CTA / guide phrase.

## Check

```bash
npx tsx scripts/phase-s5-customer-copy-check.ts
# or
npm run test:phase-s5
npm run test:phase-s   # includes S5
```
