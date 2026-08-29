/**
 * Phase A — classification, customer dedupe, plan honesty.
 * Run: npx tsx scripts/phase-a-classification-check.ts
 */
import assert from "node:assert/strict";
import {
  classifyUploadedDocument,
  immigrationDocumentTypeLabel,
  resolveImmigrationDocumentType,
} from "../src/domain/documents";
import { processDocumentsSkipReason } from "../src/lib/case-analysis-plan";
import {
  assembleV5CustomerPresentation,
  dedupeDocumentsForCustomerPresentation,
} from "../src/lib/v5-customer-presentation";
import { VAWA_PRIMA_FACIE_FIXTURE } from "../src/lib/situation-brief";
import { buildSituationBrief } from "../src/lib/situation-brief";

function main() {
  // Empty OCR + identity upload kind + meaningful filename must not become Identity & Entry.
  const receipt = classifyUploadedDocument({
    fileName: "I-360-receipt.pdf",
    text: "",
    docKind: "identity",
    declaredType: "identity_document",
  });
  assert.equal(receipt.documentType, "uscis_i360_receipt_notice");
  assert.notEqual(immigrationDocumentTypeLabel(receipt.documentType), "Identity & Entry Document");

  const declaration = classifyUploadedDocument({
    fileName: "personal-declaration.pdf",
    text: "",
    docKind: "identity",
  });
  assert.equal(declaration.documentType, "personal_declaration");
  assert.match(immigrationDocumentTypeLabel(declaration.documentType), /Declaration/i);

  const genericIdentityUpload = resolveImmigrationDocumentType({
    fileName: "scan-001.pdf",
    text: "",
    docKind: "identity",
  });
  assert.equal(genericIdentityUpload, "other");

  const passport = classifyUploadedDocument({
    fileName: "passport.pdf",
    text: "U.S. Passport. Biographic page.",
    docKind: "identity",
  });
  assert.equal(passport.documentType, "identity_document");

  // Customer presentation: bare docKind identity must not render Identity & Entry for I-360 receipt.
  const view = assembleV5CustomerPresentation({
    brief: buildSituationBrief(VAWA_PRIMA_FACIE_FIXTURE),
    documents: [
      { fileName: "I-360-receipt.pdf", documentType: "", docKind: "identity" },
      { fileName: "personal-declaration.pdf", documentType: "", docKind: "identity" },
      {
        id: "a",
        fileName: "prima-facie-determination.pdf",
        documentType: "uscis_vawa_prima_facie_notice",
        contentHash: "sha256:same",
      },
      {
        id: "b",
        fileName: "prima-facie-determination (1).pdf",
        documentType: "uscis_vawa_prima_facie_notice",
        contentHash: "sha256:same",
      },
      {
        id: "c",
        fileName: "copy.pdf",
        documentType: "uscis_vawa_prima_facie_notice",
        duplicateOfId: "a",
      },
    ],
  });
  const labels = view.documentsTellUs.map((d) => d.label).join(" | ");
  assert(!/Identity & Entry/i.test(labels), `must not show Identity & Entry, got: ${labels}`);
  assert(/I-360.*Receipt|Receipt.*I-360/i.test(labels), `must include I-360 receipt label, got: ${labels}`);
  assert(/Declaration/i.test(labels), `must include declaration label, got: ${labels}`);
  const primaRows = view.documentsTellUs.filter((d) => /prima facie/i.test(d.label) || /prima_facie/i.test(d.documentType));
  assert.equal(primaRows.length, 1, `prima facie must appear once, got ${primaRows.length}`);

  const deduped = dedupeDocumentsForCustomerPresentation([
    { fileName: "a.pdf", contentHash: "h1", documentType: "uscis_vawa_prima_facie_notice" },
    { fileName: "b.pdf", contentHash: "h1", documentType: "uscis_vawa_prima_facie_notice" },
    { fileName: "c.pdf", duplicateOfId: "x", documentType: "uscis_vawa_prima_facie_notice" },
  ]);
  assert.equal(deduped.length, 1);

  // Plan honesty
  assert.match(
    processDocumentsSkipReason({ openOptions: true, documentCount: 0 }),
    /options review/i,
  );
  assert.equal(
    processDocumentsSkipReason({ openOptions: true, documentCount: 3 }),
    "Documents already processed and current",
  );
  assert(!/options review/i.test(processDocumentsSkipReason({ openOptions: true, documentCount: 1 })));

  console.log("phase-a-classification-check: OK");
}

main();
