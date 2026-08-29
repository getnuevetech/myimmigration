/**
 * Phase −1 Model Responsibility Contract checks.
 * Run: npx tsx scripts/phase-minus1-model-responsibility-check.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DEFAULT_CAPABILITY_PROVIDERS,
  MODEL_CAPABILITIES,
  STAGE_CAPABILITY,
  preferCapabilitySteps,
} from "../src/lib/ai/model-capabilities";
import {
  documentsBlockFromIntelligence,
  ledgerFactsFromDocumentIntelligence,
  parseDocumentIntelligence,
} from "../src/lib/ai/document-intelligence";
import { DEFAULT_PROMPTS } from "../src/lib/ai/prompts";

assert.equal(DEFAULT_CAPABILITY_PROVIDERS.primary_reasoning, "OpenAI GPT-5.6 Sol");
assert.equal(DEFAULT_CAPABILITY_PROVIDERS.document_intelligence, "Anthropic Claude Opus 5");
assert.equal(DEFAULT_CAPABILITY_PROVIDERS.presentation, "OpenAI GPT-5.6 Sol");
assert.equal(STAGE_CAPABILITY.qa, MODEL_CAPABILITIES.PRIMARY_REASONING);
assert.equal(STAGE_CAPABILITY.document, MODEL_CAPABILITIES.DOCUMENT_INTELLIGENCE);
assert.equal(STAGE_CAPABILITY.presenter, MODEL_CAPABILITIES.PRESENTATION);
assert.equal(STAGE_CAPABILITY.situation, MODEL_CAPABILITIES.PRIMARY_REASONING);

const preferred = preferCapabilitySteps(
  [
    { providerId: "a", provider: { id: "a", name: "Other" } },
    { providerId: "sol", provider: { id: "sol", name: "OpenAI GPT-5.6 Sol" } },
  ],
  "sol",
);
assert.equal(preferred.length, 1);
assert.equal(preferred[0].providerId, "sol");

assert.ok(DEFAULT_PROMPTS.document_intelligence.includes("Document Evidence Engine"));
assert.ok(DEFAULT_PROMPTS.document_intelligence.includes("provenance") || DEFAULT_PROMPTS.document_intelligence.includes("source_location"));
assert.ok(DEFAULT_PROMPTS.document_intelligence.includes("Must not") || DEFAULT_PROMPTS.document_intelligence.includes("Do NOT produce customer-facing"));
assert.ok(DEFAULT_PROMPTS.notice_customer_explain.includes("PRIOR DOCUMENT FINDINGS"));
assert.ok(DEFAULT_PROMPTS.presenter.includes("Presentation Engine") || DEFAULT_PROMPTS.presenter.includes("LOCKED"));

const payload = parseDocumentIntelligence({
  document_type: "I-862",
  facts: [{ fact: "Notice to Appear issued", value: true, source_location: "page_1", confidence: 0.99 }],
  procedural_findings: [{ finding: "Document appears to initiate removal proceedings", source: "page_1", confidence: 0.97 }],
  receipt_number: null,
  form_number: "I-862",
});
assert.ok(payload);
const ledger = ledgerFactsFromDocumentIntelligence(payload!);
assert.ok(ledger.some((r) => r.key === "form_type" && r.value === "I-862"));
assert.ok(ledger.some((r) => /notice_to_appear|notice_to_appear_issued/i.test(r.key) || r.value === "true"));
const block = documentsBlockFromIntelligence(payload, {});
assert.equal((block as { document_intelligence: boolean }).document_intelligence, true);

const seed = readFileSync(join(process.cwd(), "prisma/seed.ts"), "utf8");
assert.ok(seed.includes('role: "document_intelligence"'), "seed must assign Opus document_intelligence role");
assert.ok(seed.includes("ai.capability.primary_reasoning"), "seed must persist capability aliases");
assert.ok(seed.includes("ai.capability.document_intelligence"));
assert.ok(!/qa[\s\S]{0,400}Anthropic Claude Opus 5[\s\S]{0,80}assistant/.test(seed) || seed.includes("Single brain"), "QA must not chain competing assistants as primary design");
// document stage should not list Gemini as extractor_b in the contract stages block
const docStage = seed.slice(seed.indexOf('key: "document"'), seed.indexOf('key: "situation"'));
assert.ok(docStage.includes("Anthropic Claude Opus 5"));
assert.ok(!docStage.includes("extractor_b"), "document stage must not use dual competing extractors");

const orch = readFileSync(join(process.cwd(), "src/lib/ai/orchestrator.ts"), "utf8");
assert.ok(orch.includes("preferCapabilitySteps") || orch.includes("resolveCapabilityProvider"), "orchestrator must honor capability aliases");
assert.ok(orch.includes("ledgerFactsFromDocumentIntelligence"), "Opus findings must enter evidence facts");
assert.ok(orch.includes("sequentialContext: true"), "notice path must run Opus then Sol sequentially");

const spec = readFileSync(join(process.cwd(), "docs/v5.1/PHASE-MINUS1-CONVERSATION-INTELLIGENCE.md"), "utf8");
assert.ok(spec.includes("Model Responsibility Contract"));
assert.ok(spec.includes("PRIMARY_REASONING_MODEL"));
assert.ok(spec.includes("DOCUMENT_INTELLIGENCE_MODEL"));
assert.ok(spec.includes("PRESENTATION_MODEL"));
assert.ok(/must not/i.test(spec), "spec must define must-not boundaries");

console.log("phase-minus1-model-responsibility-check: ok");
