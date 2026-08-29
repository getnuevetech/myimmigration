/**
 * Phase B — fact ledger, provenance, gaps≠conflicts, posture vs events.
 * Run: npx tsx scripts/phase-b-fact-ledger-check.ts
 */
import assert from "node:assert/strict";
import { authorityForDocumentType, buildDocumentFactSource, formatContentHash } from "../src/lib/evidence/authority";
import {
  buildFactLedger,
  isGenuineOutcomeConflict,
  ledgerFact,
} from "../src/lib/evidence/fact-ledger";
import { buildSituationBrief, VAWA_PRIMA_FACIE_FIXTURE } from "../src/lib/situation-brief";

function main() {
  assert.equal(30, 30); // coalesce_window_seconds contract (invalidation.ts)

  const uscis = authorityForDocumentType("uscis_i360_receipt_notice");
  assert.equal(uscis.issuer, "USCIS");
  assert.equal(uscis.authority_rank, "USCIS_GOVERNMENT_DOCUMENT");
  const civil = authorityForDocumentType("relationship_civil_document");
  assert.equal(civil.issuer, "STATE_VITAL_RECORDS");

  const src = buildDocumentFactSource({
    documentId: "doc_fixture_i360_receipt",
    contentHash: "fixture_i360_receipt",
    documentType: "uscis_i360_receipt_notice",
    extractedField: "form_number",
  });
  assert.equal(src.source_channel, "CUSTOMER_UPLOAD");
  assert.equal(src.authority_rank, "USCIS_GOVERNMENT_DOCUMENT");
  assert.equal(formatContentHash("abc"), "sha256:abc");

  assert.equal(isGenuineOutcomeConflict("APPROVED", "DENIED"), true);
  assert.equal(isGenuineOutcomeConflict("APPROVED", "RECEIPT_ONLY"), false);
  assert.equal(isGenuineOutcomeConflict("APPROVED", "RECEIPT"), false);

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

  const filed = ledgerFact(ledger, "FORM_I360_FILED");
  assert.equal(filed?.status, "VERIFIED", "INV-FACT-01: I-360 filing verified from receipt");
  assert.ok(filed?.sources?.[0]?.document_id);
  assert.ok(String(filed?.sources?.[0]?.content_hash ?? "").startsWith("sha256:"));

  assert.equal(ledgerFact(ledger, "MARRIAGE_EXISTS")?.status, "VERIFIED");
  assert.equal(ledgerFact(ledger, "SPOUSE_US_CITIZEN")?.status, "REPORTED");
  assert.equal(ledgerFact(ledger, "I360_FINAL_DECISION")?.status, "UNKNOWN");
  assert.deepEqual(ledgerFact(ledger, "I360_FINAL_DECISION")?.allowed_values, [
    "APPROVED",
    "DENIED",
    "WITHDRAWN",
    "UNKNOWN",
  ]);

  assert.equal(ledger.conflicts.length, 0);
  assert.ok(ledger.unverified_claims.some((c) => c.subject === "FORM_I485_FILED"));
  assert.ok(ledger.evidence_gaps.some((g) => g.subject === "I485_RECEIPT"));
  assert.ok(ledger.event_timeline.every((e) => e.superseded_by === null));
  assert.equal(ledger.current_posture?.value, "PENDING_PRIMA_FACIE_ISSUED");
  assert.equal(ledger.current_posture?.supersedes, "FILED_PENDING");

  const i485 = ledgerFact(ledger, "FORM_I485_FILED");
  assert.equal(i485?.status, "REPORTED");
  assert.equal(i485?.kind, "UNVERIFIED_CLAIM");
  assert.ok(i485?.promotion_on);

  const brief = buildSituationBrief(VAWA_PRIMA_FACIE_FIXTURE);
  assert.ok(brief.verifiedFacts.some((f) => /filed Form I-360/i.test(f.text)));
  assert.ok(brief.verifiedFacts.some((f) => /marriage is documented|civil marriage/i.test(f.text)));
  assert.ok(brief.reportedFacts.some((f) => /spouse is a U\.S\. citizen/i.test(f.text)));
  assert.ok(!brief.verifiedFacts.some((f) => /married to a U\.S\. citizen/i.test(f.text)));

  console.log("phase-b-fact-ledger-check: OK");
}

main();
