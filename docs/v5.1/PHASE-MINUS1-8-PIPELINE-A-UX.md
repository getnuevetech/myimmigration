# Phase −1.8 — Pipeline A UX polish

**Status:** Implementing  
**Date:** 2026-08-29  
**Depends on:** Phase −1.7 Assistant hardening on `main`

## Goal

Make Pipeline A (Assistant) feel like a first-class product surface — structured answers, visible decision focus, frictionless guide handoff, and an explicit A→B promotion path — without turning Q&A into a lite Case dashboard.

## Scope

1. **Structured answer UI** — branches, the single critical ask, and disclaimer render as composition blocks (no raw `**markdown**`).
2. **Thread focus chrome** — show the current interpreted question / decision focus from stored intelligence on the Q&A thread.
3. **Guide → Assistant prefill** — handoff to `/app/qa?q=…` with the user’s question ready to send.
4. **Promote to case CTA** — after an assistant answer (no linked case), offer an explicit “full case review” path that never triggers from upload alone.
5. **Starter prompts** — empty-state examples aligned with Phase −1 acceptance messages.

## Non-goals

- TaxOnMe UI  
- Approval-gate override UI  
- Posture rename (`PRIMA_FACIE_PENDING`)  
- New immigration form workflows  

## Checks

`npm run test:phase-minus1` + `scripts/phase-minus1-8-pipeline-a-ux-check.ts`
