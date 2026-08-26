# ImmigrationOnMe V2 — execution plan

This is the product execution plan after the v4.2 dual-path customer chrome port (C1–C30). **Do not treat this file as permission to start a track.** Each track below is scheduled work; implement only the track that is explicitly started.

The first operational item started from this plan is **Admin case re-analysis** (search any user/case, multi-model re-review, compare, share, override, and an admin-only Re-run analysis CTA). Mailing-packet, prompt dual-path, USCIS filing, and legal representation are **not** in that item.

## Standing rules (every later track)

These remain binding. A later track does not weaken them.

- Do not merge git histories with taxonme. Each phase is a dedicated `cursor/<name>-9894` branch, then merge to `main`.
- Prisma v6. `npm test` is `tsx scripts/v32-evidence-check.ts`.
- Do not weaken A10 (analysis follows the case plan).
- Do not convert the RFE fixture (`IMM-000001`) into open-options.
- Do not reintroduce canned essays or a preliminary banner.
- Do not let learning invent paths.
- Do not skip official evidence gaps.
- Do not rank I-485 ahead of I-130 for family open-options.
- Do not auto-assign consultants.
- Do not invent receipts or deadlines for open-options.
- Do not start “file with USCIS” or legal representation until those tracks are explicitly opened.
- Do not bump `PROMPT_VERSION` unless analysis prompts actually change.
- Filed-path copies in `goal-*` filed branches stay filed. Dual-path leftover chrome is finished as of C30; do not reopen it as a C31-style copy sweep.
- Admin `/admin/cases` empty **No cases yet.** stays an admin inventory label.
- Internal evidence is not customer chrome.
- `GUIDE_PROMPT_RULES` / `DEFAULT_PROMPTS` / `presentationGroundingBlock` `APPROVED CASE PRESENTATION` are LLM grounding — skip unless the phase is explicitly prompt work.
- Unlabeled `versionReasonLabel()` stays the existing fallback (**Case review** / **Options review**); labeled `analysis` stays **Full case review** / **Options review**.
- No partial implementations. A phase is complete only when the user-visible contract, tests, and merge are done.

## Current product state

**Done and on `main`**

- V4.0 Track A (A1–A12): canonical case state, evidence, orchestrator, authority, plan-driven pipeline, approved-state source.
- V4.1 Track B (B1–B5): presentation contract, presenter lockdown, customer presentation UX, list/report, letters/notices/QA grounding.
- V4.2 C1–C30: goal-driven dual-path customer chrome. Open-options vs filed RFE copy is consistent on customer, consultant, and matching admin surfaces. There is no remaining C31 chrome leftover of the same kind.

**Intentionally not done (this plan)**

1. Mailing packet without filing.
2. Prompt dual-path (`DEFAULT_PROMPTS` / grounding tokens).
3. File with USCIS.
4. Legal representation.
5. Admin re-analysis lab and admin-only Re-run analysis CTA — **this is the first item to implement when this plan is activated for operations; mailing/prompt tracks stay parked.**

---

## Track 0 — Stop here (chrome port)

**Status:** complete. No further dual-path leftover phases.

Use this track only if product work pauses after C30. Nothing to implement.

---

## Track 1 — Mailing packet without filing (recommended next product track)

**Status:** planned. **Do not implement until explicitly started.**

### Goal

Give the customer one surface that lists everything they need to **review and mail themselves**: the matching form, a cover letter, and identity/relationship (or notice-response) documents. The platform does not submit to USCIS.

### Customer contract

- Open-options (example: marriage / family) starts with **I-130 + identity/relationship evidence**, not I-485, and never invents a receipt.
- Filed RFE stays a **notice response packet** (notice + evidence + response letter), not an open-options packet.
- Copy says the customer is the sender. No “we filed” / “we represent you”.
- Packet completeness is evidence-gated. Missing official evidence stays missing.

### Surfaces to change (when started)

1. New packet assembler from approved presentation + matching form + matching letter + ranked documents.
2. Customer packet page (print/download checklist + links to form fill and letter composer).
3. Guide / next-step CTAs point at the packet when the presentation’s next action is prepare-form or draft-letter.
4. Admin diagnostics: packet contents and evidence gaps, not a new filing engine.

### Explicitly out of scope for this track

- USCIS account login, online filing, G-28, or payment to USCIS.
- Changing `DEFAULT_PROMPTS` / `APPROVED CASE PRESENTATION` tokens (that is Track 2).
- Auto-assigning a consultant to “send” the packet.

### Tests when started

- Family open-options packet leads with I-130, not I-485.
- RFE fixture packet stays notice-response; posture remains **RFE notice needs review**.
- No consultant auto-assign.
- Source checks that mailing copy never claims the platform filed.

---

## Track 2 — Prompt dual-path

**Status:** planned. **Do not implement until explicitly started.**

### Goal

Stop telling the model that an open-options situation is an `APPROVED CASE PRESENTATION` when the customer-facing phrase is **approved options presentation**. Filed RFE stays case presentation.

### What changes

- `DEFAULT_PROMPTS`, `GUIDE_PROMPT_RULES`, and `presentationGroundingBlock` grow dual-path tokens.
- This **does** bump `PROMPT_VERSION` because analysis prompts change.
- Customer chrome is already dual-path (C24–C30). Do not rework those helpers unless a prompt string still leaks filed-only wording into open-options generation.

### Tests when started

- Open-options grounding includes options presentation language.
- Filed RFE grounding keeps `APPROVED CASE PRESENTATION`.
- RFE fixture is not converted to open-options.
- I-130 still ranks ahead of I-485.
- No consultant auto-assign.

---

## Track 3 — File with USCIS (later)

**Status:** parked. **Do not start.**

Would include USCIS online account, form submission, fee payment, and receipt capture. This is a different product. README still marks it as later. Opening it requires an explicit new plan with authority, credential, and liability design — not a leftover chrome phase.

---

## Track 4 — Legal representation (later)

**Status:** parked. **Do not start.**

Would include G-28, attorney-of-record flows, and consultant-as-representative. Consultants today review and comment; they do not become counsel by assignment. Auto-assignment stays off.

---

## Track 5 — Admin case re-analysis lab (first operational item)

**Status:** implement when this plan is activated for operations. This is **not** a dual-path chrome leftover.

### Goal

Admins can pull **any** case (by browsing cases, or by searching a user by email/mobile and selecting their case), re-run analysis with **one or many** configured AI models (or the default pipeline / rule-based fallback), **compare** the live customer output with the new staff output, optionally **let the customer and/or consultant see** the staff output, then **share** it, and only then **override** the live customer output.

A **Re-run analysis** CTA is restored **only for admin**. Customers and consultants must not see it and must not be able to trigger the old owner-only re-run action.

### Product rules

- A draft re-analysis must **not** silently replace the customer’s current output. Override is the only promote path.
- Share makes the new output visible as a **staff-shared review**, not as the live approved state.
- Visibility checkboxes (customer / consultant) are independent of override.
- Selected models constrain which `AiProvider` rows run. Empty selection uses the current pipeline (enabled providers with keys, else rule-based fallback).
- Draft runs must not auto-assign consultants, must not convert the RFE fixture to open-options, and must not invent receipts.
- Admin compare is the source of truth for “what changed”; customer/consultant only see the staff output when visibility/share says so.

### Implementation shape (when executing this track)

1. Persist an `AdminCaseReanalysis` row: case, admin, provider ids, visibility flags, current snapshot, proposed snapshot, comparison, status (`pending` / `running` / `completed` / `failed` / `shared` / `overridden`).
2. Capture the customer-facing snapshot (canonical approved presentation, latest presentation row, case scores/status, issues, path steps, action nodes, reconstruction) **before** the run.
3. Run `runCaseAnalysis` in `persistMode: "draft"` with optional `providerIds`. While status is `running`, customer/consultant views keep showing the **current** snapshot even if live tables are mid-write. After the run, restore the current snapshot so live output is unchanged.
4. Admin UI: `/admin/reanalysis` (Intelligence) plus a **Re-run analysis** button on `/admin/cases/[id]` that opens the lab with that case. No such button on `/app/cases/[id]` or consultant case view.
5. Compare UI: current vs proposed posture, next action, findings, steps, readiness. Share and Override are explicit admin actions.
6. Override writes the proposed snapshot as the customer-facing canonical approved state and records a version reason `admin_override`.

### Tests

- Source: admin case page has Re-run analysis; customer and consultant case pages do not.
- Source: `reanalyzeCaseAction` is not callable as a customer/consultant promote.
- Share does not write canonical approved state; override does.
- Draft persist mode skips consultant auto-assign.
- Existing RFE fixture / I-130-before-I-485 / no auto-assign assertions stay green.
- Do not bump `PROMPT_VERSION`.

---

## Suggested later order (when product work continues)

1. Track 5 — Admin re-analysis (operations; can ship without mailing or prompt work).
2. Track 1 — Mailing packet without filing (recommended customer-product next step).
3. Track 2 — Prompt dual-path (only if generated analysis still talks like a filed case on open-options).
4. Track 3 / 4 — only with an explicit new charter.

Do not batch these into one branch. One track, one `cursor/<name>-9894` branch, merge to `main`.
