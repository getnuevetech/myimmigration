# Phase S — Question → Situation → Filing Plan → Case

**Status:** Execution plan — awaiting product approval (do not implement until approved)  
**Date:** 2026-08-30  
**Depends on:** Phase −1 Conversation Intelligence (shipped), V5.1 Case engine A–G (shipped)  
**Domain:** Customer lifecycle / workspace taxonomy (ImmigrationOnMe)

---

## 1. Problem

After V5.1 and Phase −1, the product still conflates:

- “a person has an immigration **problem/question**”
- with “a person has an immigration **case**”

Customer-visible failure mode:

1. User describes a personal situation and asks what options they have (nothing filed).
2. System responds as if opening a full case review / Case analysis.
3. UI mixes “Situation IMM-…” with “YOUR IMMIGRATION CASE.”
4. “One decision-changing question” asks Case-schema completeness items (e.g. medical exam) instead of the fact that changes the pathway branch (e.g. inspected/admitted/paroled vs EWI).

**Root cause:** Phase −1 correctly introduced Assistant vs Case pipelines, but still lacks a first-class **Situation** and **Filing Plan** workspace. Case remains the default container for individualized analysis, and Case-schema unknowns can drive clarify even when the decision target is “identify pathways.”

---

## 2. Non-negotiable principles

Lock these as Phase −1 addenda:

1. A user immigration problem is **not** automatically an immigration case.
2. ImmigrationOnMe must distinguish **Question**, **Situation**, **Filing Plan**, and **Existing Government Case**.
3. A Case must **not** be created merely because a personal immigration question requires individualized analysis.
4. Users asking for help understanding status or possible options remain in a **Situation** workspace.
5. The **application**—not the customer—determines the interaction route from the user’s request.
6. The application must **never** ask a customer to choose an internal pipeline such as “open a case.”
7. If the user has no existing government case but wishes to pursue an identified pathway, ImmigrationOnMe may offer to **Build a Filing Plan**, connect with a consultant, or direct toward the appropriate filing process.
8. Only an **existing filed/government immigration matter** should be represented to the customer as a Case.
9. **Completeness of a Case schema must never be used as a reason to convert a Situation into a Case.**

---

## 3. Target lifecycle

```
USER
 │
 ▼
QUESTION / CONVERSATION
 │
 ▼
SITUATION
 │
 ├──────── Existing government matter ───────────► CASE
 │
 └──────── Wants to pursue an immigration path ─► FILING PLAN
                                                    │
                                                    ▼
                                          Consultant / USCIS filing
                                                    │
                                                    ▼
                                              PREPARATION → FILED → CASE
```

Not every user travels the whole path. The router chooses the workspace silently.

| Workspace | When | Customer language | Engine |
| --- | --- | --- | --- |
| **Question** | One-off Q&A; no personal workspace needed yet | Q&A / Ask | Pipeline A (Assistant / QaThread) |
| **Situation** | Personal narrative + “what are my options / what does my status mean?” | Your Immigration Situation | Situation reasoning (answer-first + pathways + one targeted ask). **Not** V5.1 Case pipeline |
| **Filing Plan** | User chooses to pursue a pathway | Filing Plan / Immigration Plan | Plan builder (eligibility → risks → filings → docs → sequence → consultant / prepare) |
| **Case** | Existing government matter (filed petition, receipt, RFE, interview, court, etc.) | Your USCIS Case (or Immigration Court Case later) | V5.1 Case machinery |

**Do not** call the post-Situation state “Intending Case.” Use **Filing Plan** (or Immigration Plan).

---

## 4. Taxonomy split (do not collapse)

Three separate axes. Interpreter recommends; Router decides workspace.

### 4.1 Interaction intent

`general_question` · `personal_question` · `document_question` · `status_question` · `strategy_question` · `action_request` · `information_only`

(Map from / alongside existing Phase −1 intents; keep domain-neutral where possible.)

### 4.2 Customer state / recommended workspace

`question_only` · `situation` · `filing_plan` · `existing_case`

### 4.3 Response mode

`answer` · `answer_then_targeted_question` · `clarify_first` · `document_needed` · `filing_plan_build` · `case_review`

Retire customer-facing `initiate_case` / “Would you like to open a case?”

### 4.4 Example contract (options narrative)

```json
{
  "intent": "personal_question",
  "customer_state": "situation",
  "question_contract": {
    "question": "What immigration options may be available to me?",
    "decision_target": "identify_possible_pathways"
  },
  "existing_government_case": false,
  "response_mode": "answer_then_targeted_question",
  "recommended_workspace": "situation"
}
```

### 4.5 Decision-changing question (Situation)

Tied to **current decision target**, not Case schema gaps.

```json
{
  "decision_changing_question": {
    "question": "When you entered through the border, were you stopped and processed by U.S. immigration officers before being released into the United States?",
    "why": "The answer can change whether a marriage-based green card may potentially be completed from inside the United States.",
    "changes_branch": true
  }
}
```

**Forbidden on Situation:** asking medical-exam / CaseUnknown completeness because a Case schema field is empty.

**Answer shape:** ~80% useful answer + pathways first; then one fact that narrows the remaining branch.

---

## 5. UI hierarchy

### 5.1 Situation (default for personal options)

- **Your Immigration Situation**
- What you asked
- What this may mean *(actual answer)*
- Paths that may apply
- One fact that changes the path *(targeted question)*
- When you’re ready: **Build my filing plan** · **Talk to an immigration professional** · **Ask another question**

Remove conflicting “YOUR IMMIGRATION CASE” on Situation surfaces. Do not present IMM-#### as a Case identity for Situations.

### 5.2 Case (only when government matter exists)

- Your USCIS Case
- Filing chronology, receipts, status, RFEs/notices, deadlines, correspondence, evidence, procedural events, case strategy
- Offer “Add this to your USCIS Cases” when a receipt / filed matter is detected from conversation or upload

---

## 6. Current codebase gap (grounding)

| Area | Today | Needed |
| --- | --- | --- |
| Router | Binary `assistant` \| `case` (`src/lib/conversation/*`) | Workspace axis: question / situation / filing_plan / existing_case |
| Persistence | `QaThread` + `Case` only (`prisma/schema.prisma`) | Situation + Filing Plan as customer workspaces (see §7 data choice) |
| Intake | `startIntakeAction` / `createCaseAction` route assistant→QaThread else→Case + `runCaseAnalysis` | Situation path must **not** run Case analysis |
| Customer force | `forceCase` checkbox “Run a full case review” | Soft CTAs only; no pipeline picker |
| Clarify | Need-to-know preferred, but CaseUnknown / schema-fill can still win on Case path | Workspace ≠ existing_case ⇒ ignore Case schema completeness |
| Copy | Situation chrome + Case presentation language | Aligned hierarchy §5 |

Acceptance already in Phase −1 (“Border-entry + USC spouse options → no Case”) is incomplete until **Situation** exists as the destination (not only QaThread, not Case).

---

## 7. Data model choice (approval item)

| Option | Approach | Pros | Cons |
| --- | --- | --- | --- |
| **A (recommended)** | Add `workspaceKind` on `Case`: `situation` \| `filing_plan` \| `government_case`; customer language driven by kind | Fast; reuses documents/chat links; minimal migration | Risk of Case machinery leaking if guards are weak |
| **B** | New `Situation` + `FilingPlan` models; Case only for government matters | Cleanest domain model | Larger migration; more UI/routing churn |

**Guard required for Option A:** if `workspaceKind !== government_case`, never run `runCaseAnalysis`, never surface CaseUnknown medical-exam asks, never show “YOUR IMMIGRATION CASE.”

---

## 8. Execution phases

### S0 — Spec lock *(this document)*

- Approve principles, taxonomy, lifecycle, UI, data choice, ship order.
- **No product code until S0 approved.**

### S1 — Router + contracts

**Touch:** `src/lib/conversation/types.ts`, question-contract, intent-interpreter, conversation-router, need-to-know, clarify bridges, intake actions.

- Emit `customer_state`, `recommended_workspace`, `existing_government_case`, `response_mode` separately.
- `identify_available_pathways` / personal options → workspace `situation`, never `existing_case`.
- Government-matter detectors (receipt, I-797, filed I-130/I-485/I-765, RFE/NOID, interview, denial, appeal, EOIR cues) → `existing_case` or offer attach.
- Hard rule: Situation clarify ignores CaseUnknown / schema completeness.
- Pathways need-to-know defaults to manner-of-entry / inspection when relevant.
- Remove or demote customer `forceCase` / “Run a full case review” (staff/test override only if retained).

**Check:** extend `npm run test:phase-minus1` — options fixture → situation workspace; medical exam must not be the ask.

### S2 — Situation workspace surface

- Persist Situation (per §7).
- Customer page hierarchy §5.1.
- Situation engine = Conversation Intelligence + answer-first + pathways + one ask — **not** full V5.1 Case pipeline.
- Guest + auth continuity for Situation (same patterns as QaThread/Case continuity).

### S3 — Filing Plan

- Artifact created only via “Build my filing plan” or clear pursue-path intent (not auto on Situation open).
- Contents: recommended pathway → eligibility → risks/blockers → required filings → documents → sequence → consultant review → prepare for filing.
- CTAs: consultant vs self-file toward USCIS.
- Still not a Case until filed / government matter exists.

### S4 — Case = government matter only

- Case create/attach on matter detection; “Add to your USCIS Cases.”
- V5.1 machinery only here.
- Migrate historical options/situation `Case` rows → `workspaceKind: situation` (or Situation entity); stop Case analysis on them.
- Reserve “Immigration Court Case” label for later EOIR work.

### S5 — Intake / guide / copy cleanup

- Remove pipeline-choice UX; soft CTAs only.
- Align promote paths (Question → Situation → Filing Plan → Case).
- Admin retains internal workspace + diagnostics.

### S6 — Fixtures + regression gate

| Fixture | Expect |
| --- | --- |
| Border + USC spouse + options | Situation; answer then entry question; no Case; no medical exam |
| “Can my wife file for me?” | Question or Situation; no Case |
| “What is an I-862?” | Question only |
| Receipt + I-130 filed | Offer / create USCIS Case |
| Build filing plan CTA | Filing Plan; no Case yet |
| Schema-complete Case with open Situation workspace | Must **not** auto-convert to Case |

Wire into CI alongside `test:phase-minus1` / fixture pack.

---

## 9. Ship order

```
S0 (approve) → S1 → S2 → S5 (copy with S2) → S3 → S4 → S6
```

**Minimum fix for the reported bug:** S1 + S2 (+ S5 copy).  
S3/S4 complete the lifecycle language and Case purity.

---

## 10. Non-goals

- Rewriting V5.1 phases A–G internals.
- Renaming every admin/internal `Case` identifier.
- Full EOIR Court Case product in this program (label reserved only).
- Asking customers to choose pipelines.
- Implementing any S1–S6 code before S0 approval.

---

## 11. Approval checklist

Product / owner — confirm or edit:

- [ ] Principles §2 are non-negotiable Phase −1 addenda
- [ ] Data model: **Option A** (`workspaceKind`) or **Option B** (new Situation/FilingPlan models)
- [ ] Ship **S1+S2 first** before Filing Plan entity (S3)
- [ ] Remove customer **forceCase / “full case review”** in favor of Filing Plan / consultant CTAs
- [ ] Historical IMM-* situation-shaped Cases: **reclassify to Situation** (hide Case UI) vs leave as historical Case chrome
- [ ] Any naming preference: “Filing Plan” vs “Immigration Plan”

**After approval:** implement on `cursor/situation-filing-plan-*-c431` starting at S1, with PR per phase (or S1+S2 combined if preferred).

---

## 12. Traceability

| Source | How this plan addresses it |
| --- | --- |
| “Not automatically a Case” | Principles 1–3, 8–9; S1 routing; S4 gate |
| Question / Situation / Filing Plan / Case | §3 lifecycle; taxonomy §4 |
| Router decides, not customer | Principle 5–6; remove forceCase UX |
| Answer then one branch-changing ask | §4.5; S1 need-to-know; S2 UI |
| Medical-exam nonsense | Principle 9; S1 hard rule ignore CaseUnknown on Situation |
| UI hierarchy | §5; S2/S5 |
| V5.1 belongs on real Cases | §3 Case row; S4 |
