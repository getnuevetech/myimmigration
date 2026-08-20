import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildEvidenceGateBriefFromReconciled, compileImmigrationEvidence, reconcileEvidenceStates } from "../src/lib/evidence";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function fixture(name: string): string {
  return readFileSync(join(process.cwd(), "scripts", "fixtures", "evidence", name), "utf8");
}

const receipt = compileImmigrationEvidence({
  id: "fixture-i797",
  fileName: "i797-receipt.txt",
  text: fixture("i797-receipt.txt"),
});

const rfe = compileImmigrationEvidence({
  id: "fixture-rfe",
  fileName: "rfe-notice.txt",
  text: fixture("rfe-notice.txt"),
});

const receiptFacts = receipt.facts.map((fact) => `${fact.key}:${fact.value}`);
const rfeFacts = rfe.facts.map((fact) => `${fact.key}:${fact.value}`);

assert(receipt.documentType === "i797_notice", `expected I-797 classification, got ${receipt.documentType}`);
assert(receiptFacts.includes("receipt_number:MSC2390123456"), "receipt fixture should extract receipt number");
assert(receiptFacts.includes("form_type:I-485"), "receipt fixture should extract I-485 form type");
assert(receipt.suppressedQuestions.some((item) => item.questionKey === "receipt_number"), "receipt number question should be suppressed");
assert(receipt.audit.status === "pass", `receipt audit should pass, got ${receipt.audit.status}`);

assert(rfe.documentType === "rfe", `expected RFE classification, got ${rfe.documentType}`);
assert(rfeFacts.includes("notice_type:RFE"), "RFE fixture should extract notice type");
assert(rfe.facts.some((fact) => fact.key === "response_deadline" && /July 31, 2026/.test(fact.value)), "RFE fixture should extract response deadline");
assert(rfe.facts.some((fact) => fact.key === "requested_evidence"), "RFE fixture should extract requested evidence");
assert(rfe.relationships.some((rel) => rel.relationType === "deadline_for_notice"), "RFE deadline should relate to the notice");

const combined = JSON.stringify([receipt, rfe]).toLowerCase();
const forbiddenTaxTerms = [/\birs\b/, /\btax transcript\b/, /\bform 9465\b/, /\brefund\b/, /\bbalance due\b/];
for (const forbidden of forbiddenTaxTerms) {
  assert(!forbidden.test(combined), `evidence output leaked forbidden tax term: ${forbidden}`);
}

const reconciled = reconcileEvidenceStates([receipt, rfe]);
assert(reconciled.audit.status === "pass", `reconciled audit should pass, got ${reconciled.audit.status}`);
assert(reconciled.crossDocumentRelationships.some((rel) => rel.relationType === "same_receipt"), "I-797 and RFE should link by shared receipt number");
assert(reconciled.suppressedQuestions.some((item) => item.questionKey === "receipt_number"), "reconciled receipt question should be suppressed");
assert(reconciled.reconstruction.currentPosition === "RFE notice needs review", `unexpected current position: ${reconciled.reconstruction.currentPosition}`);
assert(reconciled.reconstruction.pendingActions.some((action) => /RFE response by July 31, 2026/.test(action)), "RFE deadline should become a pending action");
const gate = buildEvidenceGateBriefFromReconciled(reconciled);
assert(gate.status === "pass", `evidence gate should pass, got ${gate.status}`);
assert(gate.mustGroundClaims === true, "evidence gate should require grounded claims");
assert(gate.promptText.includes("GROUNDING RULE"), "evidence gate prompt should include grounding rule");
assert(gate.promptText.includes("RFE notice needs review"), "evidence gate prompt should include current position");

console.log("v3.2 immigration evidence check passed");
console.log(`- ${receipt.documentType}: ${receipt.facts.length} facts, ${receipt.events.length} events`);
console.log(`- ${rfe.documentType}: ${rfe.facts.length} facts, ${rfe.events.length} events`);
console.log(`- reconciled: ${reconciled.facts.length} facts, ${reconciled.events.length} events, ${reconciled.crossDocumentRelationships.length} cross-document link(s)`);
console.log(`- evidence gate: ${gate.status}, can analyze: ${gate.canAnalyze ? "yes" : "no"}`);
