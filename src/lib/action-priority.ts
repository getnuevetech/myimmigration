/**
 * Phase D — deterministic action priority (V5.1 Correction Spec §5.7 / §9).
 *
 * priority_score =
 *   (legal_case_materiality * 3)
 * + (evidence_gap_importance * 3)
 * + (deadline_urgency * 2)
 * + (goal_relevance * 3)
 * + (ability_to_resolve * 2)
 *
 * Rank: descending score; ties → blocks_goal_progress → higher deadline_urgency → action_id asc.
 * INV-ACT-01: generic REVIEW_FORM / ASK_FOLLOW_UP must not outrank gap-resolving actions.
 * UPDATE_GREEN_CARD_PATH_EXPLANATION is a system consequence, not a customer upload/confirm.
 */

import type { FactLedger } from "@/lib/evidence/fact-ledger";
import { ledgerFact } from "@/lib/evidence/fact-ledger";
import type { SituationBrief } from "@/lib/situation-brief";
import { caseTypeLockFromBrief, isVawaI360Lock } from "@/lib/case-type-lock";

export const ACTION_PRIORITY_WEIGHTS = {
  legal_case_materiality: 3,
  evidence_gap_importance: 3,
  deadline_urgency: 2,
  goal_relevance: 3,
  ability_to_resolve: 2,
} as const;

export type ActionPriorityScores = {
  legal_case_materiality: number;
  evidence_gap_importance: number;
  deadline_urgency: number;
  goal_relevance: number;
  ability_to_resolve: number;
};

export type ActionEffect =
  | { op: "RESOLVE_UNKNOWN"; fact_id: string }
  | { op: "PROMOTE_FACT"; fact_id: string; from: string; to: string };

export type RankedAction = {
  action_id: string;
  title: string;
  why: string;
  what_changes: string;
  /** Customer upload/confirm vs system consequence (Phase F note). */
  actor: "customer" | "system";
  scores: ActionPriorityScores;
  priority_score: number;
  blocks_goal_progress: boolean;
  effects: ActionEffect[];
};

/** Generic actions that must not outrank material gap resolvers (INV-ACT-01). */
export const GENERIC_ACTION_IDS = new Set([
  "REVIEW_FORM",
  "REVIEW_FORM_I360",
  "ASK_FOLLOW_UP",
  "KEEP_PRIMA_FACIE_NOTICE",
  "START_I130",
  "PREPARE_I589",
]);

export function computePriorityScore(scores: ActionPriorityScores): number {
  return (
    scores.legal_case_materiality * ACTION_PRIORITY_WEIGHTS.legal_case_materiality +
    scores.evidence_gap_importance * ACTION_PRIORITY_WEIGHTS.evidence_gap_importance +
    scores.deadline_urgency * ACTION_PRIORITY_WEIGHTS.deadline_urgency +
    scores.goal_relevance * ACTION_PRIORITY_WEIGHTS.goal_relevance +
    scores.ability_to_resolve * ACTION_PRIORITY_WEIGHTS.ability_to_resolve
  );
}

export function rankScoredActions<T extends {
  action_id: string;
  priority_score: number;
  blocks_goal_progress?: boolean;
  scores: Pick<ActionPriorityScores, "deadline_urgency">;
}>(actions: T[]): T[] {
  return [...actions].sort((a, b) => {
    if (b.priority_score !== a.priority_score) return b.priority_score - a.priority_score;
    const aBlock = a.blocks_goal_progress ? 1 : 0;
    const bBlock = b.blocks_goal_progress ? 1 : 0;
    if (bBlock !== aBlock) return bBlock - aBlock;
    if (b.scores.deadline_urgency !== a.scores.deadline_urgency) {
      return b.scores.deadline_urgency - a.scores.deadline_urgency;
    }
    return a.action_id.localeCompare(b.action_id);
  });
}

function scored(
  partial: Omit<RankedAction, "priority_score"> & { priority_score?: number },
): RankedAction {
  const priority_score = partial.priority_score ?? computePriorityScore(partial.scores);
  return { ...partial, priority_score };
}

function gapOpen(ledger: FactLedger | null | undefined, subject: string): boolean {
  if (!ledger) return false;
  if ((ledger.evidence_gaps ?? []).some((g) => String((g as { subject?: string }).subject ?? "") === subject)) {
    return true;
  }
  const fact = ledgerFact(ledger, subject);
  return fact?.status === "UNKNOWN" || fact?.kind === "EVIDENCE_GAP";
}

function unverifiedOpen(ledger: FactLedger | null | undefined, subject: string): boolean {
  if (!ledger) return false;
  if ((ledger.unverified_claims ?? []).some((u) => String((u as { subject?: string }).subject ?? "") === subject)) {
    return true;
  }
  const fact = ledgerFact(ledger, subject);
  return fact?.status === "REPORTED" || fact?.kind === "UNVERIFIED_CLAIM";
}

/**
 * Canonical VAWA prima-facie scored actions from golden `next_actions_ordered`.
 * Only emits when the brief/lock is VAWA I-360, and only while gaps remain open.
 */
export function buildLedgerDrivenActions(input: {
  ledger?: FactLedger | null;
  brief?: SituationBrief | null;
}): RankedAction[] {
  const ledger = input.ledger ?? null;
  const lock = caseTypeLockFromBrief(input.brief);
  const vawaLocked =
    isVawaI360Lock(lock) ||
    input.brief?.primaryForm === "I-360" ||
    /\bvawa\b/i.test(input.brief?.caseType ?? "") ||
    // Ledger-only callers (tests / graph without brief): prima facie posture implies VAWA.
    ledger?.current_posture?.value === "PRIMA_FACIE_PENDING" ||
    (ledger?.facts ?? []).some((f) => f.fact_id === "FORM_I360_FILED");
  if (!vawaLocked) return [];

  const actions: RankedAction[] = [];

  const needI485Receipt =
    gapOpen(ledger, "I485_RECEIPT") || unverifiedOpen(ledger, "FORM_I485_FILED");
  if (needI485Receipt) {
    actions.push(
      scored({
        action_id: "UPLOAD_I485_RECEIPT",
        title: "Upload any missing I-485 receipt if adjustment was filed",
        why: "You told us an I-485 may exist; the receipt verifies that related filing.",
        what_changes: "The related adjustment process moves from reported to verified.",
        actor: "customer",
        blocks_goal_progress: true,
        effects: [
          { op: "RESOLVE_UNKNOWN", fact_id: "I485_RECEIPT" },
          { op: "PROMOTE_FACT", fact_id: "FORM_I485_FILED", from: "REPORTED", to: "VERIFIED" },
        ],
        scores: {
          legal_case_materiality: 5,
          evidence_gap_importance: 5,
          deadline_urgency: 2,
          goal_relevance: 5,
          ability_to_resolve: 5,
        },
      }),
    );
  }

  if (gapOpen(ledger, "LATER_I360_ACTION")) {
    actions.push(
      scored({
        action_id: "UPLOAD_POST_PRIMA_FACIE_NOTICES",
        title: "Upload USCIS notices received after the Prima Facie Determination",
        why: "Later USCIS action on the I-360 changes whether the self-petition is still preliminary or finally decided.",
        what_changes: "Unknowns about later I-360 action shrink once notices are reviewed.",
        actor: "customer",
        blocks_goal_progress: true,
        effects: [{ op: "RESOLVE_UNKNOWN", fact_id: "LATER_I360_ACTION" }],
        scores: {
          legal_case_materiality: 5,
          evidence_gap_importance: 4,
          deadline_urgency: 3,
          goal_relevance: 4,
          ability_to_resolve: 5,
        },
      }),
    );
  }

  if (gapOpen(ledger, "WAIVER_TYPE") || unverifiedOpen(ledger, "WAIVER_TYPE")) {
    actions.push(
      scored({
        action_id: "UPLOAD_WAIVER_NOTICE",
        title: "Upload waiver approval or receipt showing form and decision",
        why: "The waiver type changes what still has to be proven and which forms apply.",
        what_changes: "Waiver facts move from unknown to verified on the locked matter.",
        actor: "customer",
        blocks_goal_progress: true,
        effects: [{ op: "RESOLVE_UNKNOWN", fact_id: "WAIVER_TYPE" }],
        scores: {
          legal_case_materiality: 4,
          evidence_gap_importance: 4,
          deadline_urgency: 3,
          goal_relevance: 4,
          ability_to_resolve: 5,
        },
      }),
    );
  }

  if (gapOpen(ledger, "CURRENT_I485_STATUS")) {
    actions.push(
      scored({
        action_id: "CONFIRM_I485_PROCEDURAL_STATUS",
        title: "Confirm interview, RFE, transfer, EAD, or decision status on the I-485",
        why: "Procedural status on adjustment is still unknown and affects the green-card path.",
        what_changes: "Current I-485 posture can be verified against the locked petition path.",
        actor: "customer",
        blocks_goal_progress: true,
        effects: [{ op: "RESOLVE_UNKNOWN", fact_id: "CURRENT_I485_STATUS" }],
        scores: {
          legal_case_materiality: 4,
          evidence_gap_importance: 3,
          deadline_urgency: 3,
          goal_relevance: 5,
          ability_to_resolve: 4,
        },
      }),
    );
  }

  // System consequence — scored for ordering, not shown as a customer CTA by default.
  if (actions.some((a) => a.actor === "customer") || ledger?.current_posture?.value === "PRIMA_FACIE_PENDING") {
    actions.push(
      scored({
        action_id: "UPDATE_GREEN_CARD_PATH_EXPLANATION",
        title: "Update the green-card / adjustment path explanation",
        why: "After records are reviewed, regenerate the explanation of the green-card path.",
        what_changes: "Customer-facing path explanation stays consistent with verified filings.",
        actor: "system",
        blocks_goal_progress: false,
        effects: [],
        scores: {
          legal_case_materiality: 3,
          evidence_gap_importance: 2,
          deadline_urgency: 1,
          goal_relevance: 5,
          ability_to_resolve: 3,
        },
      }),
    );
  }

  return rankScoredActions(actions);
}

export function isGenericActionId(actionId: string | null | undefined): boolean {
  const key = String(actionId ?? "").toUpperCase();
  if (!key) return false;
  if (GENERIC_ACTION_IDS.has(key)) return true;
  return /^REVIEW_FORM|^ASK_FOLLOW_UP|^KEEP_PRIMA_FACIE|^START_I130|^PREPARE_I589/.test(key);
}

export function isGenericActionTitle(title: string): boolean {
  const t = title.trim().toLowerCase();
  return (
    /^review form\b/.test(t) ||
    /^ask (a )?follow-?up\b/.test(t) ||
    /^keep the prima facie notice\b/.test(t) ||
    /^stay with the vawa form i-360\b/.test(t)
  );
}

/**
 * Merge ledger-ranked customer actions with any existing presentation actions.
 * Gap resolvers win order; generics are demoted below material gap actions (INV-ACT-01).
 */
export function mergeRankedCustomerActions(input: {
  ranked: RankedAction[];
  existing: Array<{
    what: string;
    why: string;
    now: string;
    whatChanges: string;
    actionKey?: string;
    status?: string;
  }>;
  limit?: number;
}): Array<{
  what: string;
  why: string;
  now: string;
  whatChanges: string;
  actionKey?: string;
  status?: string;
  priorityScore?: number;
}> {
  const limit = input.limit ?? 5;
  const customerRanked = input.ranked.filter((a) => a.actor === "customer");
  const out: Array<{
    what: string;
    why: string;
    now: string;
    whatChanges: string;
    actionKey?: string;
    status?: string;
    priorityScore?: number;
  }> = [];
  const seen = new Set<string>();

  for (const action of customerRanked) {
    const key = action.title.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      what: action.title,
      why: action.why,
      now: "Can be done now",
      whatChanges: action.what_changes,
      actionKey: action.action_id,
      status: "READY",
      priorityScore: action.priority_score,
    });
    if (out.length >= limit) return out;
  }

  const generics: typeof out = [];
  for (const item of input.existing) {
    const key = item.what.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    const generic =
      isGenericActionId(item.actionKey) || isGenericActionTitle(item.what);
    if (generic && customerRanked.length > 0) {
      generics.push(item);
      continue;
    }
    seen.add(key);
    out.push(item);
    if (out.length >= limit) return out;
  }

  for (const item of generics) {
    const key = item.what.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
    if (out.length >= limit) break;
  }

  return out.slice(0, limit);
}

/** Golden expected order for the VAWA prima facie fixture (customer + system). */
export const VAWA_PRIMA_FACIE_EXPECTED_ACTION_IDS = [
  "UPLOAD_I485_RECEIPT",
  "UPLOAD_POST_PRIMA_FACIE_NOTICES",
  "UPLOAD_WAIVER_NOTICE",
  "CONFIRM_I485_PROCEDURAL_STATUS",
  "UPDATE_GREEN_CARD_PATH_EXPLANATION",
] as const;
