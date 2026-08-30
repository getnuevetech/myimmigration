# Phase S — Question → Situation → Filing Plan → Case  
# (+ Phase −1.9 Experience & Continuous Learning Layer)

**Status:** Final execution plan — awaiting product approval (do not implement until approved)  
**Date:** 2026-08-30  
**Revision:** 2 — adds Experience & Learning as fourth architectural layer  
**Depends on:** Phase −1 Conversation Intelligence (shipped), Model Responsibility Contract (Sol / Opus / Presentation), V5.1 Case engine A–G + governance (shipped)  
**Domain:** Customer lifecycle / workspace taxonomy + institutional experience memory (ImmigrationOnMe)

**Phase ID note:** Product commentary labeled Experience & Learning as “Phase −1.7.” That ID is already taken by **Assistant Hardening** (`PHASE-MINUS1-7-ASSISTANT-HARDENING.md`). This plan uses **Phase −1.9** for Experience & Learning to avoid collision. Rename on approval if preferred.

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

**Root cause (workspace):** Phase −1 introduced Assistant vs Case pipelines but lacks first-class **Situation** and **Filing Plan** workspaces. Case remains the default container for individualized analysis.

**Root cause (learning):** The product does not yet accumulate reusable “what mattered” intelligence across Situations/Cases. Sol rediscovers conversational strategy from zero each time; failure modes (e.g. premature medical-exam asks) are not captured as negative learning.

---

## 2. Non-negotiable principles

### 2.1 Workspace / Case principles (Phase −1 addenda)

1. A user immigration problem is **not** automatically an immigration case.
2. ImmigrationOnMe must distinguish **Question**, **Situation**, **Filing Plan**, and **Existing Government Case**.
3. A Case must **not** be created merely because a personal immigration question requires individualized analysis.
4. Users asking for help understanding status or possible options remain in a **Situation** workspace.
5. The **application**—not the customer—determines the interaction route from the user’s request.
6. The application must **never** ask a customer to choose an internal pipeline such as “open a case.”
7. If the user has no existing government case but wishes to pursue an identified pathway, ImmigrationOnMe may offer to **Build a Filing Plan**, connect with a consultant, or direct toward the appropriate filing process.
8. Only an **existing filed/government immigration matter** should be represented to the customer as a Case.
9. **Completeness of a Case schema must never be used as a reason to convert a Situation into a Case.**

### 2.2 Experience & Learning principles (Phase −1.9 addenda)

10. **Every interaction should leave ImmigrationOnMe more capable than it was before**, but **no individual user’s private information should become another user’s knowledge**. The system learns reusable patterns, decision logic, corrections, and outcomes—**not identities**.
11. Production must **not** auto-train / fine-tune Sol or Opus weights from live cases. Learning is **structured → de-identify → pattern → validate → retrieve**.
12. **Authority always outranks experience:**

```
LAW / OFFICIAL AUTHORITY
         >
REVIEWED INTERNAL RULE
         >
VALIDATED EXPERIENCE PATTERN
         >
HISTORICAL CASE
         >
MODEL INFERENCE
```

13. **Outcome ≠ law.** One RFE/approval/denial is an experience signal, not an automatic rewrite of legal rules. Promotion requires authority check + multi-case confirmation + review.
14. **Negative learning is required.** Useless/wrong asks (e.g. medical exam for “what are my options?”) must be recorded as failure lessons, not only successes.

---

## 3. Target customer lifecycle

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

## 4. Four-layer architecture (Sol · Opus · Governance · Experience)

Experience is a **fourth architectural layer** alongside Sol, Opus, and the deterministic governance engine. It is **not** live weight training on every user case.

```
                    USER
                     │
                     ▼
               OPENAI SOL
         Conversation / Reasoning
                     │
        ┌────────────┴────────────┐
        ▼                         ▼
  Situation / Question       Existing Case
        │                         │
        └────────────┬────────────┘
                     ▼
              EXPERIENCE SEARCH
          "Have we seen something
             like this before?"
                     │
                     ▼
              Relevant Patterns
                     │
                     ▼
              SOL REASONING
           (question + facts +
            authorities + patterns)
                     │
            ┌────────┴─────────┐
            ▼                  ▼
       CLAUDE OPUS       Authorities / Rules
       Documents              │
            └────────┬─────────┘
                     ▼
              GOVERNANCE
         (locks, approval gate,
          ceilings, promotion rules,
          anonymization, audit)
                     │
                     ▼
               PRESENTATION
                    SOL
                     │
                     ▼
                   USER
                     │
                     ▼
          AFTER EACH INTERACTION
                     │
                     ▼
          EXPERIENCE & LEARNING
                  LAYER
```

### 4.1 Model roles with Experience

| Layer | Role with Experience |
| --- | --- |
| **Sol (PRIMARY_REASONING)** | Receives current question + facts + current authorities + **retrieved validated patterns**; reasons; owns route/clarify strategy. Benefits most from Experience Search. |
| **Opus (DOCUMENT_INTELLIGENCE)** | Produces document evidence; may contribute document-layout/findings patterns. Does **not** decide user route or workspace. |
| **Governance** | Controls what enters shared experience; anonymization; pattern promotion levels; authority precedence; stale knowledge; confidence; audit trail. |
| **Presentation (Sol)** | Customer-facing copy; may cite pattern-informed structure, never another user’s private facts. |

### 4.2 What “learn” means (and does not)

| Do **not** (initial / production default) | Do |
| --- | --- |
| Case closes → automatically fine-tune Sol/Opus → weights change | Case/Situation → Structured Experience Record → De-identification → Pattern extraction → Validation → Experience Knowledge Base → Retrieved during future reasoning |
| Opaque model updates from live traffic | Inspectable admin rationale: matched pattern ID, similarity, N validated situations, review status, authority status |

Later offline evaluation / specialized tuning from a **reviewed** corpus is a separate controlled process—not live training.

---

## 5. Taxonomy split (do not collapse)

Three separate axes for routing. Interpreter recommends; Router decides workspace. Experience patterns inform Need-to-Know and response strategy; they do **not** replace the router.

### 5.1 Interaction intent

`general_question` · `personal_question` · `document_question` · `status_question` · `strategy_question` · `action_request` · `information_only`

### 5.2 Customer state / recommended workspace

`question_only` · `situation` · `filing_plan` · `existing_case`

### 5.3 Response mode

`answer` · `answer_then_targeted_question` · `clarify_first` · `document_needed` · `filing_plan_build` · `case_review`

Retire customer-facing `initiate_case` / “Would you like to open a case?”

### 5.4 Example contract (options narrative)

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

### 5.5 Decision-changing question (Situation)

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

## 6. UI hierarchy

### 6.1 Situation (default for personal options)

- **Your Immigration Situation**
- What you asked
- What this may mean *(actual answer)*
- Paths that may apply
- One fact that changes the path *(targeted question)*
- When you’re ready: **Build my filing plan** · **Talk to an immigration professional** · **Ask another question**

Remove conflicting “YOUR IMMIGRATION CASE” on Situation surfaces. Do not present IMM-#### as a Case identity for Situations.

### 6.2 Case (only when government matter exists)

- Your USCIS Case
- Filing chronology, receipts, status, RFEs/notices, deadlines, correspondence, evidence, procedural events, case strategy
- Offer “Add this to your USCIS Cases” when a receipt / filed matter is detected from conversation or upload

### 6.3 Admin (Experience)

- Pattern Registry (levels 0–4, authority status, last validated)
- Experience record browser (de-identified views for promotion)
- Correction / failure-lesson queue
- “Why this ask?” diagnostics: matched pattern, similarity, N situations, review, authority

---

## 7. Experience & Learning Layer (Phase −1.9)

### 7.1 Two forms of internal knowledge

#### A. Case/Situation Experience Memory (per interaction, then de-identified)

Captures what happened—**never** reusable cross-user as raw narrative.

Contents (illustrative):

- initial user question; interpreted question contract  
- important known facts  
- facts that **actually changed** the answer  
- facts that turned out **not** to matter  
- documents involved; document findings  
- pathways considered / eliminated  
- authorities used  
- consultant corrections  
- final actions  
- government response when known (RFE / NOID / approval / denial)  
- user follow-up  
- analysis mistakes; corrected conclusions  

**De-identify before reusable cross-user intelligence.** Next user must never retrieve another customer’s narrative, name, A-number, receipt number, address, passport data, etc.

#### B. Pattern Knowledge (institutional experience)

Periodic extraction into reusable patterns, e.g.:

```
PATTERN IMM-FAM-ENTRY-001

Situation:
USC spouse + uncertain border entry + no filing

Common user question:
"What are my options?"

Primary controlling issue:
Inspection / admission / parole / EWI

Recommended initial behavior:
1. Explain spouse-based pathway generally.
2. Branch on entry classification.
3. Ask about border processing.
4. Do NOT request medical examination first.
5. Do NOT automatically create Case.
```

Example structured learning object from the options fixture:

```json
{
  "situation_pattern": {
    "domain": "family_based_immigration",
    "features": [
      "us_citizen_spouse",
      "border_entry",
      "no_prior_filing",
      "several_years_us_presence"
    ]
  },
  "question_pattern": {
    "user_goal": "identify_available_options"
  },
  "important_decision_points": [
    {
      "fact": "inspection_admission_or_parole",
      "priority": "critical_now",
      "reason": "changes potential processing pathway"
    }
  ],
  "low_value_early_questions": [
    "medical_exam",
    "priority_date",
    "financial_sponsorship_details"
  ],
  "effective_response_pattern": [
    "explain major pathways",
    "identify controlling unknown",
    "ask one targeted question"
  ]
}
```

On retrieval, Sol can use: *“Similar situations usually turn first on manner of entry. Do not begin with medical exam/document checklist. Explain branches first.”*

### 7.2 Information-gain learning (“what mattered”)

When asks A–F are posed and only B changes the pathway:

- B → high-value decision fact  
- A/C/D/E/F → not needed at this stage  

Aggregated over hundreds of situations → Need-to-Know prioritization from evidence (e.g. inspection/parole high pathway-change rate; medical exam near-zero for initial pathway).

### 7.3 Consultant corrections (high-value)

```json
{
  "original_finding": "...",
  "reviewer_correction": "...",
  "reason_for_correction": "...",
  "missing_fact": "...",
  "authority": "...",
  "affected_pattern": "...",
  "validated_by": "qualified_reviewer"
}
```

Lesson form: *“When I see this pattern again, check X before reaching that conclusion.”*

### 7.4 Government outcomes (with promotion safeguard)

```
CASE OUTCOME
     ↓
EXPERIENCE SIGNAL
     ↓
PATTERN CANDIDATE
     ↓
AUTHORITY CHECK
     ↓
MULTIPLE CASE CONFIRMATION
     ↓
REVIEW
     ↓
PROMOTED KNOWLEDGE
```

Outcome does **not** equal law. New USCIS policy always wins over 50 historical cases.

### 7.5 Pattern promotion levels

| Level | Name | Meaning |
| --- | --- | --- |
| 0 | Observation | One situation produced an interesting finding |
| 1 | Candidate Pattern | Similar behavior repeatedly |
| 2 | Supported Pattern | Multiple cases + authority/support |
| 3 | Reviewed Pattern | Validated by consultant/internal reviewer |
| 4 | Production Knowledge | Safe for Sol / Need-to-Know / Router to use broadly |

Only Level 4 (or explicitly allowed Level 3 under feature flag) may influence production retrieval by default.

### 7.6 Negative learning (required)

The medical-exam failure itself becomes a learning event:

```json
{
  "failure_type": "premature_clarification",
  "user_question": "immigration_options",
  "incorrect_question": "required_medical_exam",
  "reason": "did_not_change_initial_pathway",
  "preferred_fact": "manner_of_entry",
  "lesson": "schema completeness must not outrank question relevance"
}
```

### 7.7 Phase −1.9 Dev AI scope

1. Define Experience Record schema.  
2. Capture question contracts.  
3. Capture decision-changing facts.  
4. Capture discarded / non-material questions.  
5. Capture pathway decisions.  
6. Capture document evidence patterns.  
7. Capture consultant corrections.  
8. Capture government outcomes.  
9. De-identify reusable experience.  
10. Generate pattern candidates.  
11. Score pattern frequency / confidence.  
12. Validate against current authorities.  
13. Support reviewer approval / promotion.  
14. Retrieve relevant patterns during new conversations (Experience Search before Sol reasoning).  
15. Track whether retrieved experience improved or harmed analysis.  
16. Admin **Pattern Registry** + “why this ask?” diagnostics.  
17. Seed negative-learning record for premature medical-exam / schema-fill failures.

### 7.8 Product moat (intent)

Models are commodity. The hard-to-reproduce asset is:

Thousands of immigration situations + decision-changing fact patterns + document patterns + consultant corrections + government outcomes + question→pathway relationships + failure lessons + authority mappings — organized as a proprietary immigration reasoning layer.

Value proposition: *models reason using ImmigrationOnMe’s accumulated, validated immigration experience.*

---

## 8. Current codebase gap (grounding)

| Area | Today | Needed |
| --- | --- | --- |
| Router | Binary `assistant` \| `case` (`src/lib/conversation/*`) | Workspace axis: question / situation / filing_plan / existing_case |
| Persistence | `QaThread` + `Case` only | Situation + Filing Plan workspaces (§9) |
| Intake | assistant→QaThread else→Case + `runCaseAnalysis` | Situation path must **not** run Case analysis |
| Customer force | `forceCase` / “Run a full case review” | Soft CTAs only |
| Clarify | CaseUnknown / schema-fill can still win | Workspace ≠ existing_case ⇒ ignore Case schema completeness |
| Copy | Situation chrome + Case presentation | Hierarchy §6 |
| Experience | None as shared, promoted knowledge | Experience Memory + Pattern Registry + retrieval (§7) |
| Learning from corrections / outcomes | Case-local only | De-identified promotion pipeline with authority precedence |

---

## 9. Data model choice (approval item)

| Option | Approach | Pros | Cons |
| --- | --- | --- | --- |
| **A (recommended)** | Add `workspaceKind` on `Case`: `situation` \| `filing_plan` \| `government_case`; customer language driven by kind | Fast; reuses documents/chat links; minimal migration | Risk of Case machinery leaking if guards are weak |
| **B** | New `Situation` + `FilingPlan` models; Case only for government matters | Cleanest domain model | Larger migration; more UI/routing churn |

**Guard required for Option A:** if `workspaceKind !== government_case`, never run `runCaseAnalysis`, never surface CaseUnknown medical-exam asks, never show “YOUR IMMIGRATION CASE.”

**Experience tables (either option):** `ExperienceRecord` (raw, access-controlled), `ExperienceRecordAnon` (de-identified), `ExperiencePattern` (levels 0–4), `PatternPromotionAudit`, retrieval logs / outcome feedback.

---

## 10. Execution phases

### S0 — Spec lock *(this document)*

- Approve principles (§2), lifecycle, taxonomy, UI, data choice, Experience Layer (§7), ship order.
- **No product code until S0 approved.**

### S1 — Router + contracts

**Touch:** `src/lib/conversation/*`, clarify bridges, intake actions.

- Emit `customer_state`, `recommended_workspace`, `existing_government_case`, `response_mode` separately.
- Personal options → workspace `situation`, never `existing_case`.
- Government-matter detectors → `existing_case` or offer attach.
- Hard rule: Situation clarify ignores CaseUnknown / schema completeness.
- Pathways need-to-know defaults to manner-of-entry / inspection when relevant.
- Remove or demote customer `forceCase` / “Run a full case review.”

**Check:** `test:phase-minus1` — options → situation; medical exam must not be the ask.

### S2 — Situation workspace surface

- Persist Situation (per §9).
- Customer page hierarchy §6.1.
- Situation engine = Conversation Intelligence + answer-first + pathways + one ask — **not** full V5.1 Case pipeline.
- Guest + auth continuity for Situation.

### S3 — Filing Plan

- Created only via “Build my filing plan” or clear pursue-path intent.
- Pathway → eligibility → risks → filings → docs → sequence → consultant → prepare.
- CTAs: consultant vs self-file. Still not a Case until filed / matter exists.

### S4 — Case = government matter only

- Create/attach on matter detection; “Add to your USCIS Cases.”
- V5.1 machinery only here.
- Migrate historical options/situation rows → Situation workspace kind.
- Reserve “Immigration Court Case” label for later EOIR work.

### S5 — Intake / guide / copy cleanup

- Remove pipeline-choice UX; soft CTAs only.
- Align promote paths; admin keeps internal workspace + diagnostics.

### S6 — Fixtures + regression gate (workspace)

| Fixture | Expect |
| --- | --- |
| Border + USC spouse + options | Situation; answer then entry question; no Case; no medical exam |
| “Can my wife file for me?” | Question or Situation; no Case |
| “What is an I-862?” | Question only |
| Receipt + I-130 filed | Offer / create USCIS Case |
| Build filing plan CTA | Filing Plan; no Case yet |
| Schema-complete Case with open Situation workspace | Must **not** auto-convert to Case |

### S7 / Phase −1.9 — Experience & Learning (foundation → production retrieval)

Ship in sub-slices so workspace fix is not blocked:

| Slice | Deliverable |
| --- | --- |
| **L0** | Experience Record schema + write path after Situation/Case/Q&A turns (PII-tagged fields) |
| **L1** | De-identification pipeline; block cross-user retrieval of raw memory |
| **L2** | Capture decision-changing vs discarded facts; pathway decisions; negative learning for premature clarify |
| **L3** | Consultant correction capture → pattern candidates |
| **L4** | Government outcome signals → candidate only (authority check required) |
| **L5** | Pattern Registry admin UI + promotion levels 0→4 |
| **L6** | Experience Search retrieval into Sol context (Level 4 only by default) |
| **L7** | Telemetry: did retrieved pattern help or harm? Stale/authority invalidation |

**L0–L2 can start in parallel with S1–S2** (capture-only, no production retrieval).  
**L6 production retrieval only after** promotion + authority rules are live.

### S8 — Experience fixtures / regression

| Fixture | Expect |
| --- | --- |
| Options situation closes | Experience record written; PII not in anon/pattern store |
| Premature medical-exam ask | Negative learning / failure_type recorded |
| Consultant flips Path A→B | Correction record + candidate pattern |
| Level 0 pattern | Not used in Sol production retrieval |
| Level 4 pattern IMM-FAM-ENTRY-001 | Retrieved; ask prefers manner of entry; admin shows match rationale |
| New authoritative policy contradicts pattern | Authority wins; pattern demoted/stale |

---

## 11. Ship order

```
S0 (approve)
  → S1 → S2 → S5 (copy with S2)     ← minimum fix for Case-vs-Situation bug
  → S3 → S4 → S6                    ← Filing Plan + Case purity + fixtures
  → L0–L2 (capture + de-ID)         ← parallel OK once S0 approved
  → L3–L5 (corrections, outcomes, registry)
  → L6–L7 + S8                      ← production Experience Search
```

**Minimum customer-facing fix:** S1 + S2 (+ S5).  
**Institutional moat:** Phase −1.9 (S7) designed now, retrieval gated by promotion.

---

## 12. Non-goals

- Rewriting V5.1 phases A–G internals.
- Renaming every admin/internal `Case` identifier.
- Full EOIR Court Case product in this program (label reserved only).
- Asking customers to choose pipelines.
- **Automatic fine-tuning of Sol/Opus from live traffic.**
- Letting Level 0–1 patterns influence production Need-to-Know / Router.
- Letting outcomes rewrite law without authority + review.
- Implementing S1–S8 / L* code before S0 approval.

---

## 13. Approval checklist

Product / owner — confirm or edit:

**Workspace**

- [ ] Principles §2.1 are non-negotiable Phase −1 addenda
- [ ] Data model: **Option A** (`workspaceKind`) or **Option B** (new Situation/FilingPlan models)
- [ ] Ship **S1+S2 first** before Filing Plan entity (S3)
- [ ] Remove customer **forceCase / “full case review”** in favor of Filing Plan / consultant CTAs
- [ ] Historical IMM-* situation-shaped Cases: **reclassify to Situation** vs leave historical Case chrome
- [ ] Naming: “Filing Plan” vs “Immigration Plan”

**Experience & Learning**

- [ ] Principles §2.2 (learn patterns not identities; no live fine-tune; authority > experience; outcome ≠ law; negative learning)
- [ ] Phase ID: **−1.9** (avoid clash with shipped −1.7 Assistant Hardening) — or rename as directed
- [ ] Capture-only (**L0–L2**) may start in parallel with S1–S2; production retrieval (**L6**) only after Pattern Registry promotion
- [ ] Default production retrieval: **Level 4 only**
- [ ] Seed negative-learning event for medical-exam premature clarify

**After approval:** implement on `cursor/situation-filing-plan-*-c431` (and/or `cursor/experience-learning-*-c431` for −1.9), starting at S1 (+ optional L0 capture).

---

## 14. Traceability

| Source | How this plan addresses it |
| --- | --- |
| “Not automatically a Case” | §2.1 principles 1–3, 8–9; S1; S4 |
| Question / Situation / Filing Plan / Case | §3 lifecycle; §5 taxonomy |
| Router decides, not customer | §2.1 principles 5–6; remove forceCase |
| Answer then one branch-changing ask | §5.5; S1 need-to-know; S2 UI |
| Medical-exam nonsense | §2.1 #9; S1 hard rule; §7.6 negative learning |
| UI hierarchy | §6; S2/S5 |
| V5.1 belongs on real Cases | §3 Case row; S4 |
| Fourth layer: Experience & Learning | §4 architecture; §7; S7/L* |
| Do not train live on every case | §2.2 #11; §4.2; §12 |
| Experience Memory + Pattern Knowledge | §7.1 |
| What mattered / information gain | §7.2 |
| Consultant corrections | §7.3 |
| Government outcomes + promotion | §7.4–7.5 |
| Authority > experience | §2.2 #12 |
| Negative learning | §2.2 #14; §7.6 |
| Pattern Registry admin | §6.3; L5 |
| Moat / learn without sharing PII | §2.2 #10; §7.8 |
