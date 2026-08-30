/**
 * Phase −1.9 L1 — de-identification + cross-user shared store guards.
 * Run: npx tsx scripts/phase-minus1-9-l1-deid-check.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runConversationIntelligence } from "../src/lib/conversation";
import {
  assertSafeForSharedExperience,
  deidentifyExperienceRecord,
  textLooksLikePii,
  scrubFreeText,
  filterForCrossUserRead,
  type ExperienceRecordV0,
} from "../src/lib/experience";

const CANONICAL =
  "I came in from Mexico through the border and been living in the US for 3 years, my wife is a US citizen and our daughter was born in the US, I am yet to file for any document, what are my options?";

{
  assert.equal(textLooksLikePii("contact me at jane@example.com"), true);
  assert.equal(textLooksLikePii("A123456789"), true);
  assert.equal(textLooksLikePii("receipt MSC2190123456"), true);
  assert.equal(textLooksLikePii("manner_of_entry"), false);
  assert.match(scrubFreeText("Email jane@example.com please"), /\[redacted\]/);
}

{
  const intel = runConversationIntelligence({ message: CANONICAL, goal: "options" });
  const record = intel.experience_record as ExperienceRecordV0;
  assert.equal(record.schema_version, "l0");

  const poisoned: ExperienceRecordV0 = {
    ...record,
    question_contract: {
      ...record.question_contract,
      explicit_question: "Help A123456789 at 123 Main Street and jane@x.com MSC2190123456",
      interpreted_question: "Help A123456789",
    },
    documents_used: ["Jane_Doe_passport_MSC2190123456.pdf"],
    clarification_selected: {
      key: "manner_of_entry",
      question: "Were you inspected? Call 555-123-4567",
      reason: "Determines pathway branch",
    },
  };

  const anon = deidentifyExperienceRecord(poisoned, { sourceId: "sit_test" });
  assert.equal(anon.schema_version, "l1_anon");
  assert.equal(anon.decision_target, record.decision_target);
  assert.equal(anon.clarification_key, "manner_of_entry");
  assert.ok(anon.document_kinds.includes("pdf") || anon.document_kinds.includes("receipt_notice") || anon.document_kinds.length >= 1);
  assert.equal(anon.promotion_level, 0);
  assert.ok(!("question_contract" in anon));
  assert.doesNotMatch(JSON.stringify(anon), /A123456789|jane@|555-123|Main Street|MSC2190123456/i);
  assertSafeForSharedExperience(anon);

  const listed = filterForCrossUserRead(
    [{ ownerUserId: "u1", raw: poisoned, anon }],
    "u2",
  );
  assert.equal(listed.length, 1);
  assert.equal(listed[0].schema_version, "l1_anon");
}

{
  const root = process.cwd();
  const schema = readFileSync(join(root, "prisma/schema.prisma"), "utf8");
  assert.ok(schema.includes("model ExperienceObservation"));
  const mig = readFileSync(
    join(root, "prisma/migrations/20260830070000_experience_observation_l1/migration.sql"),
    "utf8",
  );
  assert.ok(mig.includes("ExperienceObservation"));
  const pub = readFileSync(join(root, "src/lib/experience/publish.ts"), "utf8");
  assert.ok(pub.includes("listProductionPatterns"));
  assert.ok(pub.includes("minPromotionLevel: 4"));
  const create = readFileSync(join(root, "src/lib/situation-create.ts"), "utf8");
  assert.ok(create.includes("publishSituationExperience"));
  const doc = readFileSync(join(root, "docs/v5.1/PHASE-MINUS1-9-EXPERIENCE-INSTITUTIONAL-LEARNING.md"), "utf8");
  assert.ok(/L1/.test(doc));
}

console.log("phase-minus1-9-l1-deid-check: ok");
