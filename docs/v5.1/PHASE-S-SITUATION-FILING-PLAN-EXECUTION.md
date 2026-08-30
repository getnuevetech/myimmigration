# Phase S — Final Locked Execution Program

**Status:** **S0 LOCKED / AUTHORIZED** (2026-08-30)  
**Revision:** 4 — final §13 approval (Option B target architecture)  
**Proceed:** S0 → S1 → S2 + customer S5; L0–L2 parallel (capture only)  
**Experience umbrella:** Phase −1.9 — Experience & Institutional Learning  

---

## §13 Approval (locked)

| Decision | Approval |
| --- | --- |
| Workspace principles | **YES — LOCK** |
| Workspace data model | **Option B:** first-class Situation + FilingPlan models |
| S1 + S2 first | **YES** |
| Remove customer-facing forceCase / “full case review” | **YES** |
| Historical reclassification | **YES** — reclassify situation-only records |
| Filing Plan naming | **YES** |
| Experience principles | **YES — LOCK** |
| Experience architecture phase ID | **YES — −1.9** |
| L0–L2 parallel with S work | **YES** |
| Production retrieval | **L4 Production patterns only** |
| Seed medical-exam negative lesson | **YES** |

### Option B (not Option A)

**Rejected as target:** `Case.workspaceKind = situation | filing_plan | government_case`.

**Approved target:**

```
QaThread
    │
    ▼
Situation
    │
    ├──────────────► FilingPlan
    │                    │
    │                 preparation
    │                    │
    │                   filed
    │                    │
    └────────────────────┴────► Case
```

A Case may reference the originating Situation / Filing Plan for continuity and audit.

Temporary reads of legacy Case rows during S1/S2 are allowed as a **compatibility bridge only**. Option A must not become the durable domain model.

---

## Principles (locked)

### Workspace

1. Problem ≠ Case.  
2. Distinguish **Question → Situation → Filing Plan → Existing Government Case**.  
3. The application determines the workspace **silently** from what the customer is asking and what government matter exists.  
4. Never ask “Do you want to open a case?”  
5. A personal immigration question requiring individualized reasoning is still **not** a Case.  
6. Wanting to pursue an identified path → **Filing Plan**.  
7. Customer-facing Case only when an **actual government immigration matter** exists (USCIS, EOIR, ICE/CBP/removal-related — not only a filed USCIS form).  
8. Case-schema completeness must **never** cause Situation → Case promotion.

### Analysis depth invariant

> **Workspace determines where the customer is. Response mode determines what AI work happens now.**

Therefore: `existing_case ≠ automatically run V5.1`.

Example: existing USCIS matter + “What does this notice mean?” →

```json
{
  "workspace": "existing_case",
  "intent": "document",
  "response_mode": "answer"
}
```

Full V5.1 runs only when the current request calls for `case_review`.

### Experience

9. Every interaction should make ImmigrationOnMe more capable **without** exposing one customer’s identity or private records to another.  
10. No automatic live fine-tuning of Sol or Opus from production traffic.  
11. Precedence: CURRENT AUTHORITY > REVIEWED INTERNAL RULE > VALIDATED PRODUCTION PATTERN > HISTORICAL EXPERIENCE > MODEL INFERENCE.  
12. Outcome ≠ law.  
13. Negative learning required; medical-exam premature ask is the first seeded failure pattern.  
14. Only **L4 Production** patterns influence ordinary production retrieval.

---

## Lifecycle

```
QUESTION
   │
   ▼
SITUATION
   │
   ├──── Existing government matter ─────────────► CASE
   │
   └──── Wants to pursue pathway
                    │
                    ▼
               FILING PLAN
                    │
                    ▼
               PREPARATION
                    │
                    ▼
                  FILED
                    │
                    ▼
                   CASE
```

Not every customer moves through every state. Question may terminate as QaThread.

---

## Three independent routing axes

| Axis | Values |
| --- | --- |
| Interaction intent | `general` · `personal` · `document` · `status` · `strategy` · `action` · `info_only` |
| Workspace | `question_only` · `situation` · `filing_plan` · `existing_case` |
| Response mode | `answer` · `answer_then_targeted_question` · `clarify_first` · `document_needed` · `filing_plan_build` · `case_review` |

---

## Four-layer intelligence architecture

```
                           USER
                            │
                            ▼
                      OPENAI SOL
              Question / Conversation Brain
                            │
                   Workspace + Intent
                            │
                            ▼
                    EXPERIENCE SEARCH
                  "Seen this pattern?"
                            │
                            ▼
                      SOL REASONING
       Question + facts + authorities + patterns
                      /              \
                     /                \
                    ▼                  ▼
             CLAUDE OPUS          AUTHORITIES
          Document Evidence
                    \                  /
                     └────────┬────────┘
                              ▼
                         GOVERNANCE
                              │
                              ▼
                     SOL PRESENTATION
                              │
                              ▼
                            USER
                              │
                              ▼
                    EXPERIENCE CAPTURE
```

| Role | Owns |
| --- | --- |
| **Sol** | Conversation, question contract, reasoning, need-to-know, strategy, synthesis, presentation |
| **Opus** | Document classification, extraction, interpretation, evidence, provenance |
| **Governance** | Routing enforcement, schemas, evidence ledger, authority precedence, locks, stale/invalidation, pattern promotion, audit |
| **Experience (−1.9)** | Capture → de-ID → patterns → L4 retrieval (retrieval gated) |

Learning path:

```
Interaction → ExperienceRecord → De-identification → Observation/Candidate
  → Validation → Review → Production Pattern → Retrieval
```

Pattern promotion: **L0 → L1 → L2 → L3 → L4**. Only L4 in production retrieval.

---

## Canonical negative-learning fixture (seeded)

```
FAILURE PATTERN

Situation:
USC spouse + border entry + no filing
+ asks "what are my options?"

Bad behavior:
Ask about medical exam first.

Failure reason:
Medical-exam completeness did not determine
the user's immediate pathway.

Correct behavior:
Explain primary pathways first.
Identify inspection/admission/parole as
the controlling unknown.
Ask targeted border-processing question.

Rule:
Case-schema completeness must never outrank
the current Question Contract.
```

Code seed: `src/lib/experience/negative-lessons.ts` · pattern id `NEG-FAM-ENTRY-MEDICAL-001`.

---

## Canonical regression fixture (permanent)

**Input:**  
“I came in from Mexico through the border and been living in the US for 3 years, my wife is a US citizen and our daughter was born in the US, I am yet to file for any document, what are my options?”

**Required:**

```json
{
  "intent": "personal",
  "workspace": "situation",
  "existing_government_case": false,
  "response_mode": "answer_then_targeted_question",
  "decision_target": "identify_possible_pathways"
}
```

**Must:** answer first · explain branches · manner of entry controlling · ≤1 targeted entry ask · remain Situation · Filing Plan only when pursuing a path.

**Must not:** create Case · run full V5.1 · medical exam · priority date · passport before answer · “open a case?” · marriage evidence checklist · promote for schema incompleteness.

---

## Ship sequence (authorized)

```
S0 (locked)
 │
 ▼
S1  Router + contracts          ← shipped
 │
 ▼
S2  Situation workspace         ← shipped
 │
 ├────► S5 customer-facing copy/intake cleanup  ← partial (forceCase removed)
 │
 ▼
S3  Filing Plan                 ← shipped (build from Situation; not a Case)
 │
 ▼
S4  Government Case lifecycle + migration  ← shipped (reclassify CLI + keep Case only for government matter)
 │
 ▼
S6  Consolidated workspace regression  ← shipped (`test:phase-s6` / included in `test:phase-s`)
```

**Parallel (after S0):**

```
L0–L2  Capture · De-ID · What-mattered · Negative-learning records  ← L0–L2 shipped
  │
  ▼
L3–L5  Corrections · Outcomes · Pattern Registry  ← L3–L5 shipped (admin promotion 0→4)
  │
  ▼
L6–L7 + S8  Production Experience Search (L4-only) · Experience fixtures  ← L6–L7 shipped
```

**Minimum customer fix:** S1 + S2 + customer-facing S5. Do not wait for Filing Plan or Experience Search.

### S3 acceptance

- “Build my filing plan” from Situation creates a `FilingPlan` row linked to the Situation.
- Plan shows pathway → eligibility → blockers → filings → documents → sequence → consultant / self-file CTAs.
- Must **not** create Case or run `runCaseAnalysis`.
- Check: `npm run test:phase-s` includes `phase-s3-filing-plan-check`.

### S4 acceptance

- Case engine only when `response_mode = case_review` (government matter + strategy review).
- Legacy IMM rows without government signals → Situation (`legacyCaseId` retained); uncertain defaults to Situation.
- CLI: `npm run reclassify:legacy-cases` (dry-run) / `--apply` to write.
- Check: `phase-s4-case-lifecycle-check`.

### S6 acceptance

- Consolidated gate: `scripts/phase-s6-workspace-regression-check.ts` / `npm run test:phase-s6`.
- Spec: `docs/v5.1/PHASE-S6-WORKSPACE-REGRESSION.md`.

### L0 capture shape (emit every meaningful turn)

```json
{
  "question_contract": {},
  "workspace": "situation",
  "decision_target": "identify_possible_pathways",
  "facts_considered": [],
  "decision_changing_facts": [],
  "facts_not_needed_yet": [],
  "pathways_considered": [],
  "clarification_selected": {},
  "clarifications_suppressed": [],
  "documents_used": [],
  "authority_ids": [],
  "answer_changed_after_clarification": false,
  "model_correction": null,
  "reviewer_correction": null,
  "outcome": null
}
```

Capture now; learn later. No customer retrieval until L4.

---

## Authorization

**S0 is approved.**

Proceed: S0 spec lock → S1 → S2 + relevant S5.  
In parallel: L0–L2 capture + de-identification only.  
Do **not** enable experience retrieval in customer reasoning until L4 Production.

Phase −1.9 is the umbrella specification for the L-series (`docs/v5.1/PHASE-MINUS1-9-EXPERIENCE-INSTITUTIONAL-LEARNING.md`).
