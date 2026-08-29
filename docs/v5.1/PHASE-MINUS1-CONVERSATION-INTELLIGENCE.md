# Phase −1 — Conversation Intelligence

**Status:** Implemented on branch — awaiting merge  
**Date:** 2026-08-29  
**Sequence:** before any further immigration-static workflows; sits in front of V5.1 Case engine  
**Domain:** Domain-neutral conversational layer (ImmigrationOnMe / future TaxOnMe share this contract)
**Checks:** `npm run test:phase-minus1`

## Diagnosis (locked)

V5.1 case machinery is not wrong. The mistake was making it the **default conversational engine**.  
The product must **understand and answer the user’s question** before deciding whether to develop a case.

## Target architecture

```
USER MESSAGE
     │
     ▼
PHASE −1 CONVERSATION INTELLIGENCE
     │
┌────┼────┐
▼    ▼    ▼
QUESTION  INTENT  USER GOAL
CONTRACT  INTERPRETER
     │
     ▼
ANSWERABILITY
     │
     ▼
NEED-TO-KNOW  (+ impact: changes_branch)
     │
     ▼
BRANCH ANALYSIS  (BRANCH_BEFORE_CLARIFY)
     │
     ▼
RESPONSE STRATEGY
     │
     ▼
CONVERSATION ROUTER   ← sole authority for pipeline choice
  /               \
 ▼                 ▼
PIPELINE A         PIPELINE B
ASSISTANT          CASE ENGINE (V5.1)
Answer current Q   Fact ledger / locks / gate / ceilings
Explain branches   Documents as evidence
Targeted asks      Case analysis
     │
     └──► explicit / contextual promotion only
```

**Pipeline A is not a lite Case.** It is a first-class product experience (Q&A / assistant thread).

## Six amendments (contracts)

1. **Question Contract** — persistent representation of the decision target; every ask must help resolve it.
2. **Interpreter recommends; Router decides** — `recommended_pipeline` + confidence; never a direct pipeline decree from the interpreter.
3. **Need-to-Know impact** — every clarification must declare `changes_branch`, `reason`, `branches_affected`; composer may only ask `critical_now` with `changes_branch: true`.
4. **BRANCH_BEFORE_CLARIFY** — if a material unknown yields a manageable set of legally meaningful branches, present branches **before** asking.
5. **Upload alone ≠ Case** — document content + *what the user asked to do with it* decide; “what does this mean?” stays Assistant.
6. **Answer-first on Case is MUST** — for question-shaped case narratives, customer presentation MUST show answerable content / provisional pathways / issue explanation **before** clarification UI, unless `clarify_first_required=true` with justification.

## Question Contract (required)

```json
{
  "question_contract": {
    "explicit_question": "What are my immigration options?",
    "interpreted_question": "What immigration pathways may be available based on USC spouse and manner of entry?",
    "decision_target": "identify_available_pathways",
    "current_scope": "pre-filing immigration options",
    "user_requested_action": false,
    "requires_case_development": false
  }
}
```

Downstream rule: *Do not collect a fact merely because it is legally relevant. Collect it only if it is necessary to resolve the current decision target.*

## Intent (interpreter output, not routing)

Intents include: general_legal, personal_eligibility, procedural, document_interpretation, strategy_comparison, status_update, risk, take_action, information_only, comprehensive_case_review.

Interpreter emits `recommended_pipeline`, `recommended_response_mode`, `routing_confidence` — **recommendations only**.

## Answerability

```json
{
  "fully_answerable": false,
  "partially_answerable": true,
  "requires_clarification": true,
  "requires_document": false,
  "clarify_first_required": false,
  "clarify_first_reason": ""
}
```

`clarify_first` is **rare**: only when any substantive answer would be materially misleading. Default is `answer` or `answer_then_targeted_questions`.

`requires_document=true` only when the asked task cannot produce a useful framework without the document (e.g. “read this notice” with no pasted text and no upload). A document that *increases confidence* does not force `requires_document`.

## Need-to-Know + BRANCH_BEFORE_CLARIFY

```json
{
  "question": "Were you inspected/paroled, or did you enter without inspection?",
  "tier": "critical_now",
  "reason": "Determines whether adjustment inside the U.S. may be available.",
  "changes_branch": true,
  "branches_affected": ["adjustment_of_status", "consular_processing"]
}
```

Composer **must not** ask `tier: later` or `changes_branch: false` in the current turn.

When `branches` length is 2–4 and explainable: emit branch explanations first, then at most one critical question.

## Conversation Router (actual pipeline)

Inputs: question contract, answerability, need-to-know, strategy, documents meta (count + user ask), confidence.

| Signal | Route |
| --- | --- |
| `decision_target` = explain notice/form / options / can spouse file | **assistant** |
| Explicit comprehensive review / “what should I file” / full strategy | **case** |
| Document uploaded + ask = explain/compare/interpret | **assistant** |
| Document uploaded alone | **never** case |
| `requires_case_development` true on contract after contextual analysis | **case** |
| Low confidence + question-shaped | **assistant** (default safe) |

## A→B promotion

Allowed when:
- User explicitly requests case / full strategy / “review my entire situation and tell me what to file”, **or**
- Question contract flips to `requires_case_development` because the *requested task* needs broad eligibility/bars/timeline work

**Forbidden:** upload of notice/receipt pack by itself.

## Phase −1.5 Case contract

For question-shaped Case narratives (`requires_case_development` was false at intake but user forced case, or narrative is still question-shaped):

- Customer presentation **MUST** contain answerable portion / provisional pathways / issue explanation **before** the clarification block.
- Exception only if Answerability has `clarify_first_required=true` with reason.

## Acceptance tests (customer-visible)

| User message | Expected |
| --- | --- |
| Can my USC wife file for me? | Answer yes + limitation; ≤1 targeted Q; **no Case** |
| Border-entry + USC spouse options | Pathways first; entry question after; **no Case** |
| What is an I-862? | Explain; no intake |
| Upload I-862 + what does this mean? | Interpret; **no auto Case** |
| Review my entire immigration situation and tell me what I should file | Case OK |
| 15 facts, no question | Infer intent / useful interpretation; no schema dump |
| What documents for marriage green card? | Answer list; don’t demand uploads |
| IRS letter can’t pay (shared contract) | Options first; targeted later |
| Upload CP503 + what is this? | Explain; Assistant |
| Build strategy for IRS 2022–2025 balances | Case/promote OK |

## Delivery order

`−1.0 → −1.1 → −1.2 → −1.3 → −1.4 → −1.5 → −1.6` — each fully executed.

## Out of scope

- TaxOnMe product UI (shared contract shape only)
- Replacing V5.1 locks / fact ledger / approval gate
- New immigration form workflows
