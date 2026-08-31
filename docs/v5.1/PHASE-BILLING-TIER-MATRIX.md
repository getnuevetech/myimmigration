# Phase Billing — Free / Plus / Pro filing & forms matrix

**Status:** Shipped (implementation)  
**Date:** 2026-08-31  
**Scope:** Plan gates for Filing Plan builds and USCIS form wizards/downloads so Plus is not the unlimited end-to-end toolkit.

## Product rule

| Plan | Situations / explore | Filing Plan build (`filing_plan.build`) | Form wizards (`forms.wizard`) | Form downloads (`forms.download`) |
|------|----------------------|-----------------------------------------|-------------------------------|-----------------------------------|
| **Free** | Yes (existing Free caps) | No | No | No |
| **Plus** | Yes | **2 / calendar month** | **2 / calendar month** | **1 / calendar month** |
| **Pro** | Yes | Unlimited | Unlimited | Unlimited (+ consultant referral) |

Guests may create Situations but must register and upgrade to Plus (or Pro) before building a Filing Plan.

## Implementation

- Feature key: `FEATURE_KEYS.FILING_PLAN_BUILD` → `filing_plan.build`
- Quotas: `src/lib/billing-quotas.ts` (UTC calendar month)
- Gates: `createFilingPlanAction`, `startFormAction`, `/api/forms/[id]/download`
- Seed corrective matrix in `prisma/seed.ts` (upserts enabled + limits on re-seed)
- Public copy: `PUBLIC_PLAN_DESCRIPTIONS` in `src/lib/goal-public.ts`

## Host note (production Digest)

Signed-in `/app` white-screens if Situation / Experience migrations are missing. Dashboard Situation queries are isolated with `.catch()`. Probe: `GET /api/health` → `schemaReady` + `schema` + `hint`. Fix: `npx prisma migrate deploy` (or rebuild Docker so entrypoint migrates), then restart.

## Check

```bash
npx tsx scripts/phase-billing-tier-matrix-check.ts
# or
npm run test:phase-billing
npm run test:phase-s   # includes billing check
```
