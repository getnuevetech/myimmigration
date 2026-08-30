# Phase S — Question → Situation → Filing Plan → Case  
# (+ Phase −1.9 / S7 Experience & Continuous Learning)

**Status:** **S0 APPROVED** (2026-08-30) with mandatory amendments — proceed S0 → S1 → S2  
**Revision:** 3 — locked approval decisions + two architectural amendments  
**Depends on:** Phase −1 Conversation Intelligence, Model Responsibility Contract, V5.1 Case engine + governance  

---

## S0 lock — approval decisions

| Ask | Decision |
| --- | --- |
| Principles as Phase −1 addendum | **YES** — lock. Government matter may be **USCIS, EOIR, ICE/CBP/removal-related**, not only a filed USCIS form. |
| Option A vs Situation model | **Option B — first-class Situation entity** (permanent architecture). Do **not** store Situations as disguised Case rows. |
| Ship S1 + S2 before Filing Plan | **YES** |
| Remove customer forceCase / full case review | **YES** — admin/diagnostic override only if needed. Customer language reflects actual state. |
| Existing IMM situation rows | **Reclassify** to Situation when no government matter; genuine matters remain Cases. Preserve `legacyCaseId` / audit fields. |

### Mandatory amendment 1 — workspace ≠ analysis depth

**Workspace state never determines analysis depth by itself. Response mode determines which reasoning engine is invoked.**

`customer_state = existing_case` must **NOT** automatically invoke full V5.1.

Axes stay separate:

| Axis | Answers |
| --- | --- |
| `customer_state` / workspace | What does the user have? |
| Interaction intent | What are they asking? |
| `response_mode` | What should we do **now**? |

Examples:

```json
{
  "intent": "document_question",
  "customer_state": "existing_case",
  "existing_government_case": true,
  "response_mode": "answer",
  "recommended_workspace": "existing_case"
}
```
→ Read the notice; **do not** run full Case analysis.

```json
{
  "intent": "status_question",
  "customer_state": "existing_case",
  "response_mode": "answer"
}
```
→ e.g. “When is my interview?”

```json
{
  "intent": "strategy_question",
  "customer_state": "existing_case",
  "response_mode": "case_review"
}
```
→ Only then: chronology / fact ledger / risks / full V5.1 strategy.

Government-matter detection (receipt, I-797, filed forms, RFE, NOID, interview, denial, appeal, EOIR, ICE/CBP/removal cues) may set `existing_government_case` / workspace — it does **not** by itself mean `case_review`.

CTA language when persistence is needed: **“Track this USCIS case”** (not “Open a case”). Classification is the app’s job; the CTA is persistence/action, not architecture choice.

### Mandatory amendment 2 — first-class Situation (Option B)

```
QaThread (Question interaction)
    │
    ▼
Situation
    │
    ├────────► FilingPlan
    │
    └────────► Case (government matter; optional situationId link)
```

Conceptual shapes:

- **Situation** — narrative, question contract, decision target, known facts, pathways, risks, status  
- **FilingPlan** — pathway, eligibility, blockers, filings, evidence, sequence, preparation  
- **Case** — governmentSystem, caseType, receipt, form, filedDate, status, V5.1 machinery  

Question is **not** a heavy DB workspace: it remains `QaThread`. Personal circumstances + decision target mature into **Situation**.

### Architecture sentence (locked)

> Question tells us what the person wants. Situation tells us what is happening. Filing Plan tells us what they intend to pursue. Case tells us what is actually before the government. Response Mode tells the AI what work to perform right now.

---

## Principles (locked)

### Workspace / Case

1. Immigration problem ≠ automatic Case.  
2. Distinguish Question, Situation, Filing Plan, Existing Government Case.  
3. Do not create Case merely for individualized analysis.  
4. Options / status understanding → Situation.  
5. App routes; customer never picks an internal pipeline.  
6. Never ask “open a case?”  
7. No government matter + pursue path → Filing Plan / consultant / filing guidance.  
8. Only existing government matter (USCIS / EOIR / ICE/CBP/removal-related) → customer-facing Case.  
9. Case-schema completeness must never convert Situation → Case.

### Experience & Learning

10. Learn patterns/decision logic/corrections/outcomes — **not identities**.  
11. No live Sol/Opus fine-tuning from traffic.  
12. Authority > reviewed rule > validated pattern > history > model inference.  
13. Outcome ≠ law; promotion requires authority + multi-case + review.  
14. Negative learning required.

### Analysis depth (new)

15. **Response mode controls engine invocation; workspace alone never triggers full V5.1.**

---

## Lifecycle

```
QUESTION (QaThread; may terminate here)
   │
   ▼
SITUATION
   │
   ├─ continue understanding
   ├─ FILING PLAN → preparation → filed ─┐
   └─ government matter detected ────────┴──► CASE
```

---

## Four-layer architecture

Sol → Experience Search → Sol reasoning → Opus (docs) + Authorities → Governance → Presentation (Sol) → User → Experience & Learning Layer.

Capture **learning events from day one** (S1); Pattern Registry / retrieval is **S7 / Phase −1.9** (does not block S1/S2).

---

## Canonical S0 fixture (product invariant)

**INPUT**

> I came in from Mexico through the border and been living in the US for 3 years, my wife is a US citizen and our daughter was born in the US, I am yet to file for any document, what are my options?

**Expected intelligence**

```json
{
  "intent": "personal_question",
  "customer_state": "situation",
  "existing_government_case": false,
  "recommended_workspace": "situation",
  "response_mode": "answer_then_targeted_question",
  "decision_target": "identify_possible_pathways"
}
```

**Prohibited**

- create Case / run full V5.1  
- ask medical exam / priority date  
- request passport before answering  
- ask customer to choose whether to open Case  
- begin marriage evidence checklist  

**Required**

- answer options; explain branches  
- manner of entry as controlling unknown; one targeted entry question  
- stay in Situation; offer Filing Plan later  

**S1 build fails if** `recommended_workspace = existing_case` or medical-exam ask before entry resolved.  
**S2 build fails if** customer sees “YOUR IMMIGRATION CASE” for this fixture.

---

## Ship order (approved)

```
S0 (locked)
 ↓
S1  — router axes; response_mode → engine; learning-event hooks; canonical fixture tests
 ↓
S2 + customer-facing S5  — Situation entity; Situation UI; remove forceCase UX; no Case chrome on Situation
 ↓
S3  — Filing Plan
 ↓
S4  — Case = government matter; migrate legacy IMM rows (default uncertain → Situation)
 ↓
remaining S5
 ↓
S6  — consolidated regression gate
 ↓
S7 / −1.9 — Experience engine consuming historical learning events
```

Each phase ships with its own tests. S6 is the final consolidated gate.

Learning-event shape (emit from S1; engine later):

```json
{
  "question_contract": "...",
  "workspace_selected": "situation",
  "decision_target": "identify_possible_pathways",
  "pathways_considered": ["A", "B"],
  "clarification_selected": "manner_of_entry",
  "clarification_reason": "...",
  "questions_suppressed": ["medical_exam", "priority_date"],
  "response_mode": "answer_then_targeted_question",
  "invokes_case_engine": false
}
```

---

## Data model (Option B — locked)

```
Situation { id, userId?, guestSessionId?, title, originalNarrative, goal, questionContractJson,
  currentDecisionTarget, knownFactsJson, currentPathwaysJson, currentRisksJson, status,
  intelligenceJson, learningEventJson, legacyCaseId?, legacyRecordType?, migrationTimestamp?, ... }

FilingPlan { id, situationId, selectedPathway, ... }   // S3

Case { ..., situationId?, governmentSystem, ... }     // V5.1; only government matters
```

Migration: government matter established? YES→Case, NO/UNKNOWN→Situation (default Situation). Retain legacy IDs.

---

## Non-goals

- Option A permanent architecture  
- `existing_case` ⇒ auto V5.1  
- Customer pipeline picker / forceCase  
- Live model fine-tuning  
- Blocking S1/S2 on full S7 learning engine  

---

## Proceed

**S0 approved with amendments. Implement S1 → S2 (+ customer S5).**
