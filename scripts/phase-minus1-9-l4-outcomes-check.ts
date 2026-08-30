/**
 * Phase −1.9 L4 — government outcome signals → authority-checked pattern candidates.
 * Run: npx tsx scripts/phase-minus1-9-l4-outcomes-check.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runConversationIntelligence } from "../src/lib/conversation";
import {
  OUTCOME_CANDIDATE_LEVEL,
  applyGovernmentOutcome,
  assertIsOutcomeCandidate,
  assertSafeForSharedExperience,
  authorityKeysRecognized,
  buildOutcomePatternCandidate,
  checkOutcomeAuthority,
  listProductionPatterns,
  normalizeOutcomeInput,
  type ExperienceRecordV0,
} from "../src/lib/experience";

const CANONICAL =
  "I came in from Mexico through the border and been living in the US for 3 years, my wife is a US citizen and our daughter was born in the US, I am yet to file for any document, what are my options?";

{
  const bad = checkOutcomeAuthority({
    outcome_kind: "approved",
    government_system: "uscis",
    form_or_notice_key: "i_485",
    authority_keys: [],
    authority_publisher: "USCIS",
    note_key: "aos_approved_after_entry_known",
  });
  assert.equal(bad.ok, false);
  assert.match(bad.reason, /authority_key/i);
  assert.equal(bad.outranked_by, "current_authority");
}

{
  const receiptShaped = checkOutcomeAuthority({
    outcome_kind: "receipt_issued",
    government_system: "uscis",
    form_or_notice_key: "i_130",
    authority_keys: ["msc2190123456"],
    authority_publisher: "USCIS",
    note_key: "receipt_notice_recorded",
  });
  assert.equal(receiptShaped.ok, false);
  assert.match(receiptShaped.reason, /receipt/i);
}

{
  const unknownPublisher = checkOutcomeAuthority({
    outcome_kind: "denied",
    government_system: "uscis",
    form_or_notice_key: "i_485",
    authority_keys: ["uscis_policy_manual"],
    authority_publisher: "RANDOM_BLOG",
    note_key: "denial_recorded",
  });
  assert.equal(unknownPublisher.ok, false);
}

{
  const ok = checkOutcomeAuthority({
    outcome_kind: "rfe_issued",
    government_system: "uscis",
    form_or_notice_key: "rfe",
    decision_changing_facts: ["manner_of_entry", "marriage_bona_fides"],
    authority_keys: ["uscis_policy_manual", "form_i_485_instructions"],
    authority_publisher: "USCIS",
    note_key: "rfe_after_aos_filing",
  });
  assert.equal(ok.ok, true);
  assert.equal(ok.signal_precedence, "historical_experience");
  assert.equal(ok.outranked_by, "current_authority");
  assert.match(ok.reason, /outcome ≠ law|historical experience/i);
}

{
  assert.throws(() =>
    normalizeOutcomeInput({
      outcome_kind: "approved",
      government_system: "uscis",
      form_or_notice_key: "I-485 Approved for Jane",
      authority_keys: ["uscis_policy_manual"],
      authority_publisher: "USCIS",
      note_key: "ok_note",
    }),
  );
}

{
  const recognized = authorityKeysRecognized(["uscis_policy_manual", "missing_key"], ["uscis_policy_manual"]);
  assert.equal(recognized.ok, false);
  assert.deepEqual(recognized.missing, ["missing_key"]);
  assert.equal(authorityKeysRecognized(["a"], []).ok, true); // empty catalog skips
}

{
  const intel = runConversationIntelligence({
    message: "My I-485 was filed and USCIS issued an RFE about my entry.",
    goal: "what does this mean",
  });
  const record = intel.experience_record as ExperienceRecordV0;

  const updated = applyGovernmentOutcome(record, {
    outcome_kind: "rfe_issued",
    government_system: "uscis",
    form_or_notice_key: "rfe",
    decision_changing_facts: ["manner_of_entry"],
    authority_keys: ["uscis_policy_manual", "form_i_485_instructions"],
    authority_publisher: "USCIS",
    note_key: "rfe_entry_evidence",
  });

  assert.ok(updated.outcome);
  assert.equal(updated.outcome!.kind, "rfe_issued");
  assert.equal(updated.outcome!.authority_check, "passed");
  assert.equal(updated.outcome!.signal_precedence, "historical_experience");
  assert.equal(updated.existing_government_case, true);
  assert.ok(updated.decision_changing_facts.includes("manner_of_entry"));
  assert.ok(updated.authority_ids.includes("uscis_policy_manual"));

  const candidate = buildOutcomePatternCandidate(updated, { sourceId: "sit_l4_test" });
  assert.equal(candidate.promotion_level, OUTCOME_CANDIDATE_LEVEL);
  assert.equal(candidate.promotion_level, 1);
  assert.equal(candidate.origin, "government_outcome");
  assert.ok(candidate.outcome);
  assert.equal(candidate.outcome!.outcome_kind, "rfe_issued");
  assert.equal(candidate.outcome!.signal_precedence, "historical_experience");
  assert.equal(candidate.outcome!.outranked_by, "current_authority");
  assert.equal(candidate.outcome_kind, "rfe_issued");
  assertIsOutcomeCandidate(candidate);
  assertSafeForSharedExperience(candidate);
  assert.doesNotMatch(JSON.stringify(candidate), /Mexico|Jane|@|MSC\d+/i);
}

{
  assert.throws(() =>
    applyGovernmentOutcome(runConversationIntelligence({ message: CANONICAL }).experience_record as ExperienceRecordV0, {
      outcome_kind: "approved",
      government_system: "uscis",
      form_or_notice_key: "i_485",
      authority_keys: [],
      authority_publisher: "USCIS",
      note_key: "should_fail",
    }),
  );
}

{
  const pub = readFileSync(join(process.cwd(), "src/lib/experience/publish.ts"), "utf8");
  assert.ok(pub.includes("publishPatternCandidateFromOutcome"));
  assert.ok(pub.includes("minPromotionLevel: 4"));
  assert.ok(pub.includes("promotionLevel: 1"));
  assert.equal(typeof listProductionPatterns, "function");

  const action = readFileSync(join(process.cwd(), "src/actions/experience-outcome.ts"), "utf8");
  assert.ok(action.includes("recordGovernmentOutcomeAction"));
  assert.ok(action.includes("historical experience"));
  assert.ok(!/fine-?tun/i.test(action));
}

{
  const doc = readFileSync(join(process.cwd(), "docs/v5.1/PHASE-MINUS1-9-EXPERIENCE-INSTITUTIONAL-LEARNING.md"), "utf8");
  assert.ok(/L4/.test(doc));
  assert.ok(/Outcome ≠ law|outcome ≠ law|Outcome != law/i.test(doc) || doc.includes("Outcome ≠ law"));
  assert.ok(doc.includes("test:phase-minus1-9-l4"));
  assert.ok(/government outcome/i.test(doc));
}

console.log("phase-minus1-9-l4-outcomes-check: ok");
