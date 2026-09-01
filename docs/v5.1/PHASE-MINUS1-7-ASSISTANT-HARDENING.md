# Phase −1.7 — Assistant hardening

**Status:** Ready for merge  
**Date:** 2026-08-29  
**Depends on:** Phase −1 Conversation Intelligence + Model Responsibility Contract on `main`

## Goal

Make Phase −1 contracts **live** under Sol and stop residual schema-fill behavior in Pipeline B clarify / guide handoffs.

## Scope

1. **Question Contract continuity** — persist and refine across Q&A turns (decision target does not reset on every message).
2. **Sol enrichment (optional)** — when heuristic `routing_confidence < 0.80`, call `PRIMARY_REASONING` for a JSON refinement; always fall back to deterministic intelligence.
3. **Clarify / question-planner** — only surface `critical_now` + `changes_branch` need-to-know items aligned to the case Question Contract; suppress schema-fill unknowns that do not help the decision target.
4. **Guide routing** — run Conversation Router; question-shaped → Assistant (`/app/qa`); comprehensive → Case (`/app/cases/new` + forceCase).
5. **Admin diagnostics** — show frozen intelligence snapshot (contract, route, answerability, ask_now) on admin case page.

## Non-goals

- Sibling-product UI (TaxOnMe)  
- New immigration form workflows  
- Staff approval-gate override UI  

## Checks

`npm run test:phase-minus1` (includes `scripts/phase-minus1-7-hardening-check.ts`)

## Delivered

- `mergeWithPrior` / `priorContract` on Q&A turns (`askQuestionAction`)
- `enrichIntelligenceWithReasoningModel` (optional Sol)
- `needToKnowClarifyQuestion` + `unknownHelpsContract` in clarify / question-planner
- Guide Conversation Router handoffs + `forceCase` on `/app/cases/new`
- Admin case diagnostics panel for intelligence snapshot
