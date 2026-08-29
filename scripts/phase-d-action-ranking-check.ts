/**
 * Phase D — deterministic action priority formula + INV-ACT-01.
 * Run: npx tsx scripts/phase-d-action-ranking-check.ts
 */
import assert from "node:assert/strict";
import {
  VAWA_PRIMA_FACIE_EXPECTED_ACTION_IDS,
  buildLedgerDrivenActions,
  computePriorityScore,
  isGenericActionId,
  mergeRankedCustomerActions,
  rankScoredActions,
} from "../src/lib/action-priority";
import { buildFactLedger } from "../src/lib/evidence/fact-ledger";
import { assembleV5CustomerPresentation } from "../src/lib/v5-customer-presentation";
import { buildSituationBrief, VAWA_PRIMA_FACIE_FIXTURE } from "../src/lib/situation-brief";

function main() {
  // Formula matches golden scores.
  assert.equal(
    computePriorityScore({
      legal_case_materiality: 5,
      evidence_gap_importance: 5,
      deadline_urgency: 2,
      goal_relevance: 5,
      ability_to_resolve: 5,
    }),
    59,
  );
  assert.equal(
    computePriorityScore({
      legal_case_materiality: 5,
      evidence_gap_importance: 4,
      deadline_urgency: 3,
      goal_relevance: 4,
      ability_to_resolve: 5,
    }),
    55,
  );
  assert.equal(
    computePriorityScore({
      legal_case_materiality: 4,
      evidence_gap_importance: 4,
      deadline_urgency: 3,
      goal_relevance: 4,
      ability_to_resolve: 5,
    }),
    52,
  );
  assert.equal(
    computePriorityScore({
      legal_case_materiality: 4,
      evidence_gap_importance: 3,
      deadline_urgency: 3,
      goal_relevance: 5,
      ability_to_resolve: 4,
    }),
    50,
  );
  assert.equal(
    computePriorityScore({
      legal_case_materiality: 3,
      evidence_gap_importance: 2,
      deadline_urgency: 1,
      goal_relevance: 5,
      ability_to_resolve: 3,
    }),
    38,
  );

  const docs = (VAWA_PRIMA_FACIE_FIXTURE.documents ?? []).map((doc, i) => ({
    id: `doc_${i}`,
    fileName: doc.fileName,
    documentType: doc.documentType,
    contentHash: `hash_${i}`,
    text: doc.text,
  }));
  const ledger = buildFactLedger({
    situation: VAWA_PRIMA_FACIE_FIXTURE.situation,
    goal: VAWA_PRIMA_FACIE_FIXTURE.goal,
    documents: docs,
  });
  const ranked = buildLedgerDrivenActions({ ledger });
  assert.deepEqual(
    ranked.map((a) => a.action_id),
    [...VAWA_PRIMA_FACIE_EXPECTED_ACTION_IDS],
  );
  assert.deepEqual(
    ranked.map((a) => a.priority_score),
    [59, 55, 52, 50, 38],
  );
  assert.equal(ranked[4].actor, "system");
  assert.ok(ranked.slice(0, 4).every((a) => a.actor === "customer"));

  // Tie-break: same score → blocks_goal_progress first, then deadline, then action_id.
  const tied = rankScoredActions([
    {
      action_id: "B_SECOND",
      priority_score: 40,
      blocks_goal_progress: false,
      scores: { deadline_urgency: 5 },
    },
    {
      action_id: "A_FIRST",
      priority_score: 40,
      blocks_goal_progress: true,
      scores: { deadline_urgency: 1 },
    },
  ]);
  assert.equal(tied[0].action_id, "A_FIRST");

  // INV-ACT-01: generics demoted below gap resolvers.
  const merged = mergeRankedCustomerActions({
    ranked,
    existing: [
      {
        what: "Review Form I-360",
        why: "generic",
        now: "Can be done now",
        whatChanges: "x",
        actionKey: "REVIEW_FORM_I360",
      },
      {
        what: "Ask a follow-up",
        why: "generic",
        now: "Can be done now",
        whatChanges: "x",
        actionKey: "ASK_FOLLOW_UP",
      },
    ],
    limit: 6,
  });
  const keys = merged.map((a) => a.actionKey);
  assert.equal(keys[0], "UPLOAD_I485_RECEIPT");
  assert.ok(keys.indexOf("REVIEW_FORM_I360") > keys.indexOf("UPLOAD_I485_RECEIPT"));
  assert.ok(isGenericActionId("REVIEW_FORM_I360"));
  assert.ok(isGenericActionId("ASK_FOLLOW_UP"));

  // Customer presentation order follows scores (customer actions only).
  const brief = buildSituationBrief(VAWA_PRIMA_FACIE_FIXTURE);
  const view = assembleV5CustomerPresentation({
    brief,
    documents: docs,
    factLedger: ledger,
  });
  assert.ok(view.whatToDoNext.length >= 3);
  assert.match(view.whatToDoNext[0].what, /I-485 receipt/i);
  assert.equal(view.whatToDoNext[0].actionKey, "UPLOAD_I485_RECEIPT");
  // System UPDATE_GREEN_CARD_PATH_EXPLANATION must not appear as a customer CTA.
  assert.ok(!view.whatToDoNext.some((a) => a.actionKey === "UPDATE_GREEN_CARD_PATH_EXPLANATION"));
  // Generics must not lead when gaps exist.
  assert.ok(!/^Review Form I-360|^Ask a follow-up|^Keep the prima facie/i.test(view.whatToDoNext[0].what));

  console.log("phase-d-action-ranking-check: ok");
}

main();
