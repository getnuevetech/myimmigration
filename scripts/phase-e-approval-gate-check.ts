/**
 * Phase E — approval gate BLOCK/WARNING + audit trail.
 * Run: npx tsx scripts/phase-e-approval-gate-check.ts
 */
import assert from "node:assert/strict";
import {
  APPROVAL_GATE_BLOCK_IDS,
  FIXTURE_PRIMA_FACIE_LEGAL_INTERPRETATION,
  approvalGateAllowsCustomerApprove,
  evaluateApprovalGate,
  withGateOverride,
} from "../src/lib/approval-gate";
import { buildCanonicalApprovedState, selectApprovedPresentation } from "../src/lib/canonical-case-state";
import { buildFactLedger } from "../src/lib/evidence/fact-ledger";
import {
  assembleV5CustomerPresentation,
  v5CustomerPresentationText,
} from "../src/lib/v5-customer-presentation";
import { buildSituationBrief, VAWA_PRIMA_FACIE_FIXTURE } from "../src/lib/situation-brief";
import { caseTypeLockFromBrief } from "../src/lib/case-type-lock";
import { buildAnalysisPlan } from "../src/lib/case-analysis-plan";

function main() {
  const brief = buildSituationBrief(VAWA_PRIMA_FACIE_FIXTURE);
  const lock = caseTypeLockFromBrief(brief);
  const docs = (VAWA_PRIMA_FACIE_FIXTURE.documents ?? []).map((doc, i) => ({
    id: `doc_${i}`,
    fileName: doc.fileName,
    documentType: doc.documentType,
    contentHash: `hash_${i}`,
  }));
  const ledger = buildFactLedger({
    situation: VAWA_PRIMA_FACIE_FIXTURE.situation,
    goal: VAWA_PRIMA_FACIE_FIXTURE.goal,
    documents: docs.map((d) => ({ ...d, text: "" })),
  });
  const view = assembleV5CustomerPresentation({ brief, documents: docs });
  const text = v5CustomerPresentationText(view);

  // Healthy VAWA fixture: PASS or WARN only (warnings expected for gaps).
  const healthy = evaluateApprovalGate({
    brief,
    lock,
    documents: docs,
    factLedger: ledger,
    customerPresentation: view,
    customerText: text,
    customerOutputStale: false,
    legalInterpretation: FIXTURE_PRIMA_FACIE_LEGAL_INTERPRETATION,
    assertsMaterialLegalMeaning: true,
    logicalAnalysisId: "la_fixture",
    caseVersionId: "ver_fixture",
    caseId: "case_fixture",
  });
  assert.notEqual(healthy.gate_result, "BLOCK", `healthy fixture must not BLOCK: ${healthy.rule_ids.join(",")}`);
  assert.ok(healthy.warnings.length >= 1, "fixture should surface gap/unverified warnings");
  assert.ok(healthy.warnings.some((w) => w.rule_id === "WARN-UNKNOWN-I485-RECEIPT"));
  assert.ok(healthy.warnings.some((w) => w.rule_id === "WARN-EVIDENCE-GAP-NOT-CONFLICT"));
  assert.ok(healthy.warnings.some((w) => w.rule_id === "WARN-UNVERIFIED-CLAIM-NOT-CONFLICT"));
  assert.ok(healthy.evaluated_at);
  assert.equal(healthy.logical_analysis_id, "la_fixture");
  assert.equal(approvalGateAllowsCustomerApprove(healthy), true);

  // Misclassified I-360 receipt → BLOCK
  const misclass = evaluateApprovalGate({
    brief,
    lock,
    documents: [{ fileName: "I-360-receipt.pdf", documentType: "identity_document", docKind: "identity" }],
    customerText: "ok",
    legalInterpretation: FIXTURE_PRIMA_FACIE_LEGAL_INTERPRETATION,
  });
  assert.equal(misclass.gate_result, "BLOCK");
  assert.ok(misclass.rule_ids.includes("BLOCK-DOC-MISCLASS-I360-RECEIPT-AS-IDENTITY"));

  // Declaration as identity → BLOCK
  const decl = evaluateApprovalGate({
    brief,
    lock,
    documents: [{ fileName: "personal-declaration.pdf", documentType: "identity_document", docKind: "identity" }],
    customerText: "ok",
    legalInterpretation: FIXTURE_PRIMA_FACIE_LEGAL_INTERPRETATION,
  });
  assert.ok(decl.rule_ids.includes("BLOCK-DOC-MISCLASS-DECLARATION-AS-IDENTITY"));

  // I-360 still REPORTED despite receipt → BLOCK
  const badLedger = buildFactLedger({
    situation: VAWA_PRIMA_FACIE_FIXTURE.situation,
    goal: VAWA_PRIMA_FACIE_FIXTURE.goal,
    documents: [], // no receipt → REPORTED; then we inject receipt doc for the gate check
  });
  const reportedDespite = evaluateApprovalGate({
    brief,
    lock,
    documents: docs,
    factLedger: {
      ...badLedger,
      facts: badLedger.facts.map((f) =>
        f.fact_id === "FORM_I360_FILED" ? { ...f, status: "REPORTED" as const } : f,
      ),
    },
    customerText: text,
    legalInterpretation: FIXTURE_PRIMA_FACIE_LEGAL_INTERPRETATION,
  });
  assert.ok(reportedDespite.rule_ids.includes("BLOCK-FACT-I360-REPORTED-DESPITE-RECEIPT"));

  // I-589 / country-conditions under VAWA → BLOCK
  const i589 = evaluateApprovalGate({
    brief,
    lock,
    documents: docs,
    customerText: "Please file Form I-589 and gather country-conditions material.",
    legalInterpretation: FIXTURE_PRIMA_FACIE_LEGAL_INTERPRETATION,
  });
  assert.ok(i589.rule_ids.includes("BLOCK-LOCK-I589-IN-VAWA"));

  // I-130 recommended under VAWA → BLOCK
  const i130 = evaluateApprovalGate({
    brief,
    lock,
    documents: docs,
    customerPresentation: {
      ...view,
      whatToDoNext: [
        {
          what: "Review Form I-130 as the first family petition step",
          why: "When nothing is filed yet, matching official material starts with I-130.",
          now: "Can be done now",
          whatChanges: "I-485 stays later.",
        },
      ],
    },
    customerText: "The usual first USCIS form is Form I-130",
    legalInterpretation: FIXTURE_PRIMA_FACIE_LEGAL_INTERPRETATION,
  });
  assert.ok(i130.rule_ids.includes("BLOCK-LOCK-I130-RECOMMENDED-IN-VAWA"));

  // Duplicate customer-facing rows → BLOCK
  const dedup = evaluateApprovalGate({
    brief,
    lock,
    documents: docs,
    customerFacingDocuments: [
      { fileName: "a.pdf", documentType: "uscis_vawa_prima_facie_notice", contentHash: "same" },
      { fileName: "b.pdf", documentType: "uscis_vawa_prima_facie_notice", contentHash: "same" },
    ],
    customerText: text,
    legalInterpretation: FIXTURE_PRIMA_FACIE_LEGAL_INTERPRETATION,
  });
  assert.ok(dedup.rule_ids.includes("BLOCK-DEDUP-DUPLICATE-EVIDENCE-ROW"));

  // Plan honesty → BLOCK
  const plan = buildAnalysisPlan({
    situation: "marriage green card options",
    goal: "green card",
    documents: [],
    documentCount: 0,
    evidenceFactKeys: [],
    unknowns: [],
    issues: [],
    inquiryMode: "open_options",
  });
  // Force bad skip reason while docs exist
  plan.tasks_skipped = [
    {
      task: "PROCESS_DOCUMENTS",
      reason: "Document processing is not needed for this options review.",
    },
  ];
  const planBlock = evaluateApprovalGate({
    brief,
    lock,
    documents: docs,
    analysisPlan: plan,
    customerText: text,
    legalInterpretation: FIXTURE_PRIMA_FACIE_LEGAL_INTERPRETATION,
  });
  assert.ok(planBlock.rule_ids.includes("BLOCK-PLAN-DOCS-SKIPPED-WHILE-USED"));

  // Stale derived output → BLOCK both stale rules
  const stale = evaluateApprovalGate({
    brief,
    lock,
    documents: docs,
    customerText: text,
    customerOutputStale: true,
    invalidationReason: "DOCUMENT_CLASSIFICATION_CHANGED",
    legalInterpretation: FIXTURE_PRIMA_FACIE_LEGAL_INTERPRETATION,
  });
  assert.ok(stale.rule_ids.includes("BLOCK-STATE-STALE-BRIEF-AFTER-EVIDENCE-CHANGE"));
  assert.ok(stale.rule_ids.includes("BLOCK-STATE-STALE-DERIVED-OUTPUT"));
  assert.equal(approvalGateAllowsCustomerApprove(stale), false);

  // Unsupported legal interpretation → BLOCK
  const noAuth = evaluateApprovalGate({
    brief,
    lock,
    documents: docs,
    customerText: text,
    assertsMaterialLegalMeaning: true,
    legalInterpretation: { interpretation_id: null, authorities: [] },
  });
  assert.ok(noAuth.rule_ids.includes("BLOCK-AUTHORITY-UNSUPPORTED-LEGAL-INTERPRETATION"));

  // Canonical select refuses presentation on BLOCK
  const blockedState = buildCanonicalApprovedState({
    version: 1,
    reason: "analysis",
    pipelineConfigVersion: "test",
    evidenceSnapshotHash: "x",
    status: "gate_blocked",
    readinessScore: 50,
    presentation: { hero: { current_posture: "blocked" } } as never,
    approvalGate: stale,
  });
  assert.equal(selectApprovedPresentation({ canonical: blockedState }), null);

  // Override records previous result (no silent override)
  const overridden = withGateOverride(stale, {
    overrideBy: "admin@example.com",
    overrideReason: "Verified with USCIS account printout",
  });
  assert.equal(overridden.previous_gate_result, "BLOCK");
  assert.ok(overridden.override_by);
  assert.ok(overridden.override_time);
  assert.ok(overridden.override_reason);
  assert.notEqual(overridden.gate_result, "BLOCK");

  for (const id of APPROVAL_GATE_BLOCK_IDS) {
    assert.ok(id.startsWith("BLOCK-"));
  }

  console.log("phase-e-approval-gate-check: ok");
}

main();
