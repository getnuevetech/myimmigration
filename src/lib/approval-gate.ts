/**
 * Phase E — approval gate (V5.1 Correction Spec §10).
 * Fail-closed BLOCKs refuse customer-facing approve; WARNINGs are operable
 * and staff-visible. Every evaluate call returns a full audit payload.
 */

import { immigrationDocumentTypeLabel, resolveImmigrationDocumentType } from "@/domain/documents";
import type { AnalysisPlan } from "@/lib/case-analysis-plan";
import {
  caseTypeLockFromBrief,
  isVawaI360Lock,
  passesRecommendationLock,
  type CaseTypeLock,
} from "@/lib/case-type-lock";
import type { FactLedger } from "@/lib/evidence/fact-ledger";
import { ledgerFact } from "@/lib/evidence/fact-ledger";
import type { SituationBrief } from "@/lib/situation-brief";
import {
  dedupeDocumentsForCustomerPresentation,
  type V5CustomerPresentation,
} from "@/lib/v5-customer-presentation";

export type ApprovalGateSeverity = "BLOCK" | "WARNING";

export type ApprovalGateResultKind = "PASS" | "BLOCK" | "WARN";

export type ApprovalGateFinding = {
  rule_id: string;
  severity: ApprovalGateSeverity;
  reason: string;
};

export type LegalInterpretationForGate = {
  interpretation_id?: string | null;
  statement?: string | null;
  authorities?: Array<{
    authority_id?: string;
    issuer?: string;
    source_type?: string;
    supports?: string[];
  }> | null;
};

export type ApprovalGateDocument = {
  id?: string | null;
  fileName: string;
  documentType?: string | null;
  docKind?: string | null;
  contentHash?: string | null;
  duplicateOfId?: string | null;
};

export type ApprovalGateInput = {
  brief?: SituationBrief | null;
  lock?: CaseTypeLock | null;
  documents?: ApprovalGateDocument[];
  /** Raw documents before customer dedupe (for BLOCK-DEDUP). */
  customerFacingDocuments?: ApprovalGateDocument[];
  factLedger?: FactLedger | null;
  analysisPlan?: AnalysisPlan | null;
  customerText?: string;
  customerPresentation?: V5CustomerPresentation | null;
  customerOutputStale?: boolean;
  invalidationPendingAt?: Date | string | null;
  invalidationReason?: string | null;
  legalInterpretation?: LegalInterpretationForGate | null;
  /** When true, customer text asserts material legal meaning that requires authority. */
  assertsMaterialLegalMeaning?: boolean;
  logicalAnalysisId?: string | null;
  caseVersionId?: string | null;
  caseId?: string | null;
};

export type ApprovalGateAudit = {
  gate_result: ApprovalGateResultKind;
  rule_ids: string[];
  blocks: ApprovalGateFinding[];
  warnings: ApprovalGateFinding[];
  reasons: string[];
  logical_analysis_id: string | null;
  case_version_id: string | null;
  case_id: string | null;
  evaluated_at: string;
  override_by: string | null;
  override_time: string | null;
  override_reason: string | null;
  previous_gate_result: ApprovalGateResultKind | null;
};

export const APPROVAL_GATE_BLOCK_IDS = [
  "BLOCK-DOC-MISCLASS-I360-RECEIPT-AS-IDENTITY",
  "BLOCK-DOC-MISCLASS-DECLARATION-AS-IDENTITY",
  "BLOCK-FACT-I360-REPORTED-DESPITE-RECEIPT",
  "BLOCK-LOCK-I589-IN-VAWA",
  "BLOCK-LOCK-I130-RECOMMENDED-IN-VAWA",
  "BLOCK-DEDUP-DUPLICATE-EVIDENCE-ROW",
  "BLOCK-PLAN-DOCS-SKIPPED-WHILE-USED",
  "BLOCK-STATE-STALE-BRIEF-AFTER-EVIDENCE-CHANGE",
  "BLOCK-STATE-STALE-DERIVED-OUTPUT",
  "BLOCK-AUTHORITY-UNSUPPORTED-LEGAL-INTERPRETATION",
] as const;

export const APPROVAL_GATE_WARN_IDS = [
  "WARN-UNKNOWN-I485-RECEIPT",
  "WARN-UNKNOWN-WAIVER-TYPE",
  "WARN-UNKNOWN-MEDICAL",
  "WARN-INCOMPLETE-TIMELINE",
  "WARN-EVIDENCE-GAP-NOT-CONFLICT",
  "WARN-UNVERIFIED-CLAIM-NOT-CONFLICT",
] as const;

const ALLOWED_LEGAL_ISSUERS = new Set(["USCIS", "DOJ", "DOS", "EOIR"]);

function resolveDocType(doc: ApprovalGateDocument): string {
  return resolveImmigrationDocumentType({
    fileName: doc.fileName,
    text: "",
    declaredType: doc.documentType,
    docKind: doc.docKind,
  });
}

function storedAsIdentity(doc: ApprovalGateDocument): boolean {
  const type = String(doc.documentType ?? "").toLowerCase();
  const kind = String(doc.docKind ?? "").toLowerCase();
  return type === "identity_document" || type === "identity" || kind === "identity";
}

function looksLikeI360ReceiptFilename(doc: ApprovalGateDocument): boolean {
  return /i-?360/i.test(doc.fileName) && /receipt/i.test(doc.fileName);
}

function looksLikeDeclarationFilename(doc: ApprovalGateDocument): boolean {
  return /declaration|personal.?statement/i.test(doc.fileName);
}

function looksLikeI360Receipt(doc: ApprovalGateDocument, resolved: string): boolean {
  if (/i360|i-360/i.test(resolved) && /receipt/i.test(resolved)) return true;
  return looksLikeI360ReceiptFilename(doc);
}

function looksLikeDeclaration(doc: ApprovalGateDocument, resolved: string): boolean {
  if (/personal_declaration|declaration/i.test(resolved) && !/identity/i.test(resolved)) return true;
  return looksLikeDeclarationFilename(doc);
}

function isIdentityLabel(resolved: string): boolean {
  const label = immigrationDocumentTypeLabel(resolved);
  return /Identity & Entry/i.test(label) || resolved === "identity_document";
}

function customerBlob(input: ApprovalGateInput): string {
  if (input.customerText) return input.customerText;
  const view = input.customerPresentation;
  if (!view) return "";
  return [
    view.caseType,
    ...view.keyPoint.body,
    ...view.whatToDoNext.flatMap((a) => [a.what, a.why, a.whatChanges]),
    ...view.stillNeedToConfirm.flatMap((i) => [i.text, i.why]),
    ...view.documentsTellUs.flatMap((d) => [d.label, d.confirms, d.whyItMatters]),
  ].join("\n");
}

function planSkipReasons(plan: AnalysisPlan | null | undefined): string[] {
  if (!plan) return [];
  return (plan.tasks_skipped ?? []).map((t) => String(t.reason ?? "")).filter(Boolean);
}

function hasMaterialLegalMeaning(text: string, input: ApprovalGateInput): boolean {
  if (input.assertsMaterialLegalMeaning) return true;
  if (input.legalInterpretation?.statement) return true;
  return (
    /\bprima facie\b/i.test(text) &&
    (/preliminary/i.test(text) || /not (?:a )?final/i.test(text) || /not a green card/i.test(text))
  );
}

function legalInterpretationSupported(interp: LegalInterpretationForGate | null | undefined): boolean {
  if (!interp?.interpretation_id) return false;
  const authorities = interp.authorities ?? [];
  if (!authorities.length) return false;
  return authorities.some((a) => ALLOWED_LEGAL_ISSUERS.has(String(a.issuer ?? "").toUpperCase()));
}

/**
 * Evaluate approval gate. Pure — no DB. Caller persists the audit trail.
 */
export function evaluateApprovalGate(input: ApprovalGateInput): ApprovalGateAudit {
  const blocks: ApprovalGateFinding[] = [];
  const warnings: ApprovalGateFinding[] = [];
  const lock = input.lock ?? caseTypeLockFromBrief(input.brief);
  const docs = input.documents ?? [];
  const text = customerBlob(input);
  const ledger = input.factLedger ?? null;

  // --- BLOCKs ---
  for (const doc of docs) {
    const resolved = resolveDocType(doc);
    // Catch stored misclass even when the resolver would now fix the type.
    if (looksLikeI360ReceiptFilename(doc) && storedAsIdentity(doc)) {
      blocks.push({
        rule_id: "BLOCK-DOC-MISCLASS-I360-RECEIPT-AS-IDENTITY",
        severity: "BLOCK",
        reason: `${doc.fileName} is stored as identity while the filename indicates an I-360 receipt.`,
      });
    } else if (looksLikeI360Receipt(doc, resolved) && isIdentityLabel(resolved)) {
      blocks.push({
        rule_id: "BLOCK-DOC-MISCLASS-I360-RECEIPT-AS-IDENTITY",
        severity: "BLOCK",
        reason: `${doc.fileName} resolves as Identity & Entry instead of an I-360 receipt.`,
      });
    }
    if (looksLikeDeclarationFilename(doc) && storedAsIdentity(doc)) {
      blocks.push({
        rule_id: "BLOCK-DOC-MISCLASS-DECLARATION-AS-IDENTITY",
        severity: "BLOCK",
        reason: `${doc.fileName} is stored as identity while the filename indicates a personal declaration.`,
      });
    } else if (looksLikeDeclaration(doc, resolved) && isIdentityLabel(resolved)) {
      blocks.push({
        rule_id: "BLOCK-DOC-MISCLASS-DECLARATION-AS-IDENTITY",
        severity: "BLOCK",
        reason: `${doc.fileName} resolves as Identity & Entry instead of a personal declaration.`,
      });
    }
  }

  const hasI360Receipt = docs.some((doc) => {
    const resolved = resolveDocType(doc);
    return looksLikeI360Receipt(doc, resolved) || /uscis_i360_receipt/i.test(resolved);
  });
  const filed = ledger ? ledgerFact(ledger, "FORM_I360_FILED") : null;
  if (hasI360Receipt && filed && filed.status === "REPORTED") {
    blocks.push({
      rule_id: "BLOCK-FACT-I360-REPORTED-DESPITE-RECEIPT",
      severity: "BLOCK",
      reason: "FORM_I360_FILED remains REPORTED despite an I-360 receipt on file.",
    });
  }

  if (isVawaI360Lock(lock)) {
    if (
      /\bi-?589\b/i.test(text) &&
      !/do not|instead|not (?:required|needed|recommended)/i.test(text)
    ) {
      blocks.push({
        rule_id: "BLOCK-LOCK-I589-IN-VAWA",
        severity: "BLOCK",
        reason: "Customer output mentions I-589 under a VAWA I-360 lock.",
      });
    }
    if (/country.?conditions/i.test(text) && !/do not|not required|not needed/i.test(text)) {
      blocks.push({
        rule_id: "BLOCK-LOCK-I589-IN-VAWA",
        severity: "BLOCK",
        reason: "Customer output requires country-conditions under a VAWA I-360 lock.",
      });
    }
    // New I-130 recommendation (anti-recommendation allowed).
    const actions = input.customerPresentation?.whatToDoNext ?? [];
    for (const action of actions) {
      const blob = `${action.what}\n${action.why}\n${action.whatChanges}`;
      if (!passesRecommendationLock(blob, lock) || /review form i-?130|file (?:a |an |form )?i-?130|start (?:a |an )?i-?130|file form i-130 first/i.test(blob)) {
        if (/i-?130/i.test(blob) && !/do not|instead of/i.test(blob)) {
          blocks.push({
            rule_id: "BLOCK-LOCK-I130-RECOMMENDED-IN-VAWA",
            severity: "BLOCK",
            reason: `Recommended I-130 under VAWA lock: ${action.what}`,
          });
        }
      }
    }
    if (/file Form I-130 first|usual first USCIS form is Form I-130/i.test(text)) {
      blocks.push({
        rule_id: "BLOCK-LOCK-I130-RECOMMENDED-IN-VAWA",
        severity: "BLOCK",
        reason: "Customer copy recommends Form I-130 as the pathway under VAWA lock.",
      });
    }
  }

  // BLOCK-DEDUP: customer-facing list (or raw docs flagged as customer-facing) still has duplicates.
  const customerFacing = input.customerFacingDocuments;
  if (customerFacing && customerFacing.length) {
    const withoutDupFlag = customerFacing.filter((d) => !d.duplicateOfId);
    const deduped = dedupeDocumentsForCustomerPresentation(withoutDupFlag);
    if (deduped.length < withoutDupFlag.length) {
      blocks.push({
        rule_id: "BLOCK-DEDUP-DUPLICATE-EVIDENCE-ROW",
        severity: "BLOCK",
        reason: "Customer evidence list still shows duplicate document identity rows.",
      });
    }
  } else if (input.customerPresentation?.documentsTellUs) {
    const labels = input.customerPresentation.documentsTellUs.map((d) => `${d.fileName}|${d.documentType}`);
    const unique = new Set(labels);
    if (unique.size < labels.length) {
      blocks.push({
        rule_id: "BLOCK-DEDUP-DUPLICATE-EVIDENCE-ROW",
        severity: "BLOCK",
        reason: "Customer evidence list still shows duplicate document identity rows.",
      });
    }
  }

  const skipReasons = planSkipReasons(input.analysisPlan);
  const optionsSkip = skipReasons.some((r) =>
    /Document processing is not needed for this options review/i.test(r),
  );
  if (optionsSkip && docs.length > 0) {
    blocks.push({
      rule_id: "BLOCK-PLAN-DOCS-SKIPPED-WHILE-USED",
      severity: "BLOCK",
      reason: "Analysis plan claims document processing is not needed while documents drive conclusions.",
    });
  }

  const stale = Boolean(input.customerOutputStale);
  const pendingInvalidation = Boolean(input.invalidationPendingAt);
  if (stale || pendingInvalidation) {
    blocks.push({
      rule_id: "BLOCK-STATE-STALE-BRIEF-AFTER-EVIDENCE-CHANGE",
      severity: "BLOCK",
      reason: input.invalidationReason
        ? `Brief/output stale after evidence change (${input.invalidationReason}).`
        : "Brief/output is marked stale after an evidence classification change.",
    });
    blocks.push({
      rule_id: "BLOCK-STATE-STALE-DERIVED-OUTPUT",
      severity: "BLOCK",
      reason: "Cannot approve customer-facing derived output while stale_customer_output_allowed is false.",
    });
  }

  if (hasMaterialLegalMeaning(text, input) && !legalInterpretationSupported(input.legalInterpretation)) {
    blocks.push({
      rule_id: "BLOCK-AUTHORITY-UNSUPPORTED-LEGAL-INTERPRETATION",
      severity: "BLOCK",
      reason:
        "Material legal interpretation is shown without interpretation_id + qualifying USCIS/DOJ/DOS/EOIR authorities.",
    });
  }

  // --- WARNINGs (operable) ---
  if (ledger) {
    const gaps = ledger.evidence_gaps ?? [];
    const unverified = ledger.unverified_claims ?? [];
    if (gaps.some((g) => String((g as { subject?: string }).subject ?? "") === "I485_RECEIPT")) {
      warnings.push({
        rule_id: "WARN-UNKNOWN-I485-RECEIPT",
        severity: "WARNING",
        reason: "I-485 receipt remains an evidence gap.",
      });
    }
    if (
      gaps.some((g) => /waiver/i.test(String((g as { subject?: string }).subject ?? ""))) ||
      unverified.some((u) => /waiver/i.test(String((u as { subject?: string }).subject ?? "")))
    ) {
      warnings.push({
        rule_id: "WARN-UNKNOWN-WAIVER-TYPE",
        severity: "WARNING",
        reason: "Waiver type is still unresolved.",
      });
    }
    if (
      gaps.some((g) => /medical/i.test(String((g as { subject?: string }).subject ?? ""))) ||
      /medical/i.test(text)
    ) {
      const medicalUnknown = (input.brief?.unknownFacts ?? []).some((f) => /medical/i.test(f.text));
      if (medicalUnknown || gaps.some((g) => /medical/i.test(String((g as { subject?: string }).subject ?? "")))) {
        warnings.push({
          rule_id: "WARN-UNKNOWN-MEDICAL",
          severity: "WARNING",
          reason: "Immigration medical exam status is still unknown.",
        });
      }
    }
    if ((ledger.event_timeline?.length ?? 0) < 2 && isVawaI360Lock(lock)) {
      warnings.push({
        rule_id: "WARN-INCOMPLETE-TIMELINE",
        severity: "WARNING",
        reason: "Event timeline has fewer than two events for this filed matter.",
      });
    }
    if (gaps.length > 0) {
      warnings.push({
        rule_id: "WARN-EVIDENCE-GAP-NOT-CONFLICT",
        severity: "WARNING",
        reason: `${gaps.length} evidence gap(s) present — not treated as conflicts.`,
      });
    }
    if (unverified.length > 0) {
      warnings.push({
        rule_id: "WARN-UNVERIFIED-CLAIM-NOT-CONFLICT",
        severity: "WARNING",
        reason: `${unverified.length} unverified claim(s) present — not treated as conflicts.`,
      });
    }
  }

  // Dedupe findings by rule_id (keep first reason).
  const uniq = (items: ApprovalGateFinding[]) => {
    const seen = new Set<string>();
    const out: ApprovalGateFinding[] = [];
    for (const item of items) {
      if (seen.has(item.rule_id)) continue;
      seen.add(item.rule_id);
      out.push(item);
    }
    return out;
  };
  const blockList = uniq(blocks);
  const warnList = uniq(warnings);
  const gate_result: ApprovalGateResultKind = blockList.length ? "BLOCK" : warnList.length ? "WARN" : "PASS";

  return {
    gate_result,
    rule_ids: [...blockList, ...warnList].map((f) => f.rule_id),
    blocks: blockList,
    warnings: warnList,
    reasons: [...blockList, ...warnList].map((f) => f.reason),
    logical_analysis_id: input.logicalAnalysisId ?? null,
    case_version_id: input.caseVersionId ?? null,
    case_id: input.caseId ?? null,
    evaluated_at: new Date().toISOString(),
    override_by: null,
    override_time: null,
    override_reason: null,
    previous_gate_result: null,
  };
}

export function approvalGateAllowsCustomerApprove(audit: ApprovalGateAudit): boolean {
  return audit.gate_result !== "BLOCK";
}

export function withGateOverride(
  audit: ApprovalGateAudit,
  input: { overrideBy: string; overrideReason: string },
): ApprovalGateAudit {
  return {
    ...audit,
    previous_gate_result: audit.gate_result,
    override_by: input.overrideBy,
    override_time: new Date().toISOString(),
    override_reason: input.overrideReason.slice(0, 1000),
    // Override clears BLOCK for staff-approved publish; still records previous result.
    gate_result: audit.gate_result === "BLOCK" ? "WARN" : audit.gate_result,
    reasons: [
      ...audit.reasons,
      `Staff override by ${input.overrideBy}: ${input.overrideReason.slice(0, 200)}`,
    ],
  };
}

/** Canonical fixture legal interpretation that satisfies INV-AUTH-02. */
export const FIXTURE_PRIMA_FACIE_LEGAL_INTERPRETATION: LegalInterpretationForGate = {
  interpretation_id: "INT_PRIMA_FACIE_MEANING",
  statement:
    "Prima facie is a preliminary positive determination on the I-360; it is not final I-360 approval and not a green card.",
  authorities: [
    {
      authority_id: "auth_fixture_uscis_prima_facie_guidance",
      issuer: "USCIS",
      source_type: "POLICY_OR_OFFICIAL_GUIDANCE",
      supports: ["PRIMA_FACIE_IS_PRELIMINARY", "NOT_FINAL_I360_APPROVAL", "NOT_A_GREEN_CARD"],
    },
  ],
};
