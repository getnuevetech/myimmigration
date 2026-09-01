# Phase SI — Situation Intelligence Interview

**Status:** Phase 0–1 IN PROGRESS / shipping  
**Date:** 2026-09-01  
**Revision:** 1 — locked after Zimbabwe-failure review + authority pre-screen amendment  
**Sequence:** After Phase S Situation workspace; sits in front of Situation pathway presentation and full research  
**Domain:** Situation / Pipeline A (exploratory personal immigration situations). Case/V5.1 remains government-matter only.  
**Checks:** `npm run test:phase-si`

---

## §0 Diagnosis (locked)

The Zimbabwe Situation failure shows the product skipping fact orientation:

> Narrative → template pathways (I-130 / inspected-vs-EWI) → “one fact that changes the path”

That invents a USC-spouse prior the user never stated and wastes the interview budget on the wrong branch.

**Locked rule:** For broad, personal immigration Situations, ImmigrationOnMe must **not** go directly from user narrative → research conclusion / pathway presentation.

**Allowed before interview:** semantic decomposition, lightweight authority/country pre-screen, question scoring, internal pathway *possibility* discovery.

**Forbidden before adequate fact orientation:** customer-facing personalized legal conclusions and unsupported pathway recommendations.

Telemetry wording (precise):

> `full_personalized_analysis_before_fact_orientation` → **0** for broad / underspecified Situations.

Internal reasoning during intake is expected and good.

---

## §1 Approved intelligence cycle (locked)

```
USER NARRATIVE
      ↓
SEMANTIC DECOMPOSITION          (AI1 — Narrative Decomposer)
      ↓
FACT AUDIT                      (AI2 — Fact Auditor)
      ↓
DETERMINISTIC RECONCILIATION    → Situation Fact Set (partial)
      ↓
LIGHT RESEARCH PRE-SCREEN       (country / program / context signals only)
      ↓
QUESTION DIRECTOR               (deterministic rank + dependencies)
      ↓
ITERATIVE INTERVIEW             (answer → update Fact Set → re-rank → next)
      max ~6 · target 3–5 · min 0 · stop on value threshold
      ↓
PRECISE SITUATION FACT SET
      ↓
FULL RESEARCH FAN-OUT           (USCIS / DHS / EOIR / DOS / law / policy)
      ↓
REASONER A  +  REASONER B
      ↓
RECONCILIATION / FACT FIREWALL
      ↓
SOL PRESENTATION
      ↓
CONSULTANT-READY SITUATION BRIEF
```

**Critical distinction — two research stages:**

| Stage | When | Scope |
| --- | --- | --- |
| **Light pre-screen** | After known-facts reconciliation, **before** Question Director finalizes asks | Country / nationality / program / policy **signals** only (e.g. presence-since date windows, designation names, eligibility *cues*) |
| **Full research fan-out** | After Precise Situation Fact Set | Full authority research for activated dimensions |

Pre-screen informs **which questions are high-value**. It does **not** produce customer-facing pathway conclusions.

Example: `country = Haiti` → scan finds continuous-presence-since-DATE cue → arrival date becomes high-value for the director.

---

## §2 Situation Fact Set (locked)

Facts and legal conclusions stay separated. **Never** store “eligible for asylum” as a Fact Set value.

### Factual states

Replace `known | unknown | inferred` with:

| State | Meaning |
| --- | --- |
| `reported` | User said it in narrative or interview |
| `verified` | Document / government record substantiates it |
| `derived` | Deterministically derived from other facts (not legal opinion) |
| `unknown` | Not established |
| `conflicted` | Contradictory sources / AI1–AI2 disagreement unresolved |

### Fact entry shape (contract)

```json
{
  "key": "country_of_origin",
  "value": "Zimbabwe",
  "state": "reported",
  "provenance": "user_narrative",
  "source_text": "I am from Zimbabwe",
  "updated_at": "ISO-8601"
}
```

Later passport may promote citizenship to `verified` with `document_id`.

### Foundational Fact Frame (6 dimensions — not 6 mandatory questions)

These are **dimensions**, not a questionnaire. Resolve from narrative when possible; ask only unresolved high-value gaps.

1. **WHO / ORIGIN** — citizenship / nationality / relevant country  
2. **WHERE** — currently inside or outside the United States  
3. **IMMIGRATION POSITION** — entry / admission / parole / visa / current status  
4. **GOVERNMENT HISTORY** — USCIS / EOIR / ICE / CBP / consulate / prior filings  
5. **POSSIBLE BASIS** — family / humanitarian / work / school / victimization / other  
6. **GOAL** — what the person is trying to accomplish  

### Activated dimensions (dynamic)

Narrative + light pre-screen may activate extra dims, e.g.:

fear / humanitarian · family · employment · education · victimization · abuse · trafficking · court / removal · prior violations · citizenship · military · investment · country-program windows

Activated dims may add **Level 2** questions (below). They do not expand the ceiling beyond ~6 for the initial interview.

---

## §3 AI1 + AI2 before the interview (locked)

**Not** two expensive legal reasoners yet.

### AI1 — Narrative Decomposer

Extract: explicit facts, claims, goals, entities, dates, conditions, activated dimensions, unresolved concepts.

### AI2 — Fact Auditor

Independently check: misses, overstatements, implied→fact conversions, manufactured relationships/status, ambiguity.

### Deterministic reconciliation

Example:

| Input | Result |
| --- | --- |
| “I can’t go back to Zimbabwe.” | `inability_or_concern_about_return` = **reported** |
| | `fear_of_persecution` = **unknown** (not established) |

AI1 may suggest fear; AI2 blocks overclaim; reconciler keeps precision.

---

## §4 Light research pre-screen (locked addition)

**Input:** reconciled partial Fact Set (especially ORIGIN / country signals) + goal cues.  
**Output:** `PreScreenSignals[]` consumed only by Question Director scoring.

Each signal roughly:

```json
{
  "signal_type": "country_program_window",
  "country": "Haiti",
  "cue": "continuous_presence_since",
  "date_hint": "YYYY-MM-DD",
  "authority_refs": ["…"],
  "elevates_fact": "us_arrival_or_presence_start",
  "confidence": 0.0
}
```

**Rules:**

- Lightweight / bounded latency — not full research fan-out.  
- May elevate question priority (e.g. arrival date).  
- Must not invent family, employer, or spouse.  
- Must not write pathway recommendations into the Fact Set.  
- Missing or failed pre-screen → director still runs on narrative facts alone (degraded but safe).

---

## §5 Deterministic Question Director (locked)

### Job (and non-job)

**Job:** Identify the smallest set of simple questions that most improve the Situation Fact Set for meaningful research and analysis.

**Non-job:** Recommend asylum, I-130, or any legal conclusion. The director does **not** “know immigration answers.”

### Two question levels

| Level | Role | Examples |
| --- | --- | --- |
| **L1 Orientation** | Structure of the immigration situation | Inside/outside US? How/when entered? Any filings / court / papers? |
| **L2 Activated** | Only because narrative or pre-screen activates a dim | Why unable to return? Spouse USC/LPR? Employer willing to sponsor? Incident reported to police? |

Budget applies to **L1 + L2 combined**.

### Candidate contract (internal)

```json
{
  "candidate": "current_location",
  "source": "foundational_frame",
  "known": false,
  "dependency_satisfied": true,
  "pathway_discrimination": 0.96,
  "jurisdiction_impact": 0.97,
  "eligibility_impact": 0.84,
  "urgency_impact": 0.55,
  "customer_burden": 0.05,
  "pre_screen_boost": 0.0,
  "ask": true,
  "level": 1,
  "customer_wording": "Are you currently inside or outside the United States?",
  "reason": "Available processes differ by physical location."
}
```

Low-discrimination candidates (e.g. medical exam) fail the gate naturally — no special-case ban list required (negative lessons may still reinforce).

### Ranking (conceptual)

```
VALUE =
  pathway_discrimination
+ jurisdiction_impact
+ eligibility_impact
+ inadmissibility_or_risk_impact
+ eliminate_alternatives
+ urgency
+ pre_screen_boost
− already_resolved
− premature_detail
− low_relevance_to_goal
− customer_burden
```

### Dependencies

Example:

```
WHERE?
  ├─ outside_us → prior U.S. history? · outside-path research cues
  └─ inside_us  → entry / status orientation
```

Do not ask entry manner until location / prior entry is established when required.

### Iterative loop (locked)

```
ASK Qi
  ↓
UPDATE FACT SET
  ↓
RE-RANK (with deps + pre-screen signals)
  ↓
ASK Qi+1  OR  STOP
```

Question 2 is **not** predetermined when Question 1 is emitted.

### Stopping rule (locked)

| Constraint | Value |
| --- | --- |
| Maximum | **6** before first substantive personalized analysis |
| Target | **3–5** |
| Minimum | **0** if Fact Set already sufficient |

**Actual stop condition:** no unresolved candidate exceeds `FIRST_ANALYSIS_QUESTION_VALUE_THRESHOLD`.

Do **not** stop merely because six were asked if threshold still unmet — but never exceed six for the *initial* interview. After first analysis, a later decisive ask is allowed separately.

---

## §6 Customer UI — Situation Intelligence Interview

Not a giant intake form. Not six fixed questions for everybody.

Voice:

> A few things will help us understand this correctly.  
> You already told us …  
> We just need a few details that can change which options may apply.

Then simple cards / conversational turns. Echo resolved facts so the customer feels heard.

After stop → unlock full research + dual reasoners + SOL presentation.

---

## §7 Post-interview pipeline

1. **Precise Situation Fact Set** — interview + narrative + any verified docs.  
2. **Full research fan-out** — keyed by activated dimensions (not “all immigration”).  
3. **Reasoner A + Reasoner B** — independent passes on findings + facts.  
4. **Reconciliation / Fact Firewall** — prose cannot invent Fact Set rows.  
5. **SOL Presentation** — pathways that survive facts; explicit unknowns / not recommended.  
6. **Consultant-ready Situation Brief** (below).

Reuse Case clarify / need-to-know / V5.1 patterns where useful; **do not** promote exploratory Situations into the Case engine.

---

## §8 Consultant Situation Brief (locked product requirement)

Every Situation analysis must be convertible into a professional brief **without** the consultant reconstructing the story from scratch.

**Visual separation (required):**

1. **Customer-reported facts** — what the user told ImmigrationOnMe  
2. **Verified facts** — documents / government records  
3. **AI-identified issues / options** — analytical findings, **not** facts  
4. **Unresolved professional questions** — where human judgment remains useful  

Also include: stated goal, government history summary, authority basis with provenance, Reasoner A/B + agreement, why each issue was flagged.

**Value proposition:** prepared Situations, not raw leads.

---

## §9 Learning loop

Consultant / attorney corrections feed Question Director priorities and negative lessons (Experience −1.9):

- Don’t ask medical first.  
- Don’t assume spouse from live/work goal.  
- Humanitarian narrative activates fear/return dim, not family.  
- Country pre-screen elevated arrival date — was that useful?

---

## §10 Acceptance fixtures (required)

| Fixture | Expectation |
| --- | --- |
| **Zimbabwe** | ORIGIN+GOAL resolved; WHERE/POSITION/GOV unknown; BASIS partial humanitarian; **no USC spouse invented**; asks location/entry/history + refine return concern + optional bases |
| **Mexico + USC spouse + border** | Many facts already known; **few** asks (entry manner, papers/A-number/hearing, prior removal) — not six generic |
| **Haiti / Ukraine / Venezuela-style** | Pre-screen elevates presence/arrival or program-window facts when cues exist |
| **Already complete narrative** | **0** interview questions; proceed to analysis |
| **Novel Situation** | System must analyze a Situation with **no** fixture, scenario template, or production Experience Pattern — **no hidden scenario engine** |

Hard ban: customer-facing I-130 / USC-spouse language without a family fact in the Fact Set (`reported` or `verified`).

---

## §11 Phase plan (execution)

### Phase 0 — Contracts & fixtures (no customer UX change)

- Fact Set schema + states (`reported|verified|derived|unknown|conflicted`)  
- Foundational + activated dimension enums  
- Question candidate contract + value fields + stop threshold constant  
- Pre-screen signal contract  
- Brief section contract (4 visual buckets)  
- Zimbabwe / Mexico / novel / complete fixtures + check script  
- Telemetry event names locked (`full_personalized_analysis_before_fact_orientation`, ask counts, skip-as-resolved, pre-screen boosts)

**Exit:** contracts frozen; fixtures fail on current product for Zimbabwe spouse hallucination / missing interview.

### Phase 1 — AI1 / AI2 + Fact Set persistence

- Wire Narrative Decomposer + Fact Auditor + reconciler into Situation create path  
- Persist into `Situation.knownFactsJson` (today empty)  
- No pathway presentation change yet beyond storing facts / suppressing fabricated family in templates when facts contradict

**Exit:** Zimbabwe extracts origin + return concern + goal; does not invent spouse.

### Phase 2 — Light pre-screen + Question Director (server)

- Country/program lightweight scan → signals  
- Deterministic director: L1 + L2 candidates, deps, score, ceiling, stop threshold  
- Iterative API: `nextQuestion(situationId)` / `answerQuestion` → update → re-rank  

**Exit:** director unit tests for Zimbabwe / Mexico / medical-exam suppressed / Haiti date boost (mocked signals).

### Phase 3 — Situation Intelligence Interview UI

- Multi-turn cards; echo already known  
- Guests included (do not copy Case guest clarify lockout)  
- Stop → “ready for analysis” state  

**Exit:** manual + automated UI path; no unsupported pathway block before stop.

### Phase 4 — Full research + dual reasoners + SOL + Brief

- Fan-out after Precise Fact Set  
- Reasoner A + B + reconciliation + fact firewall  
- SOL presentation from reconciled findings  
- Consultant Situation Brief with 4 visual buckets  

**Exit:** Zimbabwe analysis may discuss protection/humanitarian **and** other bases only if facts support; Brief usable by a professional.

### Phase 5 — Learning + consultant corrections

- Map corrections → director weights / negative lessons  
- Experience capture for interview quality  

### Phase 6 — Hardening & regression

- `test:phase-si` gates all fixtures including **novel Situation**  
- Telemetry dashboards / ops notes  
- Ban regressions: analysis-before-orientation for underspecified Situations; spouse hallucination  

---

## §12 Build order (approved)

1. **Phase 0–1** — proceed now (contracts, dual screen, Fact Set).  
2. **Phase 2–3** — director + iterative interview (stops premature pathway UI).  
3. **Phase 4** — research + A/B + SOL + Brief.  
4. **Phase 5–6** — learning + regression.

---

## §13 Extension points (current codebase)

| Concern | Likely hook |
| --- | --- |
| Intake → Situation | `startIntakeAction` / `createCaseAction` → `runConversationIntelligence` → `createSituationFromIntelligence` |
| Persist facts | `Situation.knownFactsJson` in `situation-create.ts` |
| Replace display-only ask | `SituationWorkspaceView` / `composeAssistantView` / need-to-know |
| Clarify pattern to reuse (not copy Case schema) | `clarify.ts`, `need-to-know.ts`, `case-clarify.tsx` |
| Suppress wrong I-130 priors | Situation branches / `filing-plan.ts` heuristics / family open-options — gate on Fact Set |
| Dual reasoners later | Lighter Situation orchestrator; do not force V5.1 Case engine |
| Experience / negatives | Phase −1.9 Experience records + `negative-lessons.ts` |

---

## §14 Locked amendments checklist (from approval)

- [x] Lightweight authority/country **pre-screen before** Question Director finalizes asks  
- [x] Fact states: `reported | verified | derived | unknown | conflicted`  
- [x] Iterative director: answer → update → re-rank → next  
- [x] Deterministic **stop threshold** (not only max 6)  
- [x] Foundational dimensions ≠ mandatory questions; separate **activated** dims  
- [x] Consultant Brief separates reported / verified / AI findings / unresolved  
- [x] Telemetry: forbid premature **customer-facing** personalized conclusions, not internal reasoning  
- [x] Explicit **novel Situation** test (no hidden scenario engine)  
- [x] AI1/AI2 are decomposer + auditor before interview — not dual legal reasoners yet  

---

## §15 Success criteria (Zimbabwe)

1. Echo: Zimbabwe / concern about return / live & work goal.  
2. Pre-screen may elevate country-context asks; does not invent spouse.  
3. Interview resolves WHERE / POSITION / GOV HISTORY as needed + refines humanitarian basis + optional other bases.  
4. Only then full research + A/B + SOL.  
5. Situation Brief shows reported vs verified vs AI issues vs unresolved — a lawyer can work from it.

---

**Bottom line:** ImmigrationOnMe first listens, orients facts (with a light authority pre-screen so questions are directional), interviews only what matters, then researches, dual-reasons, presents, and briefs professionals — instead of guessing a pathway from the first paragraph.
