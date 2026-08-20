import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_PROMPTS, PROMPT_SUPERSEDES, PROMPT_VERSION } from "../src/lib/ai/prompts";
import { buildEvidenceGateBriefFromReconciled, compileImmigrationEvidence, computeEvidenceReadinessSplit, evaluateEvidenceAction, guardLetterDraftWithEvidence, reconcileEvidenceStates } from "../src/lib/evidence";

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
assert(evaluateEvidenceAction("GET_CASE_RECORD", gate)?.satisfied === true, "receipt + form evidence should satisfy case-record action");
assert(evaluateEvidenceAction("UPLOAD_NOTICE", gate)?.satisfied === true, "notice evidence should satisfy upload-notice action");
assert(evaluateEvidenceAction("ADD_DEADLINE", gate)?.satisfied === true, "deadline evidence should satisfy deadline action");
assert(evaluateEvidenceAction("DRAFT_LETTER", gate)?.satisfied === false, "letter action should still require a drafted letter");
for (const promptKey of ["analyst", "reviewer", "presenter"]) {
  const prompt = DEFAULT_PROMPTS[promptKey];
  assert(prompt.includes("evidence_gate"), `${promptKey} prompt should mention evidence_gate`);
  assert(prompt.includes("suppressed"), `${promptKey} prompt should mention suppressed questions`);
  assert((PROMPT_SUPERSEDES[promptKey] ?? []).length > 0, `${promptKey} prompt should declare superseded hashes`);
}
assert(DEFAULT_PROMPTS.notice_explainer.includes("COMPILED CASE EVIDENCE BRIEF"), "notice explainer prompt should mention compiled evidence brief");
assert((PROMPT_SUPERSEDES.notice_explainer ?? []).length > 0, "notice explainer prompt should declare superseded hashes");
assert(DEFAULT_PROMPTS.guide.includes("current evidence position"), "guide prompt should mention current evidence position");
assert((PROMPT_SUPERSEDES.guide ?? []).length > 0, "guide prompt should declare superseded hashes");
assert(PROMPT_VERSION.includes("v32"), "prompt version should identify v32 evidence prompts");
const readiness = computeEvidenceReadinessSplit({
  documentsCount: 2,
  documentsExpected: 3,
  extractedDocumentsCount: 2,
  needsReviewDocumentsCount: 0,
  reconciled,
});
assert(readiness.evidenceAvailableScore === 67, `expected evidence available 67, got ${readiness.evidenceAvailableScore}`);
assert(readiness.evidenceProcessedScore === 100, `expected evidence processed 100, got ${readiness.evidenceProcessedScore}`);
assert(readiness.actionReadinessScore === 100, `expected action readiness 100, got ${readiness.actionReadinessScore}`);
const letterBrief = {
  status: gate.status,
  currentPosition: gate.currentPosition,
  summary: gate.summary,
  facts: gate.facts,
  events: gate.events,
  unknowns: gate.unknowns,
  pendingActions: gate.pendingActions,
  text: gate.promptText,
  supportedText: [gate.currentPosition, gate.summary, ...gate.pendingActions, ...gate.facts.flatMap((fact) => [fact.key, fact.value, fact.source]), ...gate.events.flatMap((event) => [event.eventType, event.title, event.dateText])].join("\n").toUpperCase(),
};
const guardedLetter = guardLetterDraftWithEvidence(
  "USCIS should continue processing Form I-485 for receipt MSC2390123456 by July 31, 2026. Please also update WAC0000000000 by August 5, 2026.",
  letterBrief,
);
assert(guardedLetter.changed === true, "letter guard should replace unsupported values");
assert(guardedLetter.text.includes("MSC2390123456"), "letter guard should keep supported receipt number");
assert(guardedLetter.text.includes("I-485"), "letter guard should keep supported form type");
assert(!guardedLetter.text.includes("WAC0000000000"), "letter guard should remove unsupported receipt number");
assert(!guardedLetter.text.includes("August 5, 2026"), "letter guard should remove unsupported date");

console.log("v3.2 immigration evidence check passed");
console.log(`- ${receipt.documentType}: ${receipt.facts.length} facts, ${receipt.events.length} events`);
console.log(`- ${rfe.documentType}: ${rfe.facts.length} facts, ${rfe.events.length} events`);
console.log(`- reconciled: ${reconciled.facts.length} facts, ${reconciled.events.length} events, ${reconciled.crossDocumentRelationships.length} cross-document link(s)`);
console.log(`- evidence gate: ${gate.status}, can analyze: ${gate.canAnalyze ? "yes" : "no"}`);
console.log("- action intelligence: case record, notice, and deadline satisfied from evidence");
console.log("- prompts: analyst, reviewer, and presenter are evidence-gate aware");
console.log(`- readiness split: available ${readiness.evidenceAvailableScore}, processed ${readiness.evidenceProcessedScore}, action ${readiness.actionReadinessScore}`);
console.log(`- letter guard: replaced ${guardedLetter.findings.length} unsupported value(s)`);
