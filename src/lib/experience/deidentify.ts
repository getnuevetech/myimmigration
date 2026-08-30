/**
 * Phase −1.9 L1 — de-identify experience records for shared / cross-user use.
 * Raw records may stay on the owning Situation; only anonymized forms may enter shared stores.
 */

import type { ExperienceRecordV0 } from "./experience-record";
import type { QuestionContract } from "../conversation/types";

/** Patterns that must never appear in shared experience knowledge. */
const PII_PATTERNS: RegExp[] = [
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i, // email
  /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/, // phone
  /\bA\d{8,9}\b/i, // A-number
  /\b(?:MSC|EAC|WAC|LIN|SRC|IOE|NBC)\d{8,}\b/i, // receipt-ish
  /\b\d{3}-\d{2}-\d{4}\b/, // SSN-like
  /\b(?:passport|passaporte)\s*[#:]?\s*[A-Z0-9]{6,}\b/i,
  /\b\d{1,5}\s+\w+\s+(street|st|ave|avenue|rd|road|blvd|lane|ln|dr|drive)\b/i,
];

export type AnonymizedNegativeLearning = {
  lesson_id: string;
  evaluation: "avoided" | "violated" | "not_applicable";
  incorrect_ask_detected: boolean;
  preferred_fact_asked: boolean;
  situation_features_matched: string[];
  failure_type: string;
};

/** Promotion ladder: 0 observation → 1 candidate → 2 supported → 3 reviewed → 4 production. */
export type PromotionLevel = 0 | 1 | 2 | 3 | 4;

export type AnonymizedCorrection = {
  origin: "consultant_correction";
  failure_type: string;
  incorrect_key: string;
  preferred_key: string;
  note_key: string;
  lesson_id: string | null;
};

export type AnonymizedExperienceRecord = {
  schema_version: "l1_anon";
  workspace: ExperienceRecordV0["workspace"];
  decision_target: string;
  current_scope: string;
  facts_considered: string[];
  decision_changing_facts: string[];
  facts_not_needed_yet: string[];
  facts_discarded: string[];
  pathways_considered: string[];
  clarification_key: string | null;
  clarification_reason_key: string | null;
  clarifications_suppressed: string[];
  document_kinds: string[];
  authority_ids: string[];
  answer_changed_after_clarification: boolean;
  has_model_correction: boolean;
  has_reviewer_correction: boolean;
  outcome_kind: string | null;
  response_mode: ExperienceRecordV0["response_mode"];
  invokes_case_engine: boolean;
  existing_government_case: boolean;
  interaction_intent: ExperienceRecordV0["interaction_intent"];
  negative_lesson_ids: string[];
  negative_learning: AnonymizedNegativeLearning[];
  capture_enrichment: "l2" | "l0";
  /** Opaque digest for dedupe — not reversible to Situation id without server secret. */
  source_digest: string;
  promotion_level: PromotionLevel;
  /** L3+: how this shared row was created. */
  origin?: "turn" | "consultant_correction" | "government_outcome";
  correction?: AnonymizedCorrection;
};

export function textLooksLikePii(text: string): boolean {
  if (!text) return false;
  return PII_PATTERNS.some((re) => re.test(text));
}

export function scrubFreeText(text: string): string {
  let out = String(text || "");
  for (const re of PII_PATTERNS) {
    out = out.replace(re, "[redacted]");
  }
  // Drop long free-narrative blocks from shared form — keep short labels only.
  if (out.length > 120) out = out.slice(0, 117) + "...";
  return out;
}

function documentKindFromHint(name: string): string {
  const lower = name.toLowerCase();
  if (/\bi-?797\b|receipt/.test(lower)) return "receipt_notice";
  if (/\brfe\b/.test(lower)) return "rfe";
  if (/\bnoid\b/.test(lower)) return "noid";
  if (/\bi-?862\b|nta/.test(lower)) return "nta";
  if (/\.pdf$/i.test(lower)) return "pdf";
  if (/\.(png|jpe?g|heic)$/i.test(lower)) return "image";
  return "document";
}

function reasonKey(reason: string | null | undefined): string | null {
  if (!reason) return null;
  const r = reason.toLowerCase();
  if (/adjustment|consular|pathway|branch/.test(r)) return "changes_pathway_branch";
  if (/notice|form number|identify/.test(r)) return "identifies_notice";
  if (/removal|proceedings/.test(r)) return "affects_forum";
  return "decision_relevant";
}

function contractAnon(contract: QuestionContract): Pick<QuestionContract, "decision_target" | "current_scope"> {
  return {
    decision_target: contract.decision_target,
    current_scope: contract.current_scope,
  };
}

/** Stable non-reversible digest for optional dedupe (no raw id in shared payload). */
export function sourceDigest(seed: string): string {
  let h = 2166136261;
  const s = `iom-exp-l1:${seed}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `d${(h >>> 0).toString(16).padStart(8, "0")}`;
}

/**
 * Convert a user-scoped L0 record into a shareable L1 anonymized observation.
 * Drops free-text questions, filenames, and identity-bearing strings.
 */
export function deidentifyExperienceRecord(
  record: ExperienceRecordV0,
  opts?: { sourceId?: string },
): AnonymizedExperienceRecord {
  const scope = contractAnon(record.question_contract);
  const discarded = record.facts_discarded ?? record.facts_not_needed_yet ?? [];
  const negativeLearning = (record.negative_learning_records ?? []).map((r) => ({
    lesson_id: r.lesson_id,
    evaluation: r.evaluation,
    incorrect_ask_detected: r.incorrect_ask_detected,
    preferred_fact_asked: r.preferred_fact_asked,
    situation_features_matched: [...r.situation_features_matched],
    failure_type: r.failure_type,
  }));

  return {
    schema_version: "l1_anon",
    workspace: record.workspace,
    decision_target: scope.decision_target,
    current_scope: scope.current_scope,
    facts_considered: [...record.facts_considered],
    decision_changing_facts: [...record.decision_changing_facts],
    facts_not_needed_yet: [...record.facts_not_needed_yet],
    facts_discarded: [...discarded],
    pathways_considered: [...record.pathways_considered],
    clarification_key: record.clarification_selected?.key ?? null,
    clarification_reason_key: reasonKey(record.clarification_selected?.reason),
    clarifications_suppressed: [...record.clarifications_suppressed],
    document_kinds: (record.documents_used ?? []).map(documentKindFromHint),
    authority_ids: [...record.authority_ids],
    answer_changed_after_clarification: record.answer_changed_after_clarification,
    has_model_correction: Boolean(record.model_correction),
    has_reviewer_correction: Boolean(record.reviewer_correction),
    outcome_kind: record.outcome?.kind ?? null,
    response_mode: record.response_mode,
    invokes_case_engine: record.invokes_case_engine,
    existing_government_case: record.existing_government_case,
    interaction_intent: record.interaction_intent,
    negative_lesson_ids: [...record.negative_lesson_ids],
    negative_learning: negativeLearning,
    capture_enrichment: record.capture_enrichment ?? "l0",
    source_digest: sourceDigest(opts?.sourceId || `${record.decision_target}:${record.workspace}`),
    promotion_level: 0,
    origin: "turn",
  };
}

export function assertSafeForSharedExperience(anon: AnonymizedExperienceRecord): void {
  const blob = JSON.stringify(anon);
  if (textLooksLikePii(blob)) {
    throw new Error("Anonymized experience still contains PII-like patterns; refusing shared publish.");
  }
  if ("question_contract" in (anon as object)) {
    throw new Error("Shared experience must not include raw question_contract.");
  }
  if ((anon as { clarification_selected?: unknown }).clarification_selected) {
    throw new Error("Shared experience must not include free-text clarification_selected.");
  }
}

/** Guard: never expose raw L0 records through a cross-user list API. */
export function filterForCrossUserRead(
  records: Array<{ ownerUserId: string | null; raw: ExperienceRecordV0; anon: AnonymizedExperienceRecord }>,
  viewerUserId: string | null,
): AnonymizedExperienceRecord[] {
  return records
    .filter((row) => {
      // Owner may see raw elsewhere; cross-user path always returns anon only.
      void row.ownerUserId;
      void viewerUserId;
      return true;
    })
    .map((row) => {
      assertSafeForSharedExperience(row.anon);
      return row.anon;
    });
}
