import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_PROMPTS, PROMPT_SUPERSEDES, PROMPT_VERSION } from "../src/lib/ai/prompts";
import {
  buildPresentationBrief,
  presentationGroundingBlock,
  presentationNoticeStepDescription,
  withPresentationNoticeSteps,
} from "../src/lib/case-presentation-brief";
import {
  assemblePresentationContract,
  approvedPresentationHeading,
  approvedPresentationPhrase,
  evidenceStrengthFromScores,
  FILED_ORGANIZING_SUMMARY,
  letterComposerGroundingCopy,
  letterReviewGroundingCopy,
  OPTIONS_ORGANIZING_SUMMARY,
  parsePresentationRecord,
  presentationOrganizingSummary,
  presentationWhatThisMeansSummary,
  qaGroundedConversationCopy,
  withPresentationSurfaceCopy,
} from "../src/lib/case-presentation-contract";
import { caseListActionLine, caseListEvidenceLine, caseListSummary, caseListSummaryFromView, caseListVersionLine } from "../src/lib/case-presentation-list";
import { presentationReportSections } from "../src/lib/case-report-presentation";
import { presentationActionStatus, presentationEvidenceGateLabel, presentationStepCta } from "../src/lib/case-presentation-ui";
import {
  ANALYSIS_TASKS,
  analysisPlanSummary,
  analysisRunDecisions,
  buildAnalysisPlan,
  buildPlanExecution,
  issuesNeedIndependentReview,
  runtimeQuestionAddition,
  runtimeReviewAddition,
} from "../src/lib/case-analysis-plan";
import {
  buildCanonicalApprovedState,
  buildApprovedCaseView,
  canonicalStateSummary,
  parseCanonicalApprovedState,
  selectApprovedPresentation,
  versionReasonLabel,
} from "../src/lib/canonical-case-state";
import {
  classifyUploadedDocument,
  immigrationDocumentTypeLabel,
  resolveImmigrationDocumentType,
} from "../src/domain/documents";
import {
  buildSituationBrief,
  FAMILY_OPEN_OPTIONS_FIXTURE,
  reportedFactsFromAnswer,
  RFE_I485_FIXTURE,
  stripClarifiedNarrative,
  VAWA_PRIMA_FACIE_FIXTURE,
} from "../src/lib/situation-brief";
import { buildEvidenceGateBriefFromReconciled, compileImmigrationEvidence, computeEvidenceReadinessSplit, evaluateEvidenceAction, extractUniversalDocumentIntelligence, guardLetterDraftWithEvidence, reconcileEvidenceStates } from "../src/lib/evidence";
import {
  applyInquiryToEvidenceState,
  buildOpenOptionsAnalysis,
  buildQaFallbackAnswer,
  classifyImmigrationInquiry,
  INQUIRY_MODES,
  OPEN_OPTIONS_POSTURE,
  evaluateConsultantReferral,
} from "../src/lib/immigration-inquiry";
import { rankKnowledgeSources, type KnowledgeRecord } from "../src/lib/knowledge-retrieval";
import {
  authorityQueryKeys,
  findAuthorityForKnowledge,
  historicalMatchBoost,
  matchBoostsFromStats,
  knowledgeFromSnapshot,
  overlappingOfficialUpdate,
} from "../src/lib/authority-match";
import {
  applyQaEntitlementToAnswer,
  consultantSpecialtiesForThemes,
  qaUsageFromCount,
  resolveQaEntitlement,
} from "../src/lib/qa-access";
import {
  assignmentPayloadFromCustomerRequest,
  canRequestConsultantMatch,
  consultantSeesCaseDetails,
  customerMatchSharesFiles,
  matchRequestBlockReason,
  openMatchBlocksNewRequest,
  resolveMatchRequestEntitlement,
} from "../src/lib/consultant-match";
import {
  limitSuggestionItems,
  resolveSuggestionEntitlement,
  suggestionConsultantCopy,
  suggestionUsageFromCount,
} from "../src/lib/suggestion-access";
import {
  formActionKey,
  formNumberForStep,
  matchingFormNumber,
  rankFormCatalog,
  rankMatchingForms,
  resolveFormCatalogEntitlement,
} from "../src/lib/goal-forms";
import {
  compareCustomerSnapshots,
  reanalysisVisibleTo,
} from "../src/lib/admin-reanalysis-compare";
import type { CustomerFacingSnapshot } from "../src/lib/admin-reanalysis-types";
import { parseWizardSteps } from "../src/lib/form-wizard-steps";
import { LEGAL_CONTENT_PAGES, LEGAL_DRAFT_MARKERS } from "../src/lib/legal/documents";
import {
  parseOauthConsentsCookie,
  parseRegistrationConsents,
  REGISTRATION_CONSENTS,
  REQUIRED_REGISTRATION_CONSENT_KEYS,
} from "../src/lib/legal/consents";
import {
  fallbackLetterDraft,
  letterComposerHref,
  letterGenerationAllowed,
  letterKindForStep,
  letterStartLabel,
  matchingLetterKind,
  rankLetterCatalog,
  rankMatchingLetters,
  resolveLetterCatalogEntitlement,
  letterKindHint,
  letterGroundSelectLabel,
} from "../src/lib/goal-letters";
import {
  documentKindFromEvidenceItem,
  documentUploadAllowed,
  matchingDocumentKind,
  neededDocumentsFromRanked,
  rankDocumentCatalog,
  rankMatchingDocuments,
  resolveDocumentCatalogEntitlement,
  documentCatalogForSurface,
} from "../src/lib/goal-documents";
import {
  isFiledCaseSurface,
  noticeUploadAllowed,
  resolveDashboardFiledCopy,
  resolveDeadlinesPageCopy,
  resolveNoticeEntitlement,
  resolveNoticePageCopy,
  resolveUscisAccountCopy,
  shouldExpectAutomaticDeadlines,
  shouldShowUscisAccountGuide,
  surfaceNoun,
  thisSurfacePhrase,
} from "../src/lib/goal-notices";
import {
  PUBLIC_BILLING_SUBTITLE,
  PUBLIC_CLOSING,
  PUBLIC_FAQ_BODY,
  PUBLIC_FEATURE_SORT_ORDER,
  PUBLIC_HERO,
  PUBLIC_HERO_CAROUSEL,
  PUBLIC_HOME_FEATURES,
  PUBLIC_HOW_IT_WORKS_PAGE,
  PUBLIC_PLAN_DESCRIPTIONS,
  PUBLIC_PRICING_INTRO,
  STALE_PUBLIC_HERO_SUBTITLES,
  featuresRankedBeforeNotices,
  parsePublicStartIntent,
  publicCopyLeadsWithOptions,
  resolvePublicHero,
  resolvePublicStartCopy,
} from "../src/lib/goal-public";
import {
  resolveReadinessCopy,
  resolveReadinessPolicy,
} from "../src/lib/goal-readiness";
import {
  formatGuideSnapshot,
  guideAccountEmptyLine,
  guideAccountItemLine,
  guideDefaultActionKey,
  guideFallbackCopy,
  guideOpeningCloser,
  guideOpeningSnapshotBody,
  guidePrimaryAction,
  guideStatusHint,
  guideTipForStep,
  guideUpgradeCopy,
  guideWidgetChrome,
  shouldChaseNoticeInGuide,
  GUIDE_PROMPT_RULES,
} from "../src/lib/goal-guide";
import {
  BILLING_REPORT_OVERAGE,
  CASE_REPORT_FEATURE_NAME,
  CONSULTANT_EMPTY_BODY,
  billingReportReturn,
  consultantRecordLabel,
  formPrefillRecordHint,
  knownFactsSourceHint,
  knownFactsVerifyHint,
  navHrefsBefore,
  recordRefLabel,
  reportFileName,
  resolveAccountNav,
  resolveCaseChrome,
  resolveCasesListCopy,
  resolveConsultantWorkspaceCopy,
  resolveReportChrome,
  SUPPORT_PLAYBOOK_MATCHING,
  UPDATES_CHROME,
  updatesImpactReason,
} from "../src/lib/goal-chrome";
import {
  ACCOUNT_CREATED_EMAIL,
  CLOSING_PROMPT_RULES,
  STALE_ACCOUNT_CREATED_BODIES,
  commentNotificationTitle,
  consultantMatchNotificationTitle,
  fallbackEvidenceLine,
  qaGroundSelectLabel,
  resolveClosingCopy,
  resolveDiscussionChrome,
  resolveFallbackPathSteps,
} from "../src/lib/goal-conversation";
import {
  analysisDocumentWalkthrough,
  analysisTaskLabel,
  matchingProgressKinds,
  resolveVersionChrome,
  usesMatchingEvidenceProgress,
  verifiableActionCopy,
} from "../src/lib/goal-versions";
import { resolveClarifyChrome, resolveIntakeChrome } from "../src/lib/goal-intake";
import {
  consultantFromOfficialSources,
  askedFollowUpFromAssistant,
  conversationNarrative,
  historicalSuggestionBoost,
  officialSuggestionCandidates,
  qaConversationCanSaveAsOptionsCase,
  QA_FOLLOW_UP_PREFIX,
  rankFollowUpQuestions,
  rankGoalSuggestions,
  refineInquiryThemes,
  selectNextClarifyQuestion,
  suggestionBoostsFromStats,
  suggestionQuestionKey,
} from "../src/lib/goal-suggestions";

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
const noid = compileImmigrationEvidence({
  id: "fixture-noid",
  fileName: "noid-notice.txt",
  text: fixture("noid-notice.txt"),
});
const biometrics = compileImmigrationEvidence({
  id: "fixture-biometrics",
  fileName: "biometrics-notice.txt",
  text: fixture("biometrics-notice.txt"),
});
const approval = compileImmigrationEvidence({
  id: "fixture-approval",
  fileName: "approval-notice.txt",
  text: fixture("approval-notice.txt"),
});
const universalRfe = extractUniversalDocumentIntelligence({
  fileName: "rfe-notice.txt",
  documentType: "rfe",
  text: fixture("rfe-notice.txt"),
});

const receiptFacts = receipt.facts.map((fact) => `${fact.key}:${fact.value}`);
const rfeFacts = rfe.facts.map((fact) => `${fact.key}:${fact.value}`);

assert(receipt.documentType === "aos_filing_record", `expected I-485 receipt to classify as an adjustment filing record, got ${receipt.documentType}`);
assert(receiptFacts.includes("receipt_number:MSC2390123456"), "receipt fixture should extract receipt number");
assert(receiptFacts.includes("form_type:I-485"), "receipt fixture should extract I-485 form type");
assert(receipt.suppressedQuestions.some((item) => item.questionKey === "receipt_number"), "receipt number question should be suppressed");
assert(receipt.audit.status === "pass", `receipt audit should pass, got ${receipt.audit.status}`);

assert(rfe.documentType === "rfe", `expected RFE classification, got ${rfe.documentType}`);
assert(rfeFacts.includes("notice_type:RFE"), "RFE fixture should extract notice type");
assert(rfe.facts.some((fact) => fact.key === "response_deadline" && /July 31, 2026/.test(fact.value)), "RFE fixture should extract response deadline");
assert(rfe.facts.some((fact) => fact.key === "requested_evidence"), "RFE fixture should extract requested evidence");
assert(rfe.relationships.some((rel) => rel.relationType === "deadline_for_notice"), "RFE deadline should relate to the notice");
assert(noid.documentType === "noid", `expected NOID classification, got ${noid.documentType}`);
assert(noid.facts.some((fact) => fact.key === "notice_type" && fact.value === "NOID"), "NOID fixture should extract notice type");
assert(noid.facts.some((fact) => fact.key === "response_deadline" && /July 10, 2026/.test(fact.value)), "NOID fixture should extract response deadline");
assert(biometrics.documentType === "biometrics_notice", `expected biometrics classification, got ${biometrics.documentType}`);
assert(biometrics.facts.some((fact) => fact.key === "appointment_date" && /April 21, 2026/.test(fact.value)), "biometrics fixture should extract appointment date");
assert(evaluateEvidenceAction("PREPARE_APPOINTMENT", buildEvidenceGateBriefFromReconciled(reconcileEvidenceStates([biometrics])))?.satisfied === true, "biometrics appointment should satisfy appointment preparation action");
assert(approval.documentType === "approval_notice", `expected approval classification, got ${approval.documentType}`);
assert(approval.facts.some((fact) => fact.key === "notice_type" && fact.value === "APPROVAL"), "approval fixture should extract approval notice type");
assert(universalRfe.pages.length === 1 && universalRfe.pages[0].text.includes("Request for Evidence"), "universal extraction should preserve page text");
assert(universalRfe.facts.some((fact) => fact.original_label === "Receipt Number" && fact.source_anchor.field === "Receipt Number"), "universal extraction should preserve labels and source anchors");
assert(universalRfe.instructions_and_conditions.some((item) => /Submit evidence/i.test(item)), "universal extraction should preserve instructions");
assert(universalRfe.unclassified_content.length > 0, "universal extraction should preserve unclassified content");

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
assert(DEFAULT_PROMPTS.presenter.includes("Presenter lockdown"), "presenter prompt should declare presenter lockdown");
assert((PROMPT_SUPERSEDES.presenter ?? []).includes("1293dbaff7ad239de591aeed73d91dcfd84e3c2c28be89582ecd573c9c029023"), "presenter prompt should supersede the pre-lockdown hash");
assert(DEFAULT_PROMPTS.analyst.includes("primary_reasoner_context"), "analyst prompt should mention primary_reasoner_context");
assert(DEFAULT_PROMPTS.reviewer.includes("primary_reasoner_context"), "reviewer prompt should mention primary_reasoner_context");
assert(DEFAULT_PROMPTS.notice_explainer.includes("COMPILED CASE EVIDENCE BRIEF"), "notice explainer prompt should mention compiled evidence brief");
assert(DEFAULT_PROMPTS.notice_explainer.includes("APPROVED CASE PRESENTATION"), "notice explainer prompt should mention approved case presentation");
assert((PROMPT_SUPERSEDES.notice_explainer ?? []).length > 0, "notice explainer prompt should declare superseded hashes");
assert(DEFAULT_PROMPTS.assistant.includes("APPROVED CASE PRESENTATION"), "assistant prompt should mention approved case presentation");
assert((PROMPT_SUPERSEDES.assistant ?? []).includes("4c37b46dc3cc6fa5a8581634f89b50a279a45427f50e3fd3a2898f90489ef2e1"), "assistant prompt should supersede the C6 goal-driven-qa hash");
assert(DEFAULT_PROMPTS.letter_writer.includes("APPROVED CASE PRESENTATION"), "letter writer prompt should mention approved case presentation");
assert(DEFAULT_PROMPTS.letter_writer.includes("Do not invent a receipt number"), "letter writer prompt should refuse invented receipts on cover letters");
assert((PROMPT_SUPERSEDES.letter_writer ?? []).includes("e2cd0b56b7aad1a0431595e7cb69b3e5e92d832ba76e836a3698242f0596153e"), "letter writer prompt should supersede the C11 response-letter hash");
assert(DEFAULT_PROMPTS.guide.includes("current evidence position"), "guide prompt should mention current evidence position");
assert(DEFAULT_PROMPTS.guide.includes("approved posture"), "guide prompt should mention approved posture");
assert((PROMPT_SUPERSEDES.guide ?? []).length > 0, "guide prompt should declare superseded hashes");
assert(DEFAULT_PROMPTS.closing.includes("evidence_brief"), "closing prompt should mention evidence_brief");
assert(DEFAULT_PROMPTS.closing.includes("approved_presentation"), "closing prompt should mention approved presentation");
assert((PROMPT_SUPERSEDES.closing ?? []).length > 0, "closing prompt should declare superseded hashes");
assert(PROMPT_VERSION.includes("v32"), "prompt version should identify v32 evidence prompts");
assert(DEFAULT_PROMPTS.analyst.includes("retrieved official material"), "analyst prompt should ground options in retrieved official material");
assert(DEFAULT_PROMPTS.assistant.includes("matching official material"), "assistant prompt should answer from matching official material");
assert((PROMPT_SUPERSEDES.analyst ?? []).includes("ed754670a3175d8e9db512d2e839a29391c74448889024c80981c2d0db7ec9e7"), "analyst prompt should supersede the pre-open-options hash");
assert((PROMPT_SUPERSEDES.analyst ?? []).includes("4c79d64b1ef2068dbf9000be50aa51450fee81cb4908ba054ba8b31a1b36b44f"), "analyst prompt should supersede the C1 open-options hash");
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

assert(evidenceStrengthFromScores(100) === "Strong", "high action readiness should map to Strong evidence");
assert(evidenceStrengthFromScores(40) === "Moderate", "mid action readiness should map to Moderate evidence");
assert(evidenceStrengthFromScores(10) === "Limited", "low action readiness should map to Limited evidence");
const presentation = assemblePresentationContract({
  status: "analyzed",
  actionReadinessScore: 100,
  reconstruction: {
    currentPosition: reconciled.reconstruction.currentPosition,
    summary: reconciled.reconstruction.summary,
    timeline: reconciled.reconstruction.timeline,
    pendingActions: reconciled.reconstruction.pendingActions,
  },
  issues: [{
    id: "issue-rfe",
    title: "Respond to the RFE",
    itemKind: "issue",
    state: "action_needed",
    evidenceStatus: "confirmed",
    evidenceStrength: "strong",
    conclusion: "The RFE deadline is on the notice.",
    nextAction: "UPLOAD_NOTICE",
    issueType: "uscis_notice_response",
    altAction: "",
  }, {
    id: "issue-review",
    title: "Licensed professional review",
    itemKind: "risk",
    state: "review",
    evidenceStatus: "possible",
    evidenceStrength: "limited",
    conclusion: "A licensed professional should review the response.",
    nextAction: "REVIEW_ANALYSIS",
    issueType: "professional_review",
    altAction: "",
  }],
  deadlines: [{ id: "dl-rfe", title: "RFE response", dueDate: "2026-07-31T00:00:00.000Z", source: "notice" }],
  actionNodes: [
    { id: "act-blocked", title: "Gather older records", actionKey: "GET_CASE_RECORD", status: "COMPLETED", priority: 1 },
    { id: "act-ready", title: "Respond to the RFE", actionKey: "UPLOAD_NOTICE", status: "READY", priority: 2 },
  ],
  documents: [{ id: "doc-rfe", fileName: "rfe-notice.txt", documentType: "rfe", processingStatus: "extracted" }],
  unknowns: [{ question: "What evidence will be submitted for the RFE?" }],
  evidenceGateStatus: gate.status,
  conflicts: [],
});
assert(presentation.hero.current_posture === "RFE notice needs review", "presentation hero should use reconstructed posture");
assert(presentation.hero.next_best_action?.action_key === "UPLOAD_NOTICE", "presentation hero should pick the ready action");
assert(presentation.hero.nearest_deadline?.title === "RFE response", "presentation hero should include the nearest deadline");
assert(presentation.hero.professional_review_recommended === true, "presentation hero should flag professional review");
assert(presentation.what_this_means.unresolved_count === 2, "presentation should count unresolved findings");
assert(presentation.findings.length === 2, "presentation should include findings");
assert(presentation.actions.some((action) => action.status === "READY"), "presentation should include ready actions");
assert(presentation.evidence[0].document_type === "rfe", "presentation should include extracted evidence");
assert(presentation.professional_review?.issue_id === "issue-review", "presentation should attach the professional review finding");
const parsedPresentation = parsePresentationRecord({
  heroJson: JSON.stringify(presentation.hero),
  whatThisMeansJson: JSON.stringify(presentation.what_this_means),
  timelineJson: JSON.stringify(presentation.timeline),
  findingsJson: JSON.stringify(presentation.findings),
  deadlinesJson: JSON.stringify(presentation.deadlines),
  actionsJson: JSON.stringify(presentation.actions),
  evidenceJson: JSON.stringify(presentation.evidence),
  professionalReviewJson: JSON.stringify(presentation.professional_review),
});
assert(parsedPresentation.hero.next_best_action?.action_key === "UPLOAD_NOTICE", "stored presentation should round-trip the next best action");
assert(parsedPresentation.hero.professional_review_recommended === true, "stored presentation should round-trip professional review");
assert(presentationActionStatus("READY").label === "Ready now", "ready actions should use a customer-facing Ready now label");
assert(presentationActionStatus("COMPLETED").tone === "done", "completed actions should use the done tone");
assert(presentationEvidenceGateLabel("pass") === "Records checked", "pass evidence gate should use a customer-facing records label");
assert(presentationStepCta("UPLOAD_NOTICE", "case-1")?.href === "/app/notices?case=case-1", "notice upload should link to the notices page");
assert(presentationStepCta("DRAFT_LETTER", "case-1")?.href === "/app/letters/new?case=case-1", "letter action should keep the case id");
assert(presentationStepCta("DRAFT_LETTER", "case-1", null, "i130_cover")?.href === "/app/letters/new?case=case-1&kind=i130_cover", "letter CTA should deep-link the matching kind");
assert(presentationStepCta("DRAFT_LETTER", "case-1", null, "i130_cover")?.label === "Draft I-130 cover letter", "letter CTA should name the matching cover letter");

const listFromContract = caseListSummary({
  status: "analyzed",
  reconstructionPosition: "STALE reconstruction posture",
  presentation,
});
assert(listFromContract.posture === "RFE notice needs review", "case list should prefer the approved presentation posture");
assert(listFromContract.nextActionTitle === "Respond to the RFE", "case list should show the approved next action");
assert(listFromContract.deadlineTitle === "RFE response", "case list should show the approved nearest deadline");
assert(listFromContract.evidenceStrength === "Strong", "case list should show presentation evidence strength");
assert(caseListActionLine(listFromContract).includes("Next: Respond to the RFE"), "case list action line should include the next action");
assert(caseListEvidenceLine(listFromContract).includes("Evidence strong"), "case list evidence line should include evidence strength");
const listWithoutContract = caseListSummary({
  status: "draft",
  actionReadinessScore: 10,
  reconstructionPosition: "Waiting for records",
});
assert(listWithoutContract.posture === "Waiting for records", "case list without a contract should fall back to reconstruction");
assert(listWithoutContract.nextActionTitle === null, "case list without a contract should not invent a next action");

const reportHtml = presentationReportSections(presentation);
assert(reportHtml.includes("<h2>Where you stand</h2>"), "case report should include Where you stand");
assert(reportHtml.includes("<h2>What this means</h2>"), "case report should include What this means");
assert(reportHtml.includes("<h2>Timeline</h2>"), "case report should include Timeline");
assert(reportHtml.includes("<h2>Findings (2)</h2>"), "case report should include Findings");
assert(reportHtml.includes("<h2>Your next steps</h2>"), "case report should include Your next steps");
assert(reportHtml.includes("RFE notice needs review"), "case report should use the approved posture");
assert(reportHtml.includes("Respond to the RFE"), "case report should use the approved next action");
assert(!reportHtml.includes("STALE reconstruction posture"), "case report must not invent a stale reconstruction posture");
const xssReport = presentationReportSections({
  ...presentation,
  hero: { ...presentation.hero, current_posture: "<script>alert(1)</script>" },
});
assert(xssReport.includes("&lt;script&gt;alert(1)&lt;/script&gt;"), "case report should escape HTML in presentation fields");
assert(!xssReport.includes("<script>alert(1)</script>"), "case report must not emit raw HTML from presentation fields");

const brief = buildPresentationBrief(presentation);
assert(brief.text.includes("RFE notice needs review"), "presentation brief must use the approved posture");
assert(brief.text.includes("Respond to the RFE"), "presentation brief must use the approved next action");
assert(!brief.text.includes("STALE reconstruction posture"), "presentation brief must not use reconstruction posture");
const grounded = presentationGroundingBlock(brief, "- passport is on file");
assert(grounded.includes("APPROVED CASE PRESENTATION"), "letters, notices, and Q&A must receive the approved presentation block");
assert(grounded.includes("COMPILED CASE EVIDENCE BRIEF"), "presentation grounding must still include compiled evidence");
assert(grounded.includes("RFE notice needs review"), "presentation grounding must include the approved posture");
const noticeSteps = withPresentationNoticeSteps(
  [{ title: "Keep copies of everything", description: "Store the notice." }],
  presentation,
  { inquiryMode: "existing_case" },
);
assert(noticeSteps[0]?.title === "Respond to the RFE", "notice explanations must surface the approved next action first");
assert(noticeSteps[1]?.title === "Keep copies of everything", "notice explanations must keep the notice-specific steps");
assert(/this case/.test(noticeSteps[0]?.description ?? ""), "filed notice next-step must stay this case");
assert(!/this situation/.test(noticeSteps[0]?.description ?? ""), "filed notice next-step must not say this situation");
const dedupedSteps = withPresentationNoticeSteps(
  [{ title: "Respond to the RFE", description: "Already listed." }],
  presentation,
  { inquiryMode: "existing_case" },
);
assert(dedupedSteps.length === 1, "notice explanations must not duplicate the approved next action");

const lowPlan = buildAnalysisPlan({
  caseStatus: "analyzed",
  documentCount: 1,
  documents: [{ id: "doc-1", processingStatus: "extracted" }],
  issues: [],
  unknowns: [],
  evidenceAuditStatus: "pass",
  evidenceFactKeys: ["form_type"],
});
assert(!lowPlan.tasks_required.includes(ANALYSIS_TASKS.PROCESS_DOCUMENTS), "extracted documents should skip PROCESS_DOCUMENTS");
assert(!lowPlan.tasks_required.includes(ANALYSIS_TASKS.INDEPENDENT_REVIEW), "low-risk cases should skip independent review");
assert(!lowPlan.tasks_required.includes(ANALYSIS_TASKS.QUESTION_PLANNING), "cases without unknowns should skip question planning");
assert(lowPlan.tasks_required.includes(ANALYSIS_TASKS.PRIMARY_REASONING), "analysis plan should still run primary reasoning");
assert(lowPlan.tasks_required.indexOf(ANALYSIS_TASKS.RECONSTRUCT_CASE) < lowPlan.tasks_required.indexOf(ANALYSIS_TASKS.RETRIEVE_AUTHORITY), "situation reconstruction must run before authority retrieval");
assert(lowPlan.deterministic_tools.includes("ACTION_GRAPH"), "analysis plan should include the action graph tool");
const lowDecisions = analysisRunDecisions(lowPlan);
assert(lowDecisions.processDocuments === false, "pipeline must not process already-extracted documents");
assert(lowDecisions.independentReview === false, "pipeline must not run independent review when the plan skipped it");
assert(lowDecisions.primaryReasoning === true, "pipeline must run primary reasoning when the plan requires it");

const blockedPlan = buildAnalysisPlan({
  caseStatus: "analyzed",
  documentCount: 1,
  documents: [{ id: "doc-1", processingStatus: "extracted" }],
  issues: [],
  unknowns: [],
  evidenceAuditStatus: "blocked",
  evidenceFactKeys: [],
});
assert(blockedPlan.blocking_conditions.length > 0, "blocked evidence should record a blocking condition");
assert(analysisRunDecisions(blockedPlan).primaryReasoning === false, "blocked evidence must not invent a new analysis");
assert(analysisRunDecisions(blockedPlan).reconstructCase === true, "blocked evidence should still reconstruct the case");

const closedPlan = buildAnalysisPlan({
  caseStatus: "closed",
  documentCount: 0,
  documents: [],
  issues: [],
  unknowns: [],
  evidenceFactKeys: [],
});
assert(closedPlan.stop_conditions.length > 0, "closed cases should record a stop condition");
assert(analysisRunDecisions(closedPlan).stop === true, "closed cases must stop the analysis pipeline");
assert(analysisRunDecisions(closedPlan).presentApprovedState === false, "closed cases must not run presentation AI");

const optionsPlan = buildAnalysisPlan({
  caseStatus: "analyzing",
  documentCount: 0,
  documents: [],
  issues: [],
  unknowns: [],
  evidenceAuditStatus: "blocked",
  evidenceFactKeys: [],
  situation: "I want to marry a US citizen and get a green card. We have not filed anything yet.",
  goal: "Show me what options I have",
});
assert(optionsPlan.blocking_conditions.length === 0, "open-options inquiries must not treat missing USCIS identifiers as a blocking condition");
assert(analysisRunDecisions(optionsPlan).primaryReasoning === true, "open-options inquiries must still run primary reasoning");
assert(analysisRunDecisions(optionsPlan).processDocuments === false, "open-options inquiries with no documents must skip document processing");
assert(optionsPlan.tasks_required.includes(ANALYSIS_TASKS.QUESTION_PLANNING), "open-options inquiries should plan follow-up questions");
assert(optionsPlan.authority_queries_needed.includes("I-130"), "open-options family inquiries should look up family petition rules");
assert(!optionsPlan.tasks_skipped.some((item) => /No USCIS documents were uploaded/i.test(item.reason)), "the analysis plan must not tell the customer that analysis is weaker because no documents were uploaded");
assert(optionsPlan.tasks_skipped.some((item) => item.task === ANALYSIS_TASKS.PROCESS_DOCUMENTS && /options review/i.test(item.reason)), "open-options plans may skip document processing without a missing-upload disclaimer");

assert(issuesNeedIndependentReview([{ professional_review: "required" }]) === true, "required professional review should trigger independent review");
const reviewAdd = runtimeReviewAddition(lowPlan, [{ issue_type: "professional_review" }]);
assert(reviewAdd?.task === ANALYSIS_TASKS.INDEPENDENT_REVIEW, "pipeline should add independent review when a finding requires it");
const questionAdd = runtimeQuestionAddition(lowPlan, 2);
assert(questionAdd?.task === ANALYSIS_TASKS.QUESTION_PLANNING, "pipeline should add question planning when unknowns remain");
const runtimeDecisions = analysisRunDecisions(lowPlan, { issues: [{ professional_review: "required" }], openUnknownCount: 2 });
assert(runtimeDecisions.independentReview === true, "runtime professional-review findings must enable independent review");
assert(runtimeDecisions.questionPlanning === true, "runtime unknowns must enable question planning");
const execution = buildPlanExecution(lowPlan, runtimeDecisions, { runtimeAdditions: [reviewAdd!, questionAdd!] });
assert(execution.tasks_executed.includes(ANALYSIS_TASKS.INDEPENDENT_REVIEW), "execution record must include runtime independent review");
assert(!execution.tasks_skipped.some((item) => item.task === ANALYSIS_TASKS.INDEPENDENT_REVIEW), "runtime independent review must not stay in the skipped list");
const summary = analysisPlanSummary({ ...lowPlan, execution });
assert(summary.executedLabels.includes("Second independent review"), "analysis plan summary should use customer-facing task labels");
assert(summary.complexityLabel === "Straightforward", "low-complexity plans should use a customer-facing complexity label");

const approvedState = buildCanonicalApprovedState({
  version: 2,
  reason: "analysis",
  pipelineConfigVersion: "v4.1-a11",
  evidenceSnapshotHash: "snapshot-hash-rfe",
  status: "analyzed",
  readinessScore: 72,
  evidenceAvailableScore: 80,
  evidenceProcessedScore: 70,
  actionReadinessScore: 65,
  presentation,
  analysisPlan: { ...lowPlan, execution },
});
assert(approvedState.presentation?.hero.current_posture === "RFE notice needs review", "canonical approved state must store the approved posture");
assert(!/STALE reconstruction/i.test(approvedState.presentation?.hero.current_posture ?? ""), "canonical approved state must not store a stale reconstruction posture");
assert(approvedState.analysis_plan?.execution?.tasks_executed.includes(ANALYSIS_TASKS.INDEPENDENT_REVIEW), "canonical approved state must keep the executed analysis plan");
assert(approvedState.analysis_plan?.execution?.tasks_skipped.some((item) => item.task === ANALYSIS_TASKS.PROCESS_DOCUMENTS), "canonical approved state must keep skipped plan tasks");
const roundTrip = parseCanonicalApprovedState(JSON.stringify(approvedState));
assert(roundTrip?.version === 2, "canonical approved state should round-trip the version number");
assert(roundTrip?.presentation?.hero.next_best_action?.action_key === "UPLOAD_NOTICE", "canonical approved state should round-trip the presentation");
assert(roundTrip?.analysis_plan?.execution?.blocked === false, "canonical approved state should round-trip plan execution");
assert(canonicalStateSummary(approvedState).versionLabel === "Case record version 2", "canonical summary should include the version label");
assert(canonicalStateSummary(approvedState).posture === "RFE notice needs review", "canonical summary should use the approved posture");
assert(canonicalStateSummary(approvedState).nextAction === presentation.hero.next_best_action?.title, "canonical summary should include the next action");
assert(versionReasonLabel("analysis") === "Full case review", "analysis versions should use a customer-facing reason label");
assert(versionReasonLabel("document") === "New documents on file", "document versions should use a customer-facing reason label");
assert(versionReasonLabel("clarify") === "Answers added to the case", "clarify versions should use a customer-facing reason label");
assert(versionReasonLabel("reprocess") === "Evidence reprocessed", "reprocess versions should use a customer-facing reason label");
assert(parseCanonicalApprovedState(JSON.stringify({ status: "analyzed", readinessScore: 10, issues: [], path_steps: [] })) === null, "legacy slim approved state is not a canonical versioned state");

const staleStored = { ...presentation, hero: { ...presentation.hero, current_posture: "STALE stored presentation" } };
const staleLive = { ...presentation, hero: { ...presentation.hero, current_posture: "STALE reconstruction posture" } };
const selected = selectApprovedPresentation({ canonical: approvedState, stored: staleStored, live: staleLive });
assert(selected?.source === "canonical", "approved presentation selector must prefer canonical state");
assert(selected?.presentation.hero.current_posture === "RFE notice needs review", "canonical approved presentation must beat a stale stored presentation");
assert(selectApprovedPresentation({ stored: staleStored, live: staleLive })?.source === "stored", "stored presentation is used when canonical is missing");
assert(selectApprovedPresentation({ live: staleLive })?.source === "live", "live assembly is used only when no approved presentation exists");
const approvedView = buildApprovedCaseView({ canonical: approvedState, stored: staleStored, live: staleLive });
assert(approvedView.source === "canonical", "approved case view must record canonical as the source");
assert(approvedView.version === 2, "approved case view must keep the canonical version number");
const listFromCanonical = caseListSummaryFromView(
  { status: "analyzed", reconstructionPosition: "STALE reconstruction posture" },
  approvedView,
);
assert(listFromCanonical.posture === "RFE notice needs review", "case lists must use the canonical approved posture");
assert(listFromCanonical.version === 2, "case lists must show the approved case record version");
assert(caseListVersionLine(listFromCanonical) === "Version 2 · Full case review", "case lists must use a customer-facing version line");
assert(!/STALE reconstruction/i.test(listFromCanonical.posture), "case lists must not show a stale reconstruction posture when canonical state exists");
assert(!/STALE stored/i.test(listFromCanonical.posture), "case lists must not show a stale stored presentation when canonical state exists");

const rfeInquiry = classifyImmigrationInquiry({
  situation: "I got an RFE from USCIS and the deadline is coming up.",
  goal: "Prepare an RFE response",
});
assert(rfeInquiry.mode === INQUIRY_MODES.EXISTING_CASE, "RFE language should classify as an existing USCIS case");
const marriageInquiry = classifyImmigrationInquiry({
  situation: "I want to marry a US citizen and get a green card. We have not filed anything yet.",
  goal: "Show me what options I have",
  documentCount: 0,
});
assert(marriageInquiry.mode === INQUIRY_MODES.OPEN_OPTIONS, "a marriage goal with no filing should classify as open options");
assert(marriageInquiry.themes.includes("family"), "a marriage green-card question should detect the family theme");
assert(!marriageInquiry.themes.includes("naturalization"), "mentioning a US citizen spouse must not classify the question as naturalization");
const studentInquiry = classifyImmigrationInquiry({
  situation: "I am on F-1 graduating next month. What can I do?",
  goal: "Work or stay after graduation",
});
assert(studentInquiry.mode === INQUIRY_MODES.OPEN_OPTIONS, "an F-1 graduation question with no case file should classify as open options");
assert(studentInquiry.themes.includes("student"), "an F-1 graduation question should detect the student theme");

const knowledgeCatalog: KnowledgeRecord[] = [
  {
    title: "USCIS receipt notices",
    reference: "I-797C",
    sourceType: "notice_guide",
    tags: "receipt, i-797, case status",
    url: "https://www.uscis.gov/forms/filing-guidance/form-i-797-types-and-functions",
    content: "A USCIS receipt notice confirms that USCIS accepted a filing for processing. It usually includes a receipt number, received date, notice date, form type, applicant or petitioner information, and the service center or field office.",
  },
  {
    title: "Requests for Evidence (RFE)",
    reference: "RFE",
    sourceType: "notice_guide",
    tags: "rfe, evidence, deadline, response",
    url: "https://www.uscis.gov/forms/filing-guidance/requests-for-evidence-and-notices-of-intent-to-deny",
    content: "A Request for Evidence means USCIS needs additional documents or clarification before deciding a case. The notice identifies the missing evidence, the response deadline, where to send the response, and whether copies or originals are required.",
  },
  {
    title: "Family petition overview",
    reference: "Form I-130",
    sourceType: "form_instruction",
    tags: "i-130, family, petitioner, beneficiary, relationship evidence",
    url: "https://www.uscis.gov/i-130",
    content: "Form I-130 is used by a U.S. citizen or lawful permanent resident petitioner to establish a qualifying family relationship with a beneficiary. Evidence usually includes identity documents, proof of status, relationship documents, and bona fide marriage evidence when based on marriage. Approval of I-130 alone does not grant status.",
  },
  {
    title: "Naturalization overview",
    reference: "Form N-400",
    sourceType: "form_instruction",
    tags: "n-400, naturalization, citizenship, continuous residence",
    url: "https://www.uscis.gov/n-400",
    content: "Form N-400 is used to apply for naturalization. A review should consider lawful permanent resident period, continuous residence, physical presence, good moral character, selective service if applicable, support obligations, trips outside the United States, and interview/civics requirements.",
  },
  {
    title: "Optional Practical Training for F-1 students",
    reference: "F-1 OPT",
    sourceType: "form_instruction",
    tags: "student, f-1, opt, graduation, i-20, work, i-765",
    url: "https://www.uscis.gov/working-in-the-united-states/students-and-exchange-visitors/optional-practical-training-opt-for-f-1-students",
    content: "F-1 students may apply for Optional Practical Training (OPT) to work in a field related to their major after or during studies. Evidence usually includes a valid Form I-20 with an OPT recommendation, passport identity page, Form I-94, and transcripts or enrollment records. OPT is requested on Form I-765.",
  },
  {
    title: "Employment authorization overview",
    reference: "Form I-765",
    sourceType: "form_instruction",
    tags: "i-765, ead, employment, student, opt, work",
    url: "https://www.uscis.gov/i-765",
    content: "Form I-765 is used to apply for an Employment Authorization Document. Eligibility categories include F-1 OPT, pending adjustment of status, asylum-related categories, and others listed on the form instructions. Evidence usually includes identity documents, proof of the qualifying status, and category-specific records such as an I-20 for OPT.",
  },
  {
    title: "Asylum and withholding overview",
    reference: "Form I-589",
    sourceType: "form_instruction",
    tags: "asylum, i-589, refugee, persecution, humanitarian",
    url: "https://www.uscis.gov/i-589",
    content: "Form I-589 is used to apply for asylum and for withholding of removal. Evidence usually includes a personal declaration, country-conditions material, identity documents, and any prior immigration records. These claims are high-stakes and should be reviewed by a licensed immigration attorney or accredited representative.",
  },
];

const rankedMarriage = rankKnowledgeSources(knowledgeCatalog, {
  query: "I want to marry a US citizen and get a green card. We have not filed anything yet. Show me what options I have",
  inquiryMode: "open_options",
  themes: marriageInquiry.themes,
  authorityQueries: ["I-130", "I-485"],
});
assert(rankedMarriage[0]?.title === "Family petition overview", `marriage options should rank the I-130 source first, got ${rankedMarriage[0]?.title}`);
assert(!rankedMarriage.some((source) => source.reference === "I-797C" || source.reference === "RFE" || source.reference === "F-1 OPT" || source.reference === "Form N-400"), "open-options marriage ranking must drop unrelated notice, student, and naturalization sources");

const rankedStudent = rankKnowledgeSources(knowledgeCatalog, {
  query: "I am on F-1 graduating next month. What can I do? Work or stay after graduation",
  inquiryMode: "open_options",
  themes: studentInquiry.themes,
  authorityQueries: ["I-765", "F-1"],
});
assert(/opt|i-765/i.test(`${rankedStudent[0]?.title} ${rankedStudent[0]?.reference}`), `F-1 ranking should prefer OPT or I-765, got ${rankedStudent[0]?.title}`);
assert(!rankedStudent.some((source) => source.reference === "I-797C" || source.reference === "RFE"), "open-options F-1 ranking must drop unrelated notice sources");

const rankedRfe = rankKnowledgeSources(knowledgeCatalog, {
  query: "I got an RFE from USCIS and the deadline is coming up.",
  inquiryMode: "existing_case",
  themes: ["adjustment"],
});
assert(rankedRfe[0]?.reference === "RFE", `existing-case RFE ranking should prefer the RFE source, got ${rankedRfe[0]?.reference}`);

const marriageOptions = buildOpenOptionsAnalysis({
  situation: "I want to marry a US citizen and get a green card. We have not filed anything yet.",
  goal: "Show me what options I have",
}, marriageInquiry, knowledgeCatalog);
assert(marriageOptions.reconstruction.currentPosition === OPEN_OPTIONS_POSTURE, "open-options reconstruction should use the exploring-options posture");
assert(marriageOptions.issues.some((issue) => issue.title === "Family petition overview" && issue.item_kind === "opportunity"), "marriage options should be titled from the matching official source, not a canned essay");
assert(/Approval of I-130 alone does not grant status/i.test(JSON.stringify(marriageOptions.issues)), "marriage options must quote the matching I-130 rule");
assert(/identity documents|relationship documents|bona fide marriage/i.test(JSON.stringify(marriageOptions.unknowns)), "follow-up questions must come from the I-130 evidence list");
assert(!marriageOptions.unknowns.some((item) => item.key === "receipt_number"), "open-options analysis must not ask for a receipt number");
assert(!marriageOptions.issues.some((issue) => /family green card path may be possible/i.test(issue.title)), "open-options analysis must not emit the canned family-green-card essay title");
assert(marriageOptions.pathSteps[0]?.action_key === "ADD_CASE_DETAILS", "open-options next steps should start with clarifying facts, not uploading a notice");
assert(/Form I-130/i.test(marriageOptions.pathSteps.find((step) => step.action_key === "PREPARE_FORM")?.title ?? ""), "marriage official-form review should name Form I-130 from the top-ranked source");
assert(!marriageOptions.pathSteps.some((step) => step.action_key === "COMPLETE_FORM_I485"), "marriage options must not start the I-485 wizard ahead of I-130");
assert(!/I-485/i.test(marriageOptions.pathSteps.map((step) => step.title).join(" ")), "marriage next-step titles must not jump to I-485 ahead of the I-130 petition");
assert(!marriageOptions.pathSteps.some((step) => step.action_key === "UPLOAD_NOTICE" || step.action_key === "GET_CASE_RECORD"), "open-options next steps must not require a USCIS case record");
assert(marriageOptions.issues.every((issue) => issue.professional_review === "probably_unnecessary"), "a simple marriage-options story should not require a consultant");
assert(!/Preliminary review|No USCIS case file is on record|no USCIS documents were uploaded/i.test(JSON.stringify(marriageOptions)), "customer-facing options analysis must not be framed as preliminary or missing a case file");
assert(/Matching official USCIS\/DOJ material/i.test(marriageOptions.reconstruction.summary), "options reconstruction should cite matching official material for this goal");

const studentOptions = buildOpenOptionsAnalysis({
  situation: "I am on F-1 graduating next month. What can I do?",
  goal: "See my work and stay options",
}, studentInquiry, knowledgeCatalog);
assert(studentOptions.issues.some((issue) => /opt|i-765|employment authorization/i.test(`${issue.title} ${issue.our_conclusion}`)), "F-1 options should describe OPT or I-765 from official material");
assert(!/I-797C|Request for Evidence|receipt notice/i.test(JSON.stringify(studentOptions.issues)), "F-1 options must not dump unrelated notice articles");
assert(studentOptions.issues.every((issue) => issue.professional_review !== "required"), "an F-1 graduation question should not require a consultant");
assert(/Form I-765/i.test(studentOptions.pathSteps.find((step) => step.action_key === "PREPARE_FORM")?.title ?? ""), "F-1 official-form review should name Form I-765");
assert(!studentOptions.pathSteps.some((step) => step.action_key === "COMPLETE_FORM_I485"), "F-1 options must not start I-485 ahead of I-765");

const asylumOptions = buildOpenOptionsAnalysis({
  situation: "I am afraid to return home because of persecution and want to apply for asylum.",
  goal: "Find out if I can stay",
}, undefined, knowledgeCatalog);
assert(asylumOptions.issues.some((issue) => issue.professional_review === "required" || issue.issue_type === "professional_review"), "asylum facts should flag licensed professional review");
assert(/Form I-589/i.test(asylumOptions.pathSteps.find((step) => step.action_key === "PREPARE_FORM")?.title ?? ""), "asylum official-form review should name Form I-589");
assert(evaluateConsultantReferral({ text: "I received a Notice of Intent to Deny on my I-485." }).level === "required", "a NOID should require professional review");
assert(evaluateConsultantReferral({ text: "I am on F-1 graduating next month." }).level === "probably_unnecessary", "a simple F-1 question should not require a consultant");
assert(evaluateConsultantReferral({ text: "USCIS sent an RFE and I must respond within 87 days." }).level === "recommended", "an RFE with a deadline should recommend professional review");
assert(evaluateConsultantReferral({
  text: "I want to stay in the United States.",
  sources: [knowledgeCatalog.find((item) => item.reference === "Form I-589")!],
}).level === "required", "matching I-589 official material should require a consultant even without the word asylum in the question");
assert(evaluateConsultantReferral({
  text: "I want to stay in the United States.",
  sources: [knowledgeCatalog.find((item) => item.reference === "Form I-130")!],
}).level === "probably_unnecessary", "matching I-130 material must not by itself require a consultant");
assert(refineInquiryThemes(["naturalization", "family"], [knowledgeCatalog.find((item) => item.reference === "Form I-130")!]).includes("family"), "themes should follow matching official material");
assert(!refineInquiryThemes(["naturalization", "family"], [knowledgeCatalog.find((item) => item.reference === "Form I-130")!]).includes("naturalization"), "official I-130 material must drop an unrelated naturalization theme");

const boostedForm = rankGoalSuggestions(
  officialSuggestionCandidates([knowledgeCatalog[2]], [], { level: "probably_unnecessary", reason: "" }),
  suggestionBoostsFromStats(
    [{ queryKey: "family|I-130", actionKey: "PREPARE_FORM", completedCount: 12, recommendedCount: 20 }],
    ["family|I-130"],
  ),
);
assert(boostedForm[0]?.action_key === "PREPARE_FORM", "when facts are complete, the historically completed official form review should be the next suggestion");
const pinnedDespiteBoost = rankGoalSuggestions(
  officialSuggestionCandidates(
    [knowledgeCatalog[2]],
    [{ question: "What can you share about identity documents?", item: "identity documents" }],
    { level: "probably_unnecessary", reason: "" },
  ),
  { PREPARE_FORM: 20, REVIEW_ANALYSIS: 20 },
);
assert(pinnedDespiteBoost[0]?.action_key === "ADD_CASE_DETAILS", "learning must not skip official evidence gaps even when another action was completed more often");
assert(historicalSuggestionBoost(12, 4) > historicalSuggestionBoost(1, 1), "suggestions that similar customers completed should rank higher over time");
assert(consultantFromOfficialSources([knowledgeCatalog.find((item) => item.reference === "Form I-589")!])?.level === "required", "I-589 official material itself should mark professional review required");
assert(consultantFromOfficialSources([knowledgeCatalog.find((item) => item.reference === "Form I-765")!]) == null, "I-765 listing asylum-related EAD categories must not treat the source as an asylum case");
assert(suggestionQuestionKey("evidence:identity_documents") === "question:identity_documents", "clarify completions must record the same question key the ranker uses");
assert(suggestionQuestionKey("evidence:presentation:0") === "", "presentation-index questions must not create junk learning keys");
const rankedOpenQuestions = rankFollowUpQuestions(
  [
    { key: "receipt_number" },
    { key: "identity_documents" },
    { key: "location" },
    { key: "bona_fide_marriage_evidence" },
  ],
  suggestionBoostsFromStats(
    [{ queryKey: "family|I-130", actionKey: "question:bona_fide_marriage_evidence", completedCount: 12, recommendedCount: 4 }],
    ["family|I-130"],
  ),
  { openOptions: true },
);
assert(rankedOpenQuestions[0]?.key === "location", "status/location questions stay first even after similar customers answer a later evidence item");
assert(rankedOpenQuestions[1]?.key === "bona_fide_marriage_evidence", "similar customers completing an official evidence question should promote it after pinned status/location");
assert(!rankedOpenQuestions.some((item) => item.key === "receipt_number"), "open-options interviews must drop receipt-number questions");
assert(rankFollowUpQuestions(
  [{ key: "identity_documents" }, { key: "location" }],
  { "question:identity_documents": 20 },
  { openOptions: true },
)[0]?.key === "location", "learning cannot skip the pinned location question");
const nextOfficialQuestion = selectNextClarifyQuestion({
  openOptions: true,
  answeredKeys: [],
  planned: { unknownKey: "identity_documents", question: "What can you share about identity documents?" },
});
assert(nextOfficialQuestion?.key === "evidence:identity_documents", "the live interview should ask the planned official gap first");
assert(!/receipt number/i.test(nextOfficialQuestion?.text ?? ""), "the first open-options question must not ask for a receipt number");
assert(selectNextClarifyQuestion({
  openOptions: true,
  answeredKeys: ["evidence:identity_documents"],
  planned: { unknownKey: "identity_documents", question: "What can you share about identity documents?" },
})?.key === "anything_else", "answering evidence:key must count as answering that official question");
assert(!/receipt notice/i.test(selectNextClarifyQuestion({
  openOptions: true,
  answeredKeys: ["evidence:identity_documents", "evidence:location"],
  planned: null,
})?.text ?? ""), "after official gaps, open-options must not fall through to a case-file receipt question");
assert(selectNextClarifyQuestion({
  openOptions: true,
  answeredKeys: ["evidence:identity_documents", "anything_else"],
  planned: null,
  hasCaseRecord: false,
  hasNotice: true,
}) === null, "open-options interviews must end without asking for a USCIS case record");
assert(selectNextClarifyQuestion({
  openOptions: false,
  answeredKeys: [],
  planned: { unknownKey: "response_deadline", question: "What evidence will be submitted for the RFE?" },
  hasYear: true,
  hasNotice: true,
  hasCaseRecord: true,
})?.key === "evidence:response_deadline", "an RFE case should still ask the planned RFE evidence question");
assert(selectNextClarifyQuestion({
  openOptions: false,
  answeredKeys: [],
  planned: null,
  presentationUnknowns: ["What evidence will be submitted for the RFE?"],
  hasYear: false,
})?.text === "What evidence will be submitted for the RFE?", "an existing-case RFE should still use the approved presentation follow-up when no planned unknown remains");
assert(selectNextClarifyQuestion({
  openOptions: true,
  answeredKeys: ["evidence:identity_documents", "anything_else"],
  planned: null,
  presentationUnknowns: ["What is your USCIS receipt number?"],
  hasCaseRecord: false,
}) === null, "open-options must ignore presentation receipt follow-ups after official gaps");
assert(selectNextClarifyQuestion({
  openOptions: false,
  answeredKeys: ["evidence:response_deadline"],
  planned: null,
  hasYear: true,
  hasNotice: true,
  hasCaseRecord: true,
})?.key === "notice_details", "an existing-case RFE can still ask about the notice after official gaps");

const emptyReconcile = reconcileEvidenceStates([{
  documentType: "other",
  facts: [],
  events: [],
  relationships: [],
  unknowns: [],
  suppressedQuestions: [],
  audit: { status: "needs_more_evidence", summary: "", blockingUnknowns: [], warnings: [] },
  reconstruction: { summary: "", currentPosition: "", timeline: [], pendingActions: [], confidence: "needs_verification" },
}]);
assert(emptyReconcile.reconstruction.currentPosition === "Case posture needs verification", "empty evidence should still reconstruct as unverified before inquiry overlay");
const overlaid = applyInquiryToEvidenceState(emptyReconcile, marriageInquiry, "Show me what options I have", knowledgeCatalog);
assert(overlaid.reconstruction.currentPosition === OPEN_OPTIONS_POSTURE, "inquiry overlay should replace unverified case posture for open options");
assert(!overlaid.unknowns.some((item) => item.key === "receipt_number"), "open-options overlay must not ask for a receipt number the person does not have");
assert(overlaid.audit.status !== "blocked", "open-options overlay must not leave the evidence audit blocked");
assert(!/Preliminary review|No USCIS case file is required|No USCIS case file is on record/i.test(overlaid.audit.summary), "open-options overlay must not present analysis as preliminary because a file is missing");
assert(/identity documents|relationship documents|bona fide marriage|current immigration status/i.test(JSON.stringify(overlaid.unknowns)), "open-options overlay questions should come from official material or missing status");

const optionsPresentation = assemblePresentationContract({
  status: "analyzed",
  actionReadinessScore: 20,
  reconstruction: {
    currentPosition: overlaid.reconstruction.currentPosition,
    summary: overlaid.reconstruction.summary,
    timeline: [],
    pendingActions: overlaid.reconstruction.pendingActions,
  },
  issues: marriageOptions.issues.map((issue, index) => ({
    id: `opt-${index}`,
    title: issue.title,
    itemKind: issue.item_kind,
    state: issue.state,
    evidenceStatus: issue.evidence_status,
    evidenceStrength: issue.evidence_strength,
    conclusion: issue.our_conclusion,
    nextAction: issue.next_action,
    issueType: issue.issue_type,
    altAction: issue.alternative_action,
  })),
  deadlines: [],
  actionNodes: marriageOptions.pathSteps.map((step, index) => ({
    id: `path-${index}`,
    title: step.title,
    actionKey: step.action_key,
    status: index === 0 ? "READY" : "BLOCKED",
    priority: index + 1,
  })),
  documents: [],
  unknowns: overlaid.unknowns.map((item) => ({ question: item.question })),
  evidenceGateStatus: overlaid.audit.status,
  conflicts: [],
});
assert(optionsPresentation.hero.current_posture === OPEN_OPTIONS_POSTURE, "open-options presentation must not fall back to raw status");
assert(optionsPresentation.hero.professional_review_recommended === false, "a simple marriage-options story must not flag consultant review on the hero");
assert(!/STALE reconstruction|Case posture needs verification|upload a (uscis )?notice/i.test(JSON.stringify(optionsPresentation)), "open-options presentation must not show unverified case posture or notice-only next steps");
assert(optionsPresentation.findings.some((finding) => finding.group === "opportunity"), "open-options presentation should show pathway opportunities");
assert(!/the case is still being organized/i.test(optionsPresentation.what_this_means.summary), "open-options presentation must not use the canned case organizing summary");
assert(presentationWhatThisMeansSummary("The case is still being organized from the available information.", { inquiryMode: "open_options" }) === OPTIONS_ORGANIZING_SUMMARY, "stored canned case organizing copy must remap to this situation");
assert(presentationWhatThisMeansSummary("The case is still being organized.", { inquiryMode: "existing_case" }) === FILED_ORGANIZING_SUMMARY, "filed canned organizing copy stays the case");
assert(presentationWhatThisMeansSummary("You asked about a family petition.", { inquiryMode: "open_options" }) === "You asked about a family petition.", "real presentation summaries must not be rewritten");
const emptyOpenPresentation = assemblePresentationContract({
  status: "analyzed",
  actionReadinessScore: 0,
  inquiryMode: "open_options",
  issues: [],
  deadlines: [],
  actionNodes: [],
  documents: [],
});
assert(emptyOpenPresentation.what_this_means.summary === OPTIONS_ORGANIZING_SUMMARY, "open-options assemble fallback must not say the case is still being organized");
const emptyFiledPresentation = assemblePresentationContract({
  status: "analyzed",
  actionReadinessScore: 0,
  inquiryMode: "existing_case",
  issues: [],
  deadlines: [],
  actionNodes: [],
  documents: [],
});
assert(emptyFiledPresentation.what_this_means.summary === FILED_ORGANIZING_SUMMARY, "filed assemble fallback stays the case is still being organized");
assert(/this situation/i.test(buildPresentationBrief(emptyOpenPresentation, { inquiryMode: "open_options" }).text), "open-options presentation brief must not say the case is still being organized");
assert(/the case is still being organized/i.test(buildPresentationBrief(emptyFiledPresentation, { inquiryMode: "existing_case" }).text), "filed presentation brief stays the case is still being organized");
assert(/this situation/i.test(presentationReportSections(emptyOpenPresentation, { inquiryMode: "open_options" })), "open-options report must not keep the canned case organizing summary");
assert(/the case is still being organized/i.test(presentationReportSections(emptyFiledPresentation, { inquiryMode: "existing_case" })), "filed report stays the canned case organizing summary");
assert(approvedPresentationHeading({ inquiryMode: "open_options" }) === "Approved options presentation", "open-options letter context must not stay Approved case presentation");
assert(approvedPresentationHeading({ inquiryMode: "existing_case" }) === "Approved case presentation", "filed letter context stays Approved case presentation");
assert(presentationStepCta("ADD_CASE_DETAILS", "case-1")?.label === "Answer follow-up questions", "options follow-up CTA should not require a case file");
assert(presentationStepCta("REVIEW_ANALYSIS", "case-1")?.href === "/app/qa?case=case-1", "follow-up questions should still link to Q&A");

const qaFallback = buildQaFallbackAnswer({
  question: "I want to marry a US citizen. What can we do if we have not filed yet?",
  sources: knowledgeCatalog,
});
assert(/do not need a USCIS case/i.test(qaFallback), "Q&A without a case should still answer options questions");
assert(/Family petition overview/i.test(qaFallback), "Q&A fallback should cite the matching official source");
assert(/For this goal, the next step/i.test(qaFallback), "Q&A should suggest the next official step for this goal");
assert(/To match this official material more closely:/i.test(qaFallback), "guest Q&A should ask the next official follow-up without a case file");
assert(!/receipt notice|Do you have your USCIS/i.test(qaFallback), "guest Q&A follow-up must not ask for a USCIS case record");
assert(!/upload your USCIS notice/i.test(qaFallback), "Q&A fallback must not tell people with no file that they must upload a notice");
assert(!/I-797C|Request for Evidence/i.test(qaFallback), "Q&A fallback must not dump unrelated notice articles into a marriage question");

const i130Authority = {
  id: "auth-i130",
  key: "uscis_i130",
  title: "Form I-130, Petition for Alien Relative",
  url: "https://www.uscis.gov/i-130",
  sourceType: "form_instruction",
  publisher: "USCIS",
  authorityRank: "high",
  jurisdictionOrScope: "Family-based immigrant petition",
};
assert(findAuthorityForKnowledge(knowledgeCatalog[2], [i130Authority])?.key === "uscis_i130", "knowledge excerpts must link to the authority registry by official URL");
assert(authorityQueryKeys(["family"], ["I-130"]).includes("family|I-130"), "match stats should key historical hits by theme and plan query");
assert(historicalMatchBoost(7) > historicalMatchBoost(1), "sources that historically matched similar goals should rank higher over time");
const boostedMarriage = rankKnowledgeSources(knowledgeCatalog, {
  query: "I want to marry a US citizen and get a green card. We have not filed anything yet. Show me what options I have",
  inquiryMode: "open_options",
  themes: marriageInquiry.themes,
  authorityQueries: ["I-130", "I-485"],
  matchBoosts: matchBoostsFromStats(
    [{ url: "https://www.uscis.gov/i-130", queryKey: "family|I-130", hitCount: 12 }],
    ["family|I-130"],
  ),
});
assert(boostedMarriage[0]?.title === "Family petition overview", "historical match boosts must not displace the matching I-130 source");
assert((matchBoostsFromStats([{ url: "https://www.uscis.gov/i-130", queryKey: "family|I-130", hitCount: 12 }], ["family|I-130"])["https://www.uscis.gov/i-130"] ?? 0) > 0, "match stats should produce a URL boost for the same goal/query");
assert(overlappingOfficialUpdate({ title: "USCIS Updates Form I-130 Instructions", summary: "New edition of Form I-130." }, ["I-130"], "marry a US citizen for a green card") === true, "live USCIS updates should attach when they share a plan form query");
assert(overlappingOfficialUpdate({ title: "Chinese Alien Charged with Voter Fraud in Massachusetts", summary: "A charging decision unrelated to this customer's goal." }, ["I-130", "I-485"], "I want to marry a US citizen and get a green card. We have not filed anything with USCIS yet.") === false, "live USCIS news must not attach on generic words such as with");
assert(knowledgeFromSnapshot({
  title: "Family petition overview",
  url: "https://www.uscis.gov/i-130",
  excerpt: "Form I-130 is used by a U.S. citizen or lawful permanent resident petitioner.",
  applicabilityJson: JSON.stringify([{ reference: "Form I-130", tags: "i-130, family", sourceType: "form_instruction" }]),
}).reference === "Form I-130", "snapshots must restore the official reference so later ranking still sees I-130");

const qaStudent = buildQaFallbackAnswer({
  question: "I am on F-1 graduating next month. What can I do after graduation?",
  sources: knowledgeCatalog,
});
assert(/OPT|I-765|Employment authorization/i.test(qaStudent), "F-1 Q&A should answer from OPT or I-765 material");
assert(!/I-797C|Request for Evidence|receipt notice/i.test(qaStudent), "F-1 Q&A must not dump unrelated RFE or receipt-notice articles");
assert(!/licensed professional should be involved/i.test(qaStudent), "F-1 Q&A should not require a consultant");
assert(/To match this official material more closely:/i.test(qaStudent), "F-1 Q&A should continue with an official OPT/I-765 follow-up");
assert(!/receipt notice|Do you have your USCIS/i.test(qaStudent), "F-1 Q&A follow-up must not ask for a notice the student does not have");
const askedMarriageFollowUp = askedFollowUpFromAssistant(qaFallback);
assert(askedMarriageFollowUp, "marriage Q&A should expose a parseable official follow-up");
const qaMarriageNext = buildQaFallbackAnswer({
  question: "Passport and my birth certificate.",
  history: [
    { role: "user", content: "I want to marry a US citizen. What can we do if we have not filed yet?" },
    { role: "assistant", content: qaFallback },
    { role: "user", content: "Passport and my birth certificate." },
  ],
  sources: knowledgeCatalog,
});
assert(/Family petition overview|I-130/i.test(qaMarriageNext), "a short follow-up reply must keep the original marriage goal and official I-130 material");
assert(/To match this official material more closely:/i.test(qaMarriageNext), "the next Q&A turn should ask the next official gap");
assert(askedFollowUpFromAssistant(qaMarriageNext) !== askedMarriageFollowUp, "answering one official Q&A follow-up should advance to a different official gap");
assert(!/identity documents/.test(conversationNarrative([
  { role: "assistant", content: "Evidence usually includes identity documents, proof of status, and relationship documents." },
  { role: "user", content: "I want to marry a US citizen and we have not filed yet." },
])), "Q&A retrieval must not treat official excerpts in prior assistant turns as facts the customer already shared");
assert(!/receipt notice|Do you have your USCIS/i.test(qaMarriageNext), "later Q&A turns must not fall through to a case-file question");
const identityAsk = "What can you share about identity documents?";
const identityHistory = [
  { role: "user", content: "I want to marry a US citizen. What can we do if we have not filed yet?" },
  { role: "assistant", content: `${qaFallback.split(QA_FOLLOW_UP_PREFIX)[0]}${QA_FOLLOW_UP_PREFIX} ${identityAsk}` },
  { role: "user", content: "Passport and my birth certificate." },
];
const qaAfterIdentity = buildQaFallbackAnswer({
  question: "Passport and my birth certificate.",
  history: identityHistory,
  sources: knowledgeCatalog,
});
const nextStepAfterIdentity = qaAfterIdentity.split("\n").find((line) => /For this goal, the next step/i.test(line)) ?? "";
assert(nextStepAfterIdentity, "after an official Q&A answer the remaining official next step must still be named");
assert(!/identity documents/i.test(nextStepAfterIdentity), "answering identity documents must drop that gap from remaining official needs");
assert(/proof of status|relationship documents|bona fide marriage/i.test(nextStepAfterIdentity), "unanswered official gaps must remain on the next-step line");
assert(askedFollowUpFromAssistant(qaAfterIdentity) !== identityAsk, "the next official follow-up must not re-ask the gap that was just answered");
assert(/Family petition overview|I-130/i.test(qaAfterIdentity), "closing one official gap must keep the original marriage goal");
assert(qaConversationCanSaveAsOptionsCase(identityHistory) === true, "answering an official follow-up should unlock saving the conversation as an options review");
assert(qaConversationCanSaveAsOptionsCase([{ role: "user", content: "I got an RFE from USCIS and the deadline is coming up." }]) === false, "an RFE question with no official options follow-up must not offer an options review");
assert(
  selectNextClarifyQuestion({
    openOptions: true,
    answeredKeys: ["evidence:identity_documents"],
    planned: { unknownKey: "identity_documents", question: identityAsk },
  })?.text !== identityAsk,
  "an options case seeded from Q&A must not re-ask the official gap already answered in chat",
);
assert(!/receipt notice|Do you have your USCIS/i.test(qaAfterIdentity), "gap-closing Q&A turns must not fall through to a case-file question");
const qaRfe = buildQaFallbackAnswer({
  question: "I got an RFE from USCIS and the deadline is coming up.",
  sources: knowledgeCatalog,
});
assert(!/To match this official material more closely:/i.test(qaRfe), "an existing-case RFE question must not start an open-options interview in Q&A");
assert(/RFE|Request for Evidence/i.test(qaRfe), "an RFE question should still retrieve the RFE material");
const listFromOptions = caseListSummaryFromView(
  { status: "analyzed", reconstructionPosition: "STALE reconstruction posture" },
  buildApprovedCaseView({
    canonical: buildCanonicalApprovedState({
      version: 1,
      reason: "analysis",
      pipelineConfigVersion: "v4.2-c1",
      evidenceSnapshotHash: "options-hash",
      status: "analyzed",
      readinessScore: 30,
      presentation: optionsPresentation,
    }),
    live: assemblePresentationContract({
      status: "analyzed",
      actionReadinessScore: 0,
      reconstruction: { currentPosition: "STALE reconstruction posture", summary: "stale", timeline: [], pendingActions: [] },
      issues: [],
      deadlines: [],
      actionNodes: [],
      documents: [],
    }),
  }),
);
assert(listFromOptions.posture === OPEN_OPTIONS_POSTURE, "case lists must show the approved open-options posture, not a stale reconstruction");

const guestEntitlement = resolveQaEntitlement({ isGuest: true });
const freeEntitlement = resolveQaEntitlement({ isGuest: false, planKey: "free", qaQuestionLimit: 3 });
const plusEntitlement = resolveQaEntitlement({ isGuest: false, planKey: "plus", qaQuestionLimit: null, personalized: true });
const proEntitlement = resolveQaEntitlement({
  isGuest: false,
  planKey: "pro",
  qaQuestionLimit: null,
  personalized: true,
  consultantReferral: true,
});
assert(guestEntitlement.questionLimit === 1 && guestEntitlement.allowSaveOptionsCase === false, "guests get one general question and cannot save an options case");
assert(freeEntitlement.questionLimit === 3 && freeEntitlement.showUpgradeCta && !freeEntitlement.personalized, "free plans get a small monthly general Q&A allowance");
assert(plusEntitlement.personalized && plusEntitlement.maxFollowUps === null && plusEntitlement.showUpgradeCta, "plus keeps personalized official follow-ups");
assert(proEntitlement.consultantReferral && !proEntitlement.showUpgradeCta, "pro can offer a matched professional");
assert(qaUsageFromCount(1, guestEntitlement).blocked, "a guest who already asked the allowed question must be blocked");
assert(qaUsageFromCount(3, freeEntitlement).blocked, "free Q&A must stop at the monthly limit");
assert(!qaUsageFromCount(20, plusEntitlement).blocked, "plus general Q&A must not use the free monthly cap");
assert(consultantSpecialtiesForThemes(["family", "student"]).includes("family"), "marriage themes should map to family consultants");
assert(consultantSpecialtiesForThemes(["student"]).includes("employment"), "student themes should map to employment consultants");

const guestQa = buildQaFallbackAnswer({
  question: "I want to marry a US citizen. What can we do if we have not filed yet?",
  sources: knowledgeCatalog,
  entitlement: guestEntitlement,
});
assert(/I-130|Family petition overview/i.test(guestQa), "a limited guest answer must still name the matching I-130 path");
assert(/Create a free account/i.test(guestQa), "guest answers must route visitors to register");
assert(/licensed immigration attorney or accredited representative/i.test(guestQa), "guest answers must tease platform professionals without assigning one");
assert(/To match this official material more closely:/i.test(guestQa), "the first guest answer should still include one official follow-up hook");
assert(!/should be involved before you act/i.test(guestQa), "a simple marriage guest answer must not require a consultant");

const guestF1 = buildQaFallbackAnswer({
  question: "I am on F-1 graduating next month. What can I do?",
  sources: knowledgeCatalog,
  entitlement: guestEntitlement,
});
assert(/OPT|I-765/i.test(guestF1), "a limited guest F-1 answer must still name OPT or I-765");
assert(!/should be involved before you act/i.test(guestF1), "guest F-1 answers must not invent a consultant-required flag");
assert(!/Create a free account/i.test(qaFallback), "full unentitled fallback used by C1–C7 must not grow a register footer");

const freeQa = buildQaFallbackAnswer({
  question: "I want to marry a US citizen. What can we do if we have not filed yet?",
  sources: knowledgeCatalog,
  entitlement: freeEntitlement,
});
assert(/Upgrade to Plus|Paid plans keep personalized/i.test(freeQa) || /Plus keeps personalized/i.test(freeQa), "free answers must offer an upgrade for personalized follow-ups");
assert(/Pro adds a matched licensed attorney/i.test(freeQa), "free answers must tease Pro consultant matching, not name a specific professional");
assert(!/A licensed professional on ImmigrationOnMe who works this kind of matter:/i.test(freeQa), "free Q&A must not reveal a named consultant match");

const plusQa = buildQaFallbackAnswer({
  question: "I want to marry a US citizen. What can we do if we have not filed yet?",
  sources: knowledgeCatalog,
  entitlement: plusEntitlement,
});
assert(!/Create a free account/i.test(plusQa), "plus answers must not show the guest register CTA");
assert(/Upgrade to Pro to get a matched professional/i.test(plusQa), "plus answers should offer Pro consultant matching");
assert(/Approval of I-130 alone does not grant status/i.test(plusQa), "personalized plus answers should keep the matching official excerpt");

const proQa = applyQaEntitlementToAnswer(
  "Form I-130 is the family petition used to establish a qualifying relationship.",
  proEntitlement,
  { consultant: { name: "Alex Rivera", credentialLabel: "immigration attorney" } },
);
assert(/Alex Rivera, immigration attorney/i.test(proQa), "pro answers should name the best matching professional when one exists");
assert(/nothing is shared until you approve/i.test(proQa), "pro consultant offers must still require customer consent");

const guestSecondFollowUp = buildQaFallbackAnswer({
  question: "Passport and my birth certificate.",
  history: identityHistory,
  sources: knowledgeCatalog,
  entitlement: guestEntitlement,
});
assert(!/To match this official material more closely:/i.test(guestSecondFollowUp) || guestSecondFollowUp.indexOf("To match this official material more closely:") === guestSecondFollowUp.lastIndexOf("To match this official material more closely:"), "guests must not keep stacking official follow-ups after the first hook");

const guestSuggestions = resolveSuggestionEntitlement({ isGuest: true });
const freeSuggestions = resolveSuggestionEntitlement({ isGuest: false, planKey: "free" });
const plusSuggestions = resolveSuggestionEntitlement({ isGuest: false, planKey: "plus", personalized: true });
const proSuggestions = resolveSuggestionEntitlement({ isGuest: false, planKey: "pro", personalized: true, consultantReferral: true });
assert(guestSuggestions.maxPathSteps === 1 && guestSuggestions.maxClarifyAnswers === 0, "guests get one suggested next step and cannot continue the interview");
assert(freeSuggestions.maxPathSteps === 1 && freeSuggestions.maxClarifyAnswers === 3 && freeSuggestions.showUpgradeCta, "free plans keep one official next step and a few follow-ups");
assert(plusSuggestions.personalized && plusSuggestions.maxPathSteps === null && plusSuggestions.showUpgradeCta, "plus keeps the full official suggested path");
assert(proSuggestions.consultantReferral && !proSuggestions.showUpgradeCta, "pro can offer a matched professional on the suggested path");
assert(suggestionUsageFromCount(0, guestSuggestions).blocked, "guests cannot answer case follow-ups until they register");
assert(suggestionUsageFromCount(3, freeSuggestions).blocked, "free follow-ups must stop at the per-case limit");
assert(!suggestionUsageFromCount(20, plusSuggestions).blocked, "plus follow-ups must not use the free cap");
const fourSteps = [
  { action_key: "ADD_CASE_DETAILS" },
  { action_key: "REVIEW_ANALYSIS" },
  { action_key: "PREPARE_FORM" },
  { action_key: "FIND_CONSULTANT" },
];
const freeSteps = limitSuggestionItems(fourSteps, freeSuggestions.maxPathSteps);
assert(freeSteps.visible.length === 1 && freeSteps.visible[0]?.action_key === "ADD_CASE_DETAILS", "free suggestion depth must keep the pinned official next step");
assert(freeSteps.hidden === 3, "extra official steps stay behind the paid path");
assert(limitSuggestionItems(fourSteps, plusSuggestions.maxPathSteps).hidden === 0, "personalized suggestions must keep the full ranked path");
assert(/Create a free account/i.test(suggestionConsultantCopy(guestSuggestions)), "guest suggestion copy must route visitors to register");
assert(/Upgrade to Plus|full suggested path/i.test(suggestionConsultantCopy(freeSuggestions)), "free suggestion copy must offer the paid path");
assert(/Alex Rivera/.test(suggestionConsultantCopy(proSuggestions, { name: "Alex Rivera", credentialLabel: "immigration attorney" })), "pro suggestion copy should name the matching professional");
assert(!/should be involved/i.test(suggestionConsultantCopy(freeSuggestions)), "a simple free suggestion teaser must not invent a consultant-required flag");
assert(listFromOptions.posture === OPEN_OPTIONS_POSTURE, "case lists must still show the approved open-options posture after suggestion entitlements");

const guestMatch = resolveMatchRequestEntitlement({ isGuest: true });
const freeMatch = resolveMatchRequestEntitlement({ audience: "free", consultantReferral: false });
const plusMatch = resolveMatchRequestEntitlement({ audience: "plus", consultantReferral: false });
const proMatch = resolveMatchRequestEntitlement({ audience: "pro", consultantReferral: true });
assert(!guestMatch.canRequest && guestMatch.showRegisterCta, "guests cannot request a professional match");
assert(!freeMatch.canRequest && freeMatch.showUpgradeCta, "free plans cannot request a professional match");
assert(!plusMatch.canRequest, "plus still upgrades to Pro for a named professional match");
assert(proMatch.canRequest && canRequestConsultantMatch(proMatch), "pro with consultant.referral can request a match");
assert(!openMatchBlocksNewRequest(0), "no open assignment should allow a new customer request");
assert(openMatchBlocksNewRequest(1), "an open proposed match must not stack another request");
const requested = assignmentPayloadFromCustomerRequest({
  userId: "user-1",
  consultantId: "consultant-1",
  caseId: "case-1",
  reasonSummary: "Alex Rivera matches this family matter.",
});
assert(requested.autoAssigned === false, "customer match requests must never be marked auto-assigned");
assert(requested.status === "user_accepted" && requested.assignedById === "user-1", "requesting a match is the customer's consent");
assert(!customerMatchSharesFiles(requested.status), "files stay private until the professional also accepts");
assert(customerMatchSharesFiles("active"), "active connections may share the case with the matched professional");
assert(!consultantSeesCaseDetails("proposed") && !consultantSeesCaseDetails("user_accepted"), "consultants must not see case files before the connection is active");
assert(consultantSeesCaseDetails("active"), "active consultants can see the shared case");
assert(/Upgrade to Pro/i.test(matchRequestBlockReason(freeMatch)), "free match copy must send people to Pro");
assert(presentation.hero.current_posture === "RFE notice needs review", "customer match requests must not convert the RFE fixture into open-options");

const familyForms = rankMatchingForms({
  inquiryMode: "open_options",
  themes: marriageInquiry.themes,
  sources: [knowledgeCatalog.find((item) => item.reference === "Form I-130")!],
  authorityQueries: ["I-130", "I-485"],
});
assert(familyForms[0]?.formNumber === "I-130", `family open-options must rank I-130 first, got ${familyForms[0]?.formNumber}`);
assert(familyForms.findIndex((item) => item.formNumber === "I-130") < familyForms.findIndex((item) => item.formNumber === "I-485"), "family open-options must rank I-130 before I-485");
const studentForms = rankMatchingForms({
  inquiryMode: "open_options",
  themes: studentInquiry.themes,
  authorityQueries: ["I-765", "I-485", "F-1"],
});
assert(studentForms[0]?.formNumber === "I-765", `F-1/student must rank I-765 first, got ${studentForms[0]?.formNumber}`);
assert(studentForms.findIndex((item) => item.formNumber === "I-765") < studentForms.findIndex((item) => item.formNumber === "I-485"), "student options must rank I-765 before I-485");
const asylumForms = rankMatchingForms({
  inquiryMode: "open_options",
  themes: ["asylum"],
  sources: [knowledgeCatalog.find((item) => item.reference === "Form I-589")!],
  authorityQueries: ["I-589", "I-485"],
});
assert(asylumForms[0]?.formNumber === "I-589", `asylum must rank I-589 first, got ${asylumForms[0]?.formNumber}`);
const rfeForms = rankMatchingForms({
  inquiryMode: "existing_case",
  themes: ["adjustment"],
  query: "I got an RFE from USCIS on my I-485 and the deadline is coming up.",
  authorityQueries: ["I-485", "I-130"],
});
assert(rfeForms[0]?.formNumber === "I-485", `existing I-485 RFE may rank I-485 first, got ${rfeForms[0]?.formNumber}`);
assert(matchingFormNumber({ inquiryMode: "open_options", themes: ["family"], authorityQueries: ["I-130", "I-485"] }) === "I-130", "matching form for family options is I-130");
assert(formActionKey("I-130") === "PREPARE_FORM", "non-I-485 matching forms use PREPARE_FORM");
assert(formActionKey("I-485") === "COMPLETE_FORM_I485", "I-485 keeps COMPLETE_FORM_I485");
assert(formNumberForStep({ actionKey: "COMPLETE_FORM_I485", title: "Review Form I-130" }) === "I-130", "stored I-485 actions must still start I-130 when the step names I-130");
assert(presentationStepCta("PREPARE_FORM", "case-1", "I-130")?.href === "/app/forms?form=I-130", "form CTA should deep-link the matching form");
assert(presentationStepCta("PREPARE_FORM", "case-1", "I-130")?.label === "Start Form I-130", "form CTA should name the matching form");
assert(presentationStepCta("COMPLETE_FORM_I485", "case-1", "I-130")?.href === "/app/forms?form=I-130", "legacy I-485 actions must not outrank a matching I-130");
const rankedCatalog = rankFormCatalog(
  [{ formNumber: "I-485" }, { formNumber: "I-130" }, { formNumber: "N-400" }],
  familyForms,
);
assert(rankedCatalog[0]?.formNumber === "I-130", "forms catalog must list I-130 before I-485 for family options");
const guestForms = resolveFormCatalogEntitlement({ isGuest: true });
const freeForms = resolveFormCatalogEntitlement({ planKey: "free", hasWizard: false });
const plusForms = resolveFormCatalogEntitlement({ planKey: "plus", hasWizard: true });
const proForms = resolveFormCatalogEntitlement({ planKey: "pro", hasWizard: true });
const staffForms = resolveFormCatalogEntitlement({ isStaff: true });
assert(guestForms.showRegisterCta && !guestForms.canStartWizard, "guests must sign in before the forms catalog");
assert(!freeForms.canStartWizard && freeForms.showUpgradeCta, "free matching forms stay locked until Plus");
assert(plusForms.canStartWizard && proForms.canStartWizard && staffForms.canStartWizard, "plus, pro, and staff can start the matching form wizard");
assert(DEFAULT_PROMPTS.presenter.includes("PREPARE_FORM"), "presenter prompt should emit PREPARE_FORM for non-I-485 matching forms");
const seededI130 = parseWizardSteps(JSON.stringify([
  { title: "Petitioner", questions: [
    { key: "petitioner_name", label: "Petitioner's full legal name", type: "text", required: true },
    { key: "petitioner_status", label: "Petitioner's immigration status", type: "select", required: true, options: ["U.S. citizen", "Lawful permanent resident"] },
  ]},
]));
assert(seededI130[0]?.fields[0]?.key === "petitioner_name", "seeded I-130 steps must parse into wizard fields");
assert(seededI130[0]?.fields[1]?.options?.[0]?.value === "U.S. citizen", "seeded select options must become value/label pairs");
assert(presentation.hero.current_posture === "RFE notice needs review", "goal-driven forms must not convert the RFE fixture into open-options");
assert(listFromOptions.posture === OPEN_OPTIONS_POSTURE, "goal-driven forms must keep the approved open-options posture");

const familyLetters = rankMatchingLetters({
  inquiryMode: "open_options",
  themes: marriageInquiry.themes,
  sources: [knowledgeCatalog.find((item) => item.reference === "Form I-130")!],
  authorityQueries: ["I-130", "I-485"],
});
assert(familyLetters[0]?.kind === "i130_cover", `family open-options must rank I-130 cover first, got ${familyLetters[0]?.kind}`);
assert(
  familyLetters.findIndex((item) => item.kind === "i130_cover") < familyLetters.findIndex((item) => item.kind === "rfe_response"),
  "family open-options must rank I-130 cover before RFE response",
);
const studentLetters = rankMatchingLetters({
  inquiryMode: "open_options",
  themes: studentInquiry.themes,
  authorityQueries: ["I-765", "I-485", "F-1"],
});
assert(studentLetters[0]?.kind === "i765_cover", `F-1/student must rank I-765 cover first, got ${studentLetters[0]?.kind}`);
const asylumLetters = rankMatchingLetters({
  inquiryMode: "open_options",
  themes: ["asylum"],
  sources: [knowledgeCatalog.find((item) => item.reference === "Form I-589")!],
  authorityQueries: ["I-589", "I-485"],
});
assert(asylumLetters[0]?.kind === "i589_cover", `asylum must rank I-589 cover first, got ${asylumLetters[0]?.kind}`);
const rfeLetters = rankMatchingLetters({
  inquiryMode: "existing_case",
  themes: ["adjustment"],
  query: "I got an RFE from USCIS on my I-485 and the deadline is coming up.",
  authorityQueries: ["I-485", "I-130"],
  noticeTypes: ["RFE"],
});
assert(rfeLetters[0]?.kind === "rfe_response", `existing I-485 RFE must rank RFE response first, got ${rfeLetters[0]?.kind}`);
assert(matchingLetterKind({ inquiryMode: "open_options", themes: ["family"], authorityQueries: ["I-130", "I-485"] }) === "i130_cover", "matching letter for family options is I-130 cover");
const i130Fallback = fallbackLetterDraft("i130_cover", "I am preparing Form I-130 for my spouse and have not filed yet.");
assert(!/Receipt No/i.test(i130Fallback), "I-130 cover fallback must not include a receipt number");
assert(!/\bMSC\d{10}\b|\bWAC\d{10}\b/.test(i130Fallback), "I-130 cover fallback must not invent a receipt number");
assert(/Form I-130/i.test(i130Fallback), "I-130 cover fallback should name Form I-130");
const guardedCover = guardLetterDraftWithEvidence(i130Fallback, { supportedText: "FORM I-130" });
assert(/Form I-130/i.test(guardedCover.text), "letter guard should keep the matching I-130 cover form");
assert(!/Receipt No/i.test(guardedCover.text), "I-130 cover must still omit a receipt after the evidence guard");
const rfeFallback = fallbackLetterDraft("rfe_response", "I am responding to the RFE.");
assert(/Receipt No/i.test(rfeFallback), "RFE response fallback may include a receipt placeholder");
assert(letterKindForStep({ actionKey: "DRAFT_LETTER", title: "Respond to the RFE", matchingLetter: "i130_cover" }) === "rfe_response", "stored letter steps that name an RFE stay RFE responses");
assert(letterKindForStep({ actionKey: "DRAFT_LETTER", title: "Draft a letter", matchingLetter: "i130_cover" }) === "i130_cover", "generic letter steps use the matching cover kind");
assert(letterComposerHref({ caseId: "case-1", kind: "i130_cover" }) === "/app/letters/new?case=case-1&kind=i130_cover", "composer href should include the matching kind");
assert(letterStartLabel("rfe_response") === "Draft RFE response", "RFE letter CTA should say Draft RFE response");
const rankedLetterCatalog = rankLetterCatalog(
  [{ kind: "rfe_response" }, { kind: "i130_cover" }, { kind: "notice_response" }],
  familyLetters,
);
assert(rankedLetterCatalog[0]?.kind === "i130_cover", "letters catalog must list I-130 cover before RFE for family options");
const guestLetters = resolveLetterCatalogEntitlement({ isGuest: true });
const freeLetters = resolveLetterCatalogEntitlement({ planKey: "free", hasLetters: false });
const plusLetters = resolveLetterCatalogEntitlement({ planKey: "plus", hasLetters: true });
const proLetters = resolveLetterCatalogEntitlement({ planKey: "pro", hasLetters: true });
const staffLetters = resolveLetterCatalogEntitlement({ isStaff: true });
assert(guestLetters.showRegisterCta && !guestLetters.canGenerate, "guests must sign in before the letters catalog");
assert(!freeLetters.canGenerate && freeLetters.showUpgradeCta, "free matching letters stay locked until Plus");
assert(plusLetters.canGenerate && proLetters.canGenerate && staffLetters.canGenerate, "plus, pro, and staff can generate the matching letter");
assert(!letterGenerationAllowed({ canGenerate: false, used: 0, limit: 0 }).allowed, "free cannot generate letters");
assert(letterGenerationAllowed({ canGenerate: true, used: 2, limit: 3 }).allowed, "plus can generate while under the 3-letter limit");
assert(letterGenerationAllowed({ canGenerate: true, used: 3, limit: 3 }).overLimit, "plus must stop at 3 letters");
assert(letterGenerationAllowed({ canGenerate: true, used: 10, limit: null }).allowed, "pro letters stay unlimited");
assert(!marriageOptions.pathSteps.some((step) => step.action_key === "COMPLETE_FORM_I485"), "goal-driven letters must not jump family options to I-485");
assert(/Form I-130/i.test(marriageOptions.pathSteps.find((step) => step.action_key === "PREPARE_FORM")?.title ?? ""), "marriage path still prepares Form I-130");
assert(presentation.hero.current_posture === "RFE notice needs review", "goal-driven letters must not convert the RFE fixture into open-options");
assert(listFromOptions.posture === OPEN_OPTIONS_POSTURE, "goal-driven letters must keep the approved open-options posture");
assert(requested.autoAssigned === false, "goal-driven letters must not auto-assign consultants");

const familyDocs = rankMatchingDocuments({
  inquiryMode: "open_options",
  themes: marriageInquiry.themes,
  sources: [knowledgeCatalog.find((item) => item.reference === "Form I-130")!],
  authorityQueries: ["I-130", "I-485"],
});
assert(familyDocs[0]?.kind === "identity", `family open-options must rank identity first, got ${familyDocs[0]?.kind}`);
assert(
  familyDocs.findIndex((item) => item.kind === "identity") < familyDocs.findIndex((item) => item.kind === "receipt"),
  "family open-options must rank identity before a USCIS receipt",
);
assert(
  familyDocs.findIndex((item) => item.kind === "relationship") < familyDocs.findIndex((item) => item.kind === "rfe"),
  "family open-options must rank relationship evidence before an RFE",
);
const studentDocs = rankMatchingDocuments({
  inquiryMode: "open_options",
  themes: studentInquiry.themes,
  authorityQueries: ["I-765", "I-485", "F-1"],
});
assert(studentDocs[0]?.kind === "identity", `F-1/student must rank identity first, got ${studentDocs[0]?.kind}`);
assert(
  studentDocs.findIndex((item) => item.kind === "status_record") < studentDocs.findIndex((item) => item.kind === "receipt"),
  "student options must rank an I-20/status record before a receipt",
);
const asylumDocs = rankMatchingDocuments({
  inquiryMode: "open_options",
  themes: ["asylum"],
  sources: [knowledgeCatalog.find((item) => item.reference === "Form I-589")!],
  authorityQueries: ["I-589", "I-485"],
});
assert(asylumDocs[0]?.kind === "identity", `asylum must rank identity first, got ${asylumDocs[0]?.kind}`);
assert(
  asylumDocs.findIndex((item) => item.kind === "declaration") < asylumDocs.findIndex((item) => item.kind === "case_record"),
  "asylum must rank a declaration before a case record",
);
const rfeDocs = rankMatchingDocuments({
  inquiryMode: "existing_case",
  themes: ["adjustment"],
  query: "I got an RFE from USCIS on my I-485 and the deadline is coming up.",
  authorityQueries: ["I-485", "I-130"],
  noticeTypes: ["RFE"],
});
assert(rfeDocs[0]?.kind === "rfe", `existing I-485 RFE must rank the RFE first, got ${rfeDocs[0]?.kind}`);
assert(matchingDocumentKind({ inquiryMode: "open_options", themes: ["family"], authorityQueries: ["I-130", "I-485"] }) === "identity", "matching document for family options is identity");
assert(documentKindFromEvidenceItem("identity documents and a bona fide marriage") === "identity", "official I-130 evidence items map to identity");
assert(documentKindFromEvidenceItem("relationship documents for the spouse") === "relationship", "official relationship evidence maps to relationship");
const rankedDocCatalog = rankDocumentCatalog(
  [{ kind: "receipt" }, { kind: "identity" }, { kind: "rfe" }],
  familyDocs,
);
assert(rankedDocCatalog[0]?.kind === "identity", "document catalog must list identity before a receipt for family options");
assert(!neededDocumentsFromRanked(familyDocs).some((item) => ["receipt", "rfe", "case_record", "notice", "approval"].includes(item.kind)), "open-options needed docs must not require a filed-case notice");
assert(neededDocumentsFromRanked(rfeDocs)[0]?.kind === "rfe", "RFE needed docs still start with the RFE");
const guestDocs = resolveDocumentCatalogEntitlement({ isGuest: true });
const freeDocs = resolveDocumentCatalogEntitlement({ planKey: "free", hasUpload: true });
const plusDocs = resolveDocumentCatalogEntitlement({ planKey: "plus", hasUpload: true });
const proDocs = resolveDocumentCatalogEntitlement({ planKey: "pro", hasUpload: true });
const staffDocs = resolveDocumentCatalogEntitlement({ isStaff: true });
assert(guestDocs.showRegisterCta && !guestDocs.canUpload, "guests must sign in before the document vault");
assert(freeDocs.canUpload && plusDocs.canUpload && proDocs.canUpload && staffDocs.canUpload, "free, plus, pro, and staff can upload matching documents");
assert(documentUploadAllowed({ canUpload: true, used: 4, limit: 5 }).allowed, "free can upload while under the 5-document limit");
assert(documentUploadAllowed({ canUpload: true, used: 5, limit: 5 }).overLimit, "free must stop at 5 documents");
assert(documentUploadAllowed({ canUpload: true, used: 4, incoming: 2, limit: 5 }).overLimit, "free must reject a batch that would exceed 5 documents");
assert(documentUploadAllowed({ canUpload: true, used: 20, limit: null }).allowed, "plus/pro documents stay unlimited");
assert(!marriageOptions.pathSteps.some((step) => step.action_key === "GET_CASE_RECORD"), "goal-driven documents must not require a USCIS case record for family options");
assert(/Form I-130/i.test(marriageOptions.pathSteps.find((step) => step.action_key === "PREPARE_FORM")?.title ?? ""), "marriage path still prepares Form I-130");
assert(presentation.hero.current_posture === "RFE notice needs review", "goal-driven documents must not convert the RFE fixture into open-options");
assert(listFromOptions.posture === OPEN_OPTIONS_POSTURE, "goal-driven documents must keep the approved open-options posture");
assert(requested.autoAssigned === false, "goal-driven documents must not auto-assign consultants");

const openNoticeCopy = resolveNoticePageCopy({
  inquiryMode: "open_options",
  themes: marriageInquiry.themes,
  authorityQueries: ["I-130", "I-485"],
});
assert(!openNoticeCopy.uploadPrimary, "family open-options must not treat a USCIS letter as the primary next step");
assert(/skip/i.test(openNoticeCopy.skipBanner ?? "") || /skip/i.test(openNoticeCopy.pageSubtitle), "open-options notices copy must say to skip a letter they do not have");
assert(!/I-797 receipt/i.test(openNoticeCopy.pageSubtitle) || /not an I-797/i.test(openNoticeCopy.pageSubtitle), "open-options notices copy must not chase an I-797");
assert(openNoticeCopy.primaryCta.href.includes("/app/documents"), "open-options notice page should send people to matching documents");
const rfeNoticeCopy = resolveNoticePageCopy({
  inquiryMode: "existing_case",
  themes: ["adjustment"],
  query: "I got an RFE from USCIS on my I-485",
  noticeTypes: ["RFE"],
  hasNotices: true,
});
assert(rfeNoticeCopy.uploadPrimary, "existing I-485 RFE must keep notice upload as primary");
assert(/RFE/i.test(rfeNoticeCopy.pageSubtitle) || /RFE/i.test(rfeNoticeCopy.emptyBody), "RFE notice page still names the RFE");
const openDeadlineCopy = resolveDeadlinesPageCopy({ inquiryMode: "open_options", themes: marriageInquiry.themes });
assert(!shouldExpectAutomaticDeadlines({ inquiryMode: "open_options", themes: marriageInquiry.themes }), "open-options must not expect an invented notice deadline");
assert(!/respond-by date on a notice/i.test(openDeadlineCopy.emptyBody), "open-options deadline empty state must not wait for a notice date");
assert(/do not invent/i.test(openDeadlineCopy.emptyBody), "open-options deadlines must say no RFE date is invented");
const rfeDeadlineCopy = resolveDeadlinesPageCopy({ inquiryMode: "existing_case", noticeTypes: ["RFE"], hasNotices: true });
assert(shouldExpectAutomaticDeadlines({ inquiryMode: "existing_case", noticeTypes: ["RFE"] }), "RFE cases still expect notice deadlines");
assert(/RFE|notice/i.test(rfeDeadlineCopy.emptyBody), "RFE deadline empty state still mentions the notice");
assert(!shouldShowUscisAccountGuide({ inquiryMode: "open_options", themes: marriageInquiry.themes }), "open-options must not push the USCIS account guide as required");
assert(shouldShowUscisAccountGuide({ inquiryMode: "existing_case", noticeTypes: ["RFE"] }), "existing RFE may still use the USCIS account guide");
const openAccount = resolveUscisAccountCopy({ inquiryMode: "open_options", themes: marriageInquiry.themes });
assert(Boolean(openAccount.optionalBanner), "open-options USCIS account page must mark the guide as optional");
assert(!openAccount.showGuidePrimary, "open-options must not lead with my.uscis.gov");
assert(/have not filed|already filed/i.test(`${openAccount.pageSubtitle} ${openAccount.intro}`), "USCIS account copy for options must say this is for a filed case");
const rfeAccount = resolveUscisAccountCopy({ inquiryMode: "existing_case", noticeTypes: ["RFE"] });
assert(rfeAccount.showGuidePrimary && !rfeAccount.optionalBanner, "RFE USCIS account guide stays the filed-case walkthrough");
assert(isFiledCaseSurface({ hasNotices: true, inquiryMode: "open_options" }) === false, "a leftover notice on another case must not convert family options into a filed-case surface");
assert(isFiledCaseSurface({ inquiryMode: "existing_case", noticeTypes: ["RFE"] }), "an RFE is a filed-case surface");
const guestNotices = resolveNoticeEntitlement({ isGuest: true });
const freeNotices = resolveNoticeEntitlement({ planKey: "free", hasUpload: true });
assert(guestNotices.showRegisterCta && !guestNotices.canUpload, "guests must sign in before notice explanations");
assert(freeNotices.canUpload, "free can explain notices under the plan cap");
assert(noticeUploadAllowed({ canUpload: true, used: 1, limit: 2 }).allowed, "free can explain a notice while under the 2-notice limit");
assert(noticeUploadAllowed({ canUpload: true, used: 2, limit: 2 }).overLimit, "free must stop at 2 notice explanations");
assert(noticeUploadAllowed({ canUpload: true, used: 8, limit: null }).allowed, "plus/pro notices stay unlimited");
const openDash = resolveDashboardFiledCopy({ inquiryMode: "open_options", themes: marriageInquiry.themes, authorityQueries: ["I-130"] });
assert(!/from notices and analyses appear here automatically/i.test(openDash.deadlinesEmptyBody), "dashboard must not tell options customers that notice dates will appear");
assert(/I-130|identity|matching/i.test(openDash.matchingCta.label + openDash.matchingCta.href), "dashboard matching CTA for family options is the form or evidence, not a receipt");
assert(presentationStepCta("UPLOAD_NOTICE", "case-1", null, null, { inquiryMode: "open_options", matchingDocumentKind: "identity" })?.href === "/app/documents?kind=identity", "open-options notice actions should send people to matching documents");
assert(presentationStepCta("GET_CASE_RECORD", "case-1", null, null, { inquiryMode: "open_options", matchingDocumentKind: "identity" })?.href === "/app/documents?kind=identity", "open-options must not send GET_CASE_RECORD to a receipt hunt");
assert(presentationStepCta("UPLOAD_NOTICE", "case-1", null, null, { inquiryMode: "existing_case", noticeTypes: ["RFE"] })?.href === "/app/notices?case=case-1", "existing RFE notice actions stay on the notices page");
assert(!marriageOptions.pathSteps.some((step) => step.action_key === "GET_CASE_RECORD"), "goal-driven notices must not require a USCIS case record for family options");
assert(!marriageOptions.pathSteps.some((step) => step.action_key === "UPLOAD_NOTICE"), "goal-driven notices must not require a USCIS letter for family options");
assert(/Form I-130/i.test(marriageOptions.pathSteps.find((step) => step.action_key === "PREPARE_FORM")?.title ?? ""), "marriage path still prepares Form I-130");
assert(presentation.hero.current_posture === "RFE notice needs review", "goal-driven notices must not convert the RFE fixture into open-options");
assert(listFromOptions.posture === OPEN_OPTIONS_POSTURE, "goal-driven notices must keep the approved open-options posture");
assert(requested.autoAssigned === false, "goal-driven notices must not auto-assign consultants");

assert(PUBLIC_HOME_FEATURES[0]?.title === "Pathway exploration", "public homepage must lead with pathway exploration");
assert(
  PUBLIC_HOME_FEATURES.findIndex((item) => item.title === "Pathway exploration")
    < PUBLIC_HOME_FEATURES.findIndex((item) => item.title === "Notice intelligence"),
  "notice intelligence must not lead the public feature list",
);
assert(PUBLIC_HERO_CAROUSEL.cards[0]?.title.includes("I-130"), "hero mock must show I-130 before a receipt");
assert(!/I-797C receipt/i.test(PUBLIC_HERO_CAROUSEL.cards[0]?.title ?? ""), "hero mock must not lead with an I-797C receipt");
assert(/identity/i.test(PUBLIC_HERO_CAROUSEL.cards[1]?.title ?? ""), "hero mock must show identity documents before a filed-case receipt");
assert(/No USCIS receipt required/i.test(PUBLIC_HERO_CAROUSEL.checklistMeta), "hero chip must not invent a receipt");
assert(publicCopyLeadsWithOptions(`${PUBLIC_HERO.title} ${PUBLIC_HERO.subtitle}`), "public hero copy must lead with options, not an I-797");
assert(PUBLIC_HERO.primaryCta.label !== "Start a case review", "primary CTA must not sell a filed-case review");
assert(PUBLIC_HERO.primaryCta.href.includes("intent=options"), "primary CTA must open the options intake");
assert(PUBLIC_HERO.letterLink.href.includes("intent=letter"), "letter link must open the filed-letter intake");
assert(PUBLIC_CLOSING.optionsCta.href.includes("intent=options") && PUBLIC_CLOSING.letterCta.href.includes("intent=letter"), "closing CTA must split options and letter paths");
assert(!/^Have a USCIS notice/i.test(PUBLIC_CLOSING.title), "closing CTA must not be notice-only");
assert(/have not filed yet/i.test(PUBLIC_PRICING_INTRO) && /USCIS letter/i.test(PUBLIC_PRICING_INTRO), "pricing intro must cover no filing yet and an existing letter");
assert(/without a filing/i.test(PUBLIC_BILLING_SUBTITLE) && /USCIS letter/i.test(PUBLIC_BILLING_SUBTITLE), "billing intro must cover both public paths");
assert(/before you file/i.test(PUBLIC_PLAN_DESCRIPTIONS.free), "free plan copy must mention exploring before filing");
assert(/have not filed yet/i.test(PUBLIC_PLAN_DESCRIPTIONS.plus) && /USCIS letter/i.test(PUBLIC_PLAN_DESCRIPTIONS.plus), "plus plan copy must cover both paths");
assert(PUBLIC_FEATURE_SORT_ORDER["case.analysis"] < PUBLIC_FEATURE_SORT_ORDER["notice.upload"], "analysis must sort before notice upload");
assert(PUBLIC_FEATURE_SORT_ORDER["documents.upload"] < PUBLIC_FEATURE_SORT_ORDER["notice.upload"], "documents must sort before notice upload");
assert(PUBLIC_FEATURE_SORT_ORDER["forms.wizard"] < PUBLIC_FEATURE_SORT_ORDER["notice.upload"], "forms must sort before notice upload");
assert(PUBLIC_FEATURE_SORT_ORDER["qa.chat"] < PUBLIC_FEATURE_SORT_ORDER["notice.upload"], "Q&A must sort before notice upload");
assert(featuresRankedBeforeNotices()[0] === "case.analysis", "customer feature catalog must open with case analysis");
assert(/Do I need a USCIS receipt to start/i.test(PUBLIC_FAQ_BODY), "FAQ must say a receipt is not required to start");
assert(!/Q: How do I check my USCIS case\?/.test(PUBLIC_FAQ_BODY), "FAQ must not lead with receipt-status as the second question");
assert(/no filing yet/i.test(PUBLIC_HOW_IT_WORKS_PAGE), "how-it-works must include the no-filing path");
assert(/notices, receipts, and RFEs only when USCIS has already sent them/i.test(PUBLIC_HOW_IT_WORKS_PAGE), "how-it-works must keep notices secondary");
const staleHero = resolvePublicHero({
  "home.hero_title": "Turn immigration paperwork into a clear case plan",
  "home.hero_subtitle": STALE_PUBLIC_HERO_SUBTITLES[0],
  "home.cta_primary": "Start a case review",
  "app.tagline": "Immigration paperwork, organized",
});
assert(/options/i.test(staleHero.title), "stale filed-case hero titles must be replaced");
assert(staleHero.primaryCta.label === "Explore my options", "stale Start a case review CTA must be replaced");
assert(staleHero.tagline === PUBLIC_HERO.tagline, "stale paperwork-only tagline must be replaced");
const customHero = resolvePublicHero({ "home.hero_title": "Custom admin title for families" });
assert(customHero.title === "Custom admin title for families", "admin-customized hero titles must still win");
assert(parsePublicStartIntent("letter") === "letter" && parsePublicStartIntent("options") === "options", "public start intents parse");
const optionsStart = resolvePublicStartCopy("options");
assert(/no USCIS filing yet/i.test(optionsStart.subtitle), "options intake must say no filing is fine");
assert(/have not filed anything yet/i.test(optionsStart.situationPlaceholder), "options placeholder must not require a notice");
const letterStart = resolvePublicStartCopy("letter");
assert(/USCIS letter/i.test(letterStart.title), "letter intake must name the USCIS letter");
assert(/RFE/i.test(letterStart.situationPlaceholder), "letter intake still accepts an RFE");
const homeSrc = readFileSync(join(process.cwd(), "src/app/page.tsx"), "utf8");
assert(homeSrc.includes("resolvePublicHero") && homeSrc.includes("PUBLIC_CLOSING"), "homepage must render the dual-path public funnel");
assert(!homeSrc.includes("Start a case review"), "homepage source must not keep the filed-case primary CTA");
assert(!homeSrc.includes("Have a USCIS notice you do not want to"), "homepage source must not keep the notice-only closing CTA");
const heroSrc = readFileSync(join(process.cwd(), "src/components/hero-carousel.tsx"), "utf8");
assert(heroSrc.includes("PUBLIC_HERO_CAROUSEL"), "hero carousel must use the options-first mock");
assert(!heroSrc.includes("I-797C receipt") && !heroSrc.includes("USCIS receipt found"), "hero carousel must not invent a receipt-first story");
const seedSrc = readFileSync(join(process.cwd(), "prisma/seed.ts"), "utf8");
assert(seedSrc.includes("PUBLIC_FEATURE_SORT_ORDER") && seedSrc.includes("PUBLIC_FAQ_BODY"), "seed must apply the dual-path public catalog and FAQ");
assert(familyForms[0]?.formNumber === "I-130", "public funnel must not rerank I-485 ahead of I-130");
assert(presentation.hero.current_posture === "RFE notice needs review", "public funnel must not convert the RFE fixture into open-options");
assert(requested.autoAssigned === false, "public funnel must not auto-assign consultants");
assert(!/receipt number detected/i.test(PUBLIC_HERO_CAROUSEL.cards.map((card) => card.body).join(" ")), "hero cards must not invent a detected receipt number");

const optionsReadinessPolicy = resolveReadinessPolicy({
  inquiryMode: "open_options",
  themes: marriageInquiry.themes,
  authorityQueries: ["I-130", "I-485"],
  documentsExpected: 3,
});
assert(optionsReadinessPolicy.documentsExpected === 2, `family options expected matching docs must be 2, got ${optionsReadinessPolicy.documentsExpected}`);
assert(!optionsReadinessPolicy.coreKeys.includes("receipt_number"), "family options readiness must not require a receipt number");
assert(optionsReadinessPolicy.coreKeys.includes("identity"), "family options readiness must score identity evidence");
assert(optionsReadinessPolicy.coreKeys.includes("matching_form") || optionsReadinessPolicy.coreKeys[0] === "matching_form", "family options readiness must credit the matching I-130 path");
const optionsEmptyReadiness = computeEvidenceReadinessSplit({
  documentsCount: 0,
  documentsExpected: 3,
  extractedDocumentsCount: 0,
  needsReviewDocumentsCount: 0,
  reconciled: {
    audit: { status: "needs_more_evidence", summary: "", blockingUnknowns: ["identity_documents"], warnings: [] },
    facts: [],
    unknowns: [
      { key: "identity_documents", question: "identity?", reason: "official material" },
      { key: "location", question: "location?", reason: "official material" },
      { key: "receipt_number", question: "receipt?", reason: "identifier" },
    ],
    conflicts: [],
  },
  policy: optionsReadinessPolicy,
});
assert(optionsEmptyReadiness.evidenceAvailableScore === 0, "options with no matching docs must show 0% provided");
assert(optionsEmptyReadiness.actionReadinessScore >= 30, `options next-step readiness must not be tanked by official follow-ups, got ${optionsEmptyReadiness.actionReadinessScore}`);
assert(optionsEmptyReadiness.actionReadinessScore < 100, "options with no matching docs must not look like a complete filed case");
const optionsIdentityPolicy = resolveReadinessPolicy({
  inquiryMode: "open_options",
  themes: marriageInquiry.themes,
  authorityQueries: ["I-130", "I-485"],
  documentsExpected: 3,
  haveKinds: ["identity"],
});
const optionsIdentityReadiness = computeEvidenceReadinessSplit({
  documentsCount: 1,
  documentsExpected: 3,
  extractedDocumentsCount: 1,
  needsReviewDocumentsCount: 0,
  reconciled: {
    audit: { status: "needs_more_evidence", summary: "", blockingUnknowns: [], warnings: [] },
    facts: [],
    unknowns: [{ key: "relationship", question: "relationship?", reason: "official material" }],
    conflicts: [],
  },
  policy: optionsIdentityPolicy,
});
assert(optionsIdentityReadiness.evidenceAvailableScore === 50, `one of two matching docs must be 50%, got ${optionsIdentityReadiness.evidenceAvailableScore}`);
assert(optionsIdentityReadiness.actionReadinessScore > optionsEmptyReadiness.actionReadinessScore, "uploading identity must raise options next-step readiness");
const filedReadinessCopy = resolveReadinessCopy({ inquiryMode: "existing_case", noticeTypes: ["RFE"] });
const optionsReadinessCopy = resolveReadinessCopy({ inquiryMode: "open_options", themes: ["family"] });
assert(filedReadinessCopy.overallLabel === "Case readiness", "filed cases keep Case readiness");
assert(optionsReadinessCopy.overallLabel === "Options progress", "open-options must not be labeled Case readiness");
assert(/not from a receipt you do not have/i.test(optionsReadinessCopy.overallHint), "options progress hint must say a receipt is not required");
assert(filedReadinessCopy.actionLabel === "Action readiness", "filed split keeps Action readiness");
assert(optionsReadinessCopy.actionLabel === "Next-step readiness", "options split uses Next-step readiness");
assert(readiness.actionReadinessScore === 100, "goal-driven readiness must not lower the RFE fixture action score");
const presentationSrc = readFileSync(join(process.cwd(), "src/components/case-presentation-view.tsx"), "utf8");
assert(presentationSrc.includes("resolveReadinessCopy"), "case presentation must use goal-driven readiness labels");
assert(familyForms[0]?.formNumber === "I-130", "goal-driven readiness must not rerank I-485 ahead of I-130");
assert(presentation.hero.current_posture === "RFE notice needs review", "goal-driven readiness must not convert the RFE fixture into open-options");
assert(listFromOptions.posture === OPEN_OPTIONS_POSTURE, "goal-driven readiness must keep the approved open-options posture");
assert(requested.autoAssigned === false, "goal-driven readiness must not auto-assign consultants");

const familyGuideInput = {
  inquiryMode: "open_options" as const,
  themes: marriageInquiry.themes,
  authorityQueries: ["I-130", "I-485"],
  caseId: "case-options",
  actionKey: "GET_CASE_RECORD",
  actionTitle: "Get the USCIS case record",
};
const familyNoticeGuideInput = { ...familyGuideInput, actionKey: "UPLOAD_NOTICE", actionTitle: "Upload the USCIS notice" };
const familyFormGuideInput = { ...familyGuideInput, actionKey: "COMPLETE_FORM_I485", actionTitle: "Complete Form I-485" };
const rfeGuideInput = {
  inquiryMode: "existing_case" as const,
  noticeTypes: ["RFE"],
  hasNotices: true,
  caseId: "case-rfe",
  actionKey: "UPLOAD_NOTICE",
  actionTitle: "Upload the RFE",
  query: "I got an RFE from USCIS",
};
const openRecordTip = guideTipForStep("GET_CASE_RECORD", familyGuideInput) ?? "";
const openAccountTip = guideTipForStep("GET_ACCOUNT_RECORD", familyGuideInput) ?? "";
const openNoticeTip = guideTipForStep("UPLOAD_NOTICE", familyNoticeGuideInput) ?? "";
const openFormTip = guideTipForStep("COMPLETE_FORM_I485", familyFormGuideInput) ?? "";
const rfeNoticeTip = guideTipForStep("UPLOAD_NOTICE", rfeGuideInput) ?? "";
assert(/identity/i.test(openRecordTip) && /I-130/.test(openRecordTip), "open-options GET_CASE_RECORD must coach identity and I-130");
assert(!/sign in at my\.uscis\.gov/i.test(openRecordTip), "open-options GET_CASE_RECORD must not send people to my.uscis.gov");
assert(/Skip my\.uscis\.gov/i.test(openAccountTip), "open-options GET_ACCOUNT_RECORD must skip the USCIS account hunt");
assert(/identity/i.test(openNoticeTip) && !/upload the USCIS notice/i.test(openNoticeTip), "open-options UPLOAD_NOTICE must remap to matching documents");
assert(/Form I-130/.test(openFormTip) && !/Form I-485/.test(openFormTip), "open-options must not coach Form I-485 ahead of I-130");
assert(/\bRFE\b/.test(rfeNoticeTip), "filed RFE UPLOAD_NOTICE must still name the RFE");
assert(shouldChaseNoticeInGuide("Where is my receipt status?", rfeGuideInput) === true, "filed cases may still chase a receipt in the guide");
assert(shouldChaseNoticeInGuide("Where is my receipt status?", familyGuideInput) === false, "open-options must not chase a receipt in the guide");
const openReceiptFallback = guideFallbackCopy(familyGuideInput, "What is my receipt status?");
assert(!/upload the USCIS notice/i.test(openReceiptFallback), "open-options receipt questions must not tell people to upload a notice");
assert(/no USCIS receipt/i.test(openReceiptFallback) || /open-options/i.test(openReceiptFallback), "open-options receipt questions must say there is no receipt to chase");
assert(/upload the USCIS notice or receipt number/i.test(guideStatusHint("What is my RFE deadline?", rfeGuideInput)), "RFE status questions still ask for the notice");
assert(/no receipt required/i.test(guideWidgetChrome(familyGuideInput).subtitle), "open-options widget chrome must not be notice-only");
assert(guideWidgetChrome(familyGuideInput).title === "Your options guide", "open-options widget title must be options-aware");
assert(guideWidgetChrome(rfeGuideInput).title === "Your case guide", "filed RFE widget title stays case guide");
assert(/receipt is not required/i.test(guideOpeningCloser(familyGuideInput)), "open-options opening must not say stick with a filed-case plan");
assert(/stick with the plan/i.test(guideOpeningCloser(rfeGuideInput)), "filed opening may still keep people on the case plan");
assert(/exploring options before a filing/i.test(guideUpgradeCopy("Free")) && /USCIS letter/i.test(guideUpgradeCopy("Free")), "paid-gate copy must cover options and a letter");
assert(!/fastest way to get your immigration situation resolved/i.test(guideUpgradeCopy("Free")), "paid-gate copy must not be filed-case only");
assert(guidePrimaryAction(familyGuideInput).href === "/app/documents?kind=identity", "open-options guide CTA must go to matching documents");
assert(guidePrimaryAction(rfeGuideInput).href === "/app/notices?case=case-rfe", "RFE guide CTA must stay on the notices page");
const openNoStep = { inquiryMode: "open_options" as const, themes: marriageInquiry.themes, authorityQueries: ["I-130", "I-485"], caseId: "case-options" };
assert(/identity/i.test(guideTipForStep(guideDefaultActionKey(openNoStep), { ...openNoStep, actionKey: guideDefaultActionKey(openNoStep) }) ?? ""), "an open-options case with no current step must still coach matching documents");
assert(!/haven't started a case/i.test(guideFallbackCopy(openNoStep, "What is my receipt status?")), "an existing open-options case must not be told to start a new case");
assert(guidePrimaryAction(openNoStep).href === "/app/documents?kind=identity", "open-options with no current step still links matching documents");
const openSnapshot = formatGuideSnapshot(familyGuideInput).join("\n");
assert(/Situation: open_options/.test(openSnapshot), "guide snapshot must label open-options");
assert(/Do not invent a receipt number/i.test(openSnapshot), "guide snapshot must forbid inventing a receipt");
assert(/Matching form: I-130/.test(openSnapshot), "guide snapshot must name I-130 as the matching form");
assert(/Situation: existing_case/.test(formatGuideSnapshot(rfeGuideInput).join("\n")), "RFE snapshot must stay a filed case");
assert(DEFAULT_PROMPTS.guide.includes("open_options"), "guide prompt must lead with the options path");
assert(DEFAULT_PROMPTS.guide.includes("Do not invent receipt numbers"), "guide prompt must not invent a receipt");
assert(DEFAULT_PROMPTS.guide.includes("current evidence position"), "guide prompt should mention current evidence position");
assert(DEFAULT_PROMPTS.guide.includes("approved posture"), "guide prompt should mention approved posture");
assert(PROMPT_SUPERSEDES.guide.includes("1ad42c5a17fcfbe5b4506f5d50c9b7ece880eb42da2dcaa74f8f6d2d0d1e10a1"), "seed must supersede the notice-first guide prompt");
const guideSrc = readFileSync(join(process.cwd(), "src/lib/guide.ts"), "utf8");
assert(guideSrc.includes("formatGuideSnapshot") && guideSrc.includes("guideTipForStep"), "guide runtime must use goal-driven tips and snapshot");
assert(!guideSrc.includes("Sign in at my.uscis.gov and collect the receipt number"), "guide runtime must not hardcode a receipt hunt for every step");
const widgetSrc = readFileSync(join(process.cwd(), "src/components/guide-widget.tsx"), "utf8");
assert(widgetSrc.includes("guideWidgetChrome") || widgetSrc.includes("GUIDE_WIDGET_CHROME_DEFAULT"), "guide widget must use goal-driven chrome");
assert(!widgetSrc.includes("Always watching your next step"), "guide widget must not hardcode filed-case chrome");
const seedGuideSrc = readFileSync(join(process.cwd(), "prisma/seed.ts"), "utf8");
assert(seedGuideSrc.includes("Personal immigration guide chatbot"), "seed must rename the guide feature off case-only copy");
assert(familyForms[0]?.formNumber === "I-130", "goal-driven guide must not rerank I-485 ahead of I-130");
assert(presentation.hero.current_posture === "RFE notice needs review", "goal-driven guide must not convert the RFE fixture into open-options");
assert(listFromOptions.posture === OPEN_OPTIONS_POSTURE, "goal-driven guide must keep the approved open-options posture");
assert(requested.autoAssigned === false, "goal-driven guide must not auto-assign consultants");
assert(!/receipt number detected/i.test(openRecordTip + openNoticeTip + DEFAULT_PROMPTS.guide), "guide copy must not invent a detected receipt number");

const openNav = resolveAccountNav(familyGuideInput);
const rfeNav = resolveAccountNav(rfeGuideInput);
assert(navHrefsBefore(openNav, "/app/notices").includes("/app/documents"), "open-options nav must list documents before notices");
assert(navHrefsBefore(openNav, "/app/notices").includes("/app/forms"), "open-options nav must list forms before notices");
assert(openNav.find((item) => item.href === "/app/notices")?.optional === true, "open-options notices nav is optional");
assert(openNav.find((item) => item.href === "/app/uscis-account")?.label.includes("optional"), "open-options USCIS account nav is optional");
assert(navHrefsBefore(rfeNav, "/app/documents").includes("/app/notices"), "filed RFE nav still lists notices before documents");
assert(rfeNav.find((item) => item.href === "/app/notices")?.optional === false, "filed RFE notices nav is not optional");
const openChrome = resolveCaseChrome({ ...familyGuideInput, caseId: "case-options", hasReportAccess: true });
const rfeChrome = resolveCaseChrome({ ...rfeGuideInput, caseId: "case-rfe", hasReportAccess: true });
assert(openChrome.evidenceHref === "/app/documents?kind=identity", "open-options case actions must not send people to Upload notice");
assert(/identity/i.test(openChrome.evidenceLabel), "open-options case action must name matching identity documents");
assert(rfeChrome.evidenceHref === "/app/notices?case=case-rfe", "RFE case actions stay on the notices page");
assert(rfeChrome.evidenceLabel === "Upload the USCIS notice", "RFE case actions still upload the notice");
assert(openChrome.reportTitle === "Options report", "open-options download is an Options report");
assert(rfeChrome.reportTitle === "Case report", "filed RFE download stays a Case report");
assert(resolveReportChrome(familyGuideInput).heading === "Options Report", "open-options printable heading is Options Report");
assert(/receipt is not required/i.test(resolveReportChrome(familyGuideInput).footerVerify), "options report footer must not require a receipt");
assert(resolveReportChrome(rfeGuideInput).heading === "Case Report", "RFE printable heading stays Case Report");
assert(reportFileName("ImmigrationOnMe", "IMM-1", familyGuideInput).includes("options-report"), "options report filename must not be case-report");
assert(reportFileName("ImmigrationOnMe", "IMM-1", rfeGuideInput).includes("case-report"), "RFE report filename stays case-report");
assert(/have not filed/i.test(resolveCasesListCopy(familyGuideInput).emptyBody), "empty cases list must allow no filing yet");
assert(!/Start a case review/.test(CONSULTANT_EMPTY_BODY), "consultant empty state must not sell a filed-case review");
assert(/options or filed case/i.test(UPDATES_CHROME.signInCta), "updates sign-in must cover options and a filed case");
assert(!/Please upload the latest USCIS notice or receipt/.test(SUPPORT_PLAYBOOK_MATCHING.body), "support playbook must not only chase a notice");
assert(/not a USCIS receipt/.test(SUPPORT_PLAYBOOK_MATCHING.body), "support playbook must mention matching evidence first");
assert(CASE_REPORT_FEATURE_NAME.includes("options or case report"), "feature catalog must not be case-report-only");
assert(!/Case report download limit/.test(BILLING_REPORT_OVERAGE), "billing overage must not be case-report-only");
const layoutSrc = readFileSync(join(process.cwd(), "src/app/app/layout.tsx"), "utf8");
assert(layoutSrc.includes("resolveAccountNav"), "app nav must use goal-driven chrome");
assert(!layoutSrc.includes('"USCIS notices"'), "app layout must not hardcode filed-case notice nav");
const casePageSrc = readFileSync(join(process.cwd(), "src/app/app/cases/[id]/page.tsx"), "utf8");
assert(casePageSrc.includes("resolveCaseChrome"), "case page actions must use goal-driven chrome");
assert(!casePageSrc.includes("Upload notice"), "case page must not hardcode Upload notice");
const reportSrc = readFileSync(join(process.cwd(), "src/lib/case-report.ts"), "utf8");
assert(reportSrc.includes("resolveReportChrome"), "printable report must use goal-driven chrome");
const updatesSrc = readFileSync(join(process.cwd(), "src/app/uscis-updates/page.tsx"), "utf8");
assert(updatesSrc.includes("UPDATES_CHROME"), "updates page must use dual-path chrome");
const seedChromeSrc = readFileSync(join(process.cwd(), "prisma/seed.ts"), "utf8");
assert(seedChromeSrc.includes("SUPPORT_PLAYBOOK_MATCHING") && seedChromeSrc.includes("CASE_REPORT_FEATURE_NAME"), "seed must apply dual-path playbook and report feature name");
assert(familyForms[0]?.formNumber === "I-130", "goal-driven chrome must not rerank I-485 ahead of I-130");
assert(presentation.hero.current_posture === "RFE notice needs review", "goal-driven chrome must not convert the RFE fixture into open-options");
assert(listFromOptions.posture === OPEN_OPTIONS_POSTURE, "goal-driven chrome must keep the approved open-options posture");
assert(requested.autoAssigned === false, "goal-driven chrome must not auto-assign consultants");
assert(!/receipt number detected/i.test(openChrome.evidenceLabel + resolveReportChrome(familyGuideInput).footerVerify), "chrome copy must not invent a detected receipt number");

const openDiscussion = resolveDiscussionChrome(familyGuideInput);
const rfeDiscussion = resolveDiscussionChrome(rfeGuideInput);
assert(openDiscussion.heading === "Situation discussion", "open-options discussion heading must not be Case discussion");
assert(!/receipt number/.test(openDiscussion.placeholder), "open-options composer must not ask for a receipt number");
assert(/identity|relationship|matching/i.test(openDiscussion.attachHint), "open-options attach hint must lead with matching evidence");
assert(!/USCIS notices, receipts/.test(openDiscussion.attachHint), "open-options attach hint must not lead with notices");
assert(/situation/.test(openDiscussion.emptyCustomer), "open-options empty comments must talk about the situation");
assert(rfeDiscussion.heading === "Case discussion", "filed RFE discussion heading stays Case discussion");
assert(/receipt number/.test(rfeDiscussion.placeholder), "filed RFE composer may still ask about a receipt");
assert(/USCIS notices, receipts/.test(rfeDiscussion.attachHint), "filed RFE attach hint still names notices");
assert(commentNotificationTitle("IMM-1", familyGuideInput, "customer").includes("situation"), "open-options comment notice is about the situation");
assert(!/your case/.test(commentNotificationTitle("IMM-1", familyGuideInput, "customer")), "open-options comment notice must not say your case");
assert(commentNotificationTitle("IMM-1", rfeGuideInput, "customer").includes("your case"), "filed RFE comment notice stays on the case");
assert(/situation/.test(consultantMatchNotificationTitle(familyGuideInput)), "open-options match notice must not be case-only");
assert(/your case/.test(consultantMatchNotificationTitle(rfeGuideInput)), "filed RFE match notice stays case-fit");
const openClosing = resolveClosingCopy(familyGuideInput);
const rfeClosing = resolveClosingCopy(rfeGuideInput);
assert(/receipt is not required/.test(openClosing.completedKeep), "open-options closing must not require a confirmation letter");
assert(!/start a new case/.test(openClosing.completedKeep), "open-options closing must not send people to start a new case");
assert(/confirmation letters/.test(rfeClosing.completedKeep), "filed RFE closing may keep confirmation letters");
assert(openClosing.notificationTitle("IMM-1").includes("Situation"), "open-options close notice is a situation review");
assert(rfeClosing.notificationTitle("IMM-1").startsWith("Case "), "filed RFE close notice stays a case review");
assert(/receipt is not required/.test(openClosing.abandonedKeep), "open-options abandoned closing must not require a receipt");
assert(!STALE_ACCOUNT_CREATED_BODIES.some((body) => ACCOUNT_CREATED_EMAIL.bodyHtml.toLowerCase().includes(body)), "welcome email must not only mention saved case information");
assert(/options before a filing/.test(ACCOUNT_CREATED_EMAIL.bodyHtml), "welcome email must cover options before a filing");
const openFallbackLine = fallbackEvidenceLine([], familyGuideInput);
const rfeFallbackLine = fallbackEvidenceLine([], rfeGuideInput);
assert(/receipt is not required/.test(openFallbackLine), "open-options fallback evidence must not require a receipt");
assert(!/Upload notices, receipts/.test(openFallbackLine), "open-options fallback must not tell people to upload notices first");
assert(/Upload notices, receipts/.test(rfeFallbackLine), "filed RFE fallback may still ask for notices");
const openFallbackSteps = resolveFallbackPathSteps(familyGuideInput);
const rfeFallbackSteps = resolveFallbackPathSteps(rfeGuideInput);
assert(openFallbackSteps[0]?.action_key === "UPLOAD_DOCUMENTS", "open-options fallback still starts with documents");
assert(/identity|relationship/i.test(openFallbackSteps[0]?.description ?? ""), "open-options fallback documents are matching evidence");
assert(!openFallbackSteps.some((step) => step.action_key === "GET_CASE_RECORD"), "open-options fallback must not require a USCIS case record");
assert(openFallbackSteps.some((step) => step.action_key === "PREPARE_FORM"), "open-options fallback may start the matching form");
assert(!/I-485/.test(openFallbackSteps.map((step) => `${step.title} ${step.description}`).join(" ")) || /I-130/.test(openFallbackSteps.map((step) => `${step.title} ${step.description}`).join(" ")), "open-options fallback must not rank I-485 ahead of I-130");
assert(rfeFallbackSteps.some((step) => step.action_key === "GET_CASE_RECORD"), "filed RFE fallback may still ask for the case record");
assert(/RFE/.test(rfeFallbackSteps[0]?.description ?? ""), "filed RFE fallback still names the notice");
assert(DEFAULT_PROMPTS.closing.includes("open_options"), "closing prompt must lead with the options path");
assert(DEFAULT_PROMPTS.closing.includes("Do not invent a receipt number"), "closing prompt must not invent a receipt");
assert(CLOSING_PROMPT_RULES.includes("open_options"), "closing prompt rules must name open_options");
assert(PROMPT_SUPERSEDES.closing.includes("8d03623ab9021df81e1c398480a65fe4bd867ce9349bdd04bff93af0bedd11c4"), "seed must supersede the filed-case closing prompt");
const commentsSrc = readFileSync(join(process.cwd(), "src/components/case-comments.tsx"), "utf8");
assert(commentsSrc.includes("resolveDiscussionChrome"), "case discussion must use goal-driven conversation chrome");
assert(!commentsSrc.includes("Case discussion"), "case comments must not hardcode Case discussion");
const composerSrc = readFileSync(join(process.cwd(), "src/components/comment-composer.tsx"), "utf8");
assert(composerSrc.includes("placeholder") && composerSrc.includes("attachHint"), "comment composer must take dual-path copy");
assert(!composerSrc.includes("Ask about this USCIS case, receipt number"), "comment composer must not hardcode a receipt placeholder");
const closingSrc = readFileSync(join(process.cwd(), "src/lib/case-closing.ts"), "utf8");
assert(closingSrc.includes("resolveClosingCopy"), "closing remarks must use goal-driven closing copy");
assert(!closingSrc.includes("Keep your documents and any USCIS confirmation letters"), "closing runtime must not hardcode confirmation-letter keep copy");
const fallbackSrc = readFileSync(join(process.cwd(), "src/lib/ai/fallback.ts"), "utf8");
assert(fallbackSrc.includes("resolveFallbackPathSteps") && fallbackSrc.includes("fallbackEvidenceLine"), "analysis fallback must use goal-driven conversation copy");
assert(!fallbackSrc.includes("Upload notices, receipts, forms, and identity records"), "fallback runtime must not hardcode notice-first empty evidence");
const seedConversationSrc = readFileSync(join(process.cwd(), "prisma/seed.ts"), "utf8");
assert(seedConversationSrc.includes("ACCOUNT_CREATED_EMAIL"), "seed must apply the dual-path welcome email");
assert(familyForms[0]?.formNumber === "I-130", "goal-driven conversation must not rerank I-485 ahead of I-130");
assert(presentation.hero.current_posture === "RFE notice needs review", "goal-driven conversation must not convert the RFE fixture into open-options");
assert(listFromOptions.posture === OPEN_OPTIONS_POSTURE, "goal-driven conversation must keep the approved open-options posture");
assert(requested.autoAssigned === false, "goal-driven conversation must not auto-assign consultants");
assert(!/receipt number detected/i.test(openDiscussion.placeholder + openClosing.completedKeep + openFallbackLine), "conversation copy must not invent a detected receipt number");

const openVersion = resolveVersionChrome(familyGuideInput);
const rfeVersion = resolveVersionChrome(rfeGuideInput);
const unlabeledVersion = resolveVersionChrome();
assert(openVersion.recordHeading === "Approved record", "open-options version card must not say Case record version");
assert(openVersion.recordListHeading === "Approved record versions", "open-options version list must not say Case record versions");
assert(openVersion.versionLabel(2) === "Approved record version 2", "open-options canonical label must be Approved record version");
assert(openVersion.howAnalyzedHeading === "How this situation was analyzed", "open-options analysis plan must not say How this case was analyzed");
assert(/receipt is not required/.test(openVersion.laterVersions), "open-options later-versions copy must not require a receipt");
assert(openVersion.closedEyebrow("Aug 26, 2026", "completed").startsWith("Situation closed"), "open-options closed banner is Situation closed");
assert(openVersion.closedEmpty === "This situation has been closed.", "open-options closed empty must not say This case has been closed");
assert(openVersion.verifiedDone === "Verified from matching evidence", "open-options verified steps must not say case evidence");
assert(openVersion.fitsHeading === "How this fits your situation", "open-options notices fit heading must not say your case");
assert(/receipt is not required/.test(openVersion.emptyEvidenceSummary), "open-options empty evidence must not require a USCIS record");
assert(openVersion.defaultPosture === OPEN_OPTIONS_POSTURE, "open-options default posture stays Exploring immigration options");
assert(rfeVersion.recordHeading === "Case record version", "filed RFE version card stays Case record version");
assert(rfeVersion.versionLabel(2) === "Case record version 2", "filed RFE canonical label stays Case record version");
assert(rfeVersion.howAnalyzedHeading === "How this case was analyzed", "filed RFE analysis plan stays How this case was analyzed");
assert(rfeVersion.closedEyebrow("Aug 26, 2026", "completed").startsWith("Case closed"), "filed RFE closed banner stays Case closed");
assert(rfeVersion.closedEmpty === "This case has been closed.", "filed RFE closed empty stays This case has been closed");
assert(rfeVersion.verifiedDone === "Verified from case evidence", "filed RFE verified steps stay case evidence");
assert(rfeVersion.fitsHeading === "How this fits your case", "filed RFE notices fit heading stays your case");
assert(/USCIS records/.test(rfeVersion.emptyEvidenceSummary), "filed RFE empty evidence still asks for USCIS records");
assert(rfeVersion.defaultPosture === "Case posture needs verification", "filed RFE default posture stays case verification");
assert(unlabeledVersion.recordHeading === "Case record version", "unlabeled version chrome must stay filed so A11 labels do not flip");
assert(versionReasonLabel("analysis") === "Full case review", "unlabeled analysis reason must stay Full case review");
assert(versionReasonLabel("analysis", familyGuideInput) === "Options review", "open-options analysis reason must be Options review");
assert(versionReasonLabel("clarify", familyGuideInput) === "Answers added to this situation", "open-options clarify reason must not say the case");
assert(versionReasonLabel("document", familyGuideInput) === "New matching documents on file", "open-options document reason must name matching documents");
assert(versionReasonLabel("analysis", rfeGuideInput) === "Full case review", "filed RFE analysis reason stays Full case review");
assert(versionReasonLabel("clarify", rfeGuideInput) === "Answers added to the case", "filed RFE clarify reason stays Answers added to the case");
assert(canonicalStateSummary(approvedState, familyGuideInput).versionLabel === "Approved record version 2", "open-options canonical summary must not say Case record version");
assert(canonicalStateSummary(approvedState, rfeGuideInput).versionLabel === "Case record version 2", "filed RFE canonical summary stays Case record version");
assert(canonicalStateSummary(approvedState).reasonLabel === "Full case review", "unlabeled canonical reason must stay Full case review");
const listFromOptionsVersion = caseListSummaryFromView(
  { status: "analyzed", reconstructionPosition: "STALE reconstruction posture" },
  approvedView,
  familyGuideInput,
);
assert(caseListVersionLine(listFromOptionsVersion) === "Version 2 · Options review", "open-options lists must not say Full case review");
assert(caseListVersionLine(listFromCanonical) === "Version 2 · Full case review", "unlabeled lists stay Full case review");
assert(/receipt is not required/.test(analysisDocumentWalkthrough(0, familyGuideInput)), "open-options empty walkthrough must not require a receipt");
assert(/matching evidence/.test(analysisDocumentWalkthrough(2, familyGuideInput)), "open-options document walkthrough must name matching evidence");
assert(!/receipt numbers/.test(analysisDocumentWalkthrough(2, familyGuideInput)), "open-options document walkthrough must not compare receipt numbers");
assert(/receipt numbers/.test(analysisDocumentWalkthrough(2, rfeGuideInput)), "filed RFE document walkthrough still compares receipt numbers");
assert(analysisTaskLabel("PRESENT_APPROVED_STATE", familyGuideInput) === "Approved options presentation", "open-options plan must not say Approved case presentation");
assert(analysisTaskLabel("PRESENT_APPROVED_STATE", rfeGuideInput) === "Approved case presentation", "filed RFE plan stays Approved case presentation");
assert(
  analysisPlanSummary(
    { ...lowPlan, tasks_skipped: [{ task: ANALYSIS_TASKS.PRESENT_APPROVED_STATE, reason: "Presentation already assembled." }] },
    (task) => analysisTaskLabel(task, familyGuideInput),
  ).skippedLabels.some((item) => item.label === "Approved options presentation"),
  "open-options skipped plan rows must not stay Approved case presentation",
);
assert(
  analysisPlanSummary(
    { ...lowPlan, tasks_skipped: [{ task: ANALYSIS_TASKS.PRESENT_APPROVED_STATE, reason: "Presentation already assembled." }] },
    (task) => analysisTaskLabel(task, rfeGuideInput),
  ).skippedLabels.some((item) => item.label === "Approved case presentation"),
  "filed RFE skipped plan rows stay Approved case presentation",
);
assert(analysisTaskLabel("PRIMARY_REASONING", familyGuideInput) === "Situation analysis", "non-presentation tasks stay the shared labels");
assert(/receipt is not required/.test(verifiableActionCopy("GET_CASE_RECORD", familyGuideInput)), "open-options GET_CASE_RECORD copy must not require a USCIS case record");
assert(/identity or relationship/.test(verifiableActionCopy("GET_CASE_RECORD", familyGuideInput)), "open-options GET_CASE_RECORD copy must name matching evidence");
assert(/USCIS case record/.test(verifiableActionCopy("GET_CASE_RECORD", rfeGuideInput)), "filed RFE GET_CASE_RECORD copy stays a USCIS case record");
assert(/notice is optional/.test(verifiableActionCopy("UPLOAD_NOTICE", familyGuideInput)), "open-options UPLOAD_NOTICE copy must not require a USCIS notice");
assert(/USCIS notice is extracted/.test(verifiableActionCopy("UPLOAD_NOTICE", rfeGuideInput)), "filed RFE UPLOAD_NOTICE copy stays notice extraction");
assert(/my.uscis.gov record is not required/.test(verifiableActionCopy("GET_ACCOUNT_RECORD", familyGuideInput)), "open-options GET_ACCOUNT_RECORD copy must not require an online account record");
assert(usesMatchingEvidenceProgress(familyGuideInput) === true, "open-options progress must count matching document kinds");
assert(usesMatchingEvidenceProgress(rfeGuideInput) === false, "filed RFE progress must not count matching kinds as a case record");
assert(usesMatchingEvidenceProgress() === false, "unlabeled progress stays filed-case evidence");
assert(matchingProgressKinds().includes("identity"), "matching progress kinds include identity");
assert(matchingProgressKinds().includes("relationship"), "matching progress kinds include relationship");
assert(!matchingProgressKinds().includes("case_record"), "matching progress kinds must not include a USCIS case record");
assert(!matchingProgressKinds().includes("receipt"), "matching progress kinds must not include a receipt");
assert(!matchingProgressKinds().includes("notice"), "matching progress kinds must not include a USCIS notice");
const versionSrc = readFileSync(join(process.cwd(), "src/lib/goal-versions.ts"), "utf8");
assert(versionSrc.includes("OPTIONS_VERSION_REASON_LABELS") && versionSrc.includes("OPTIONS_VERIFIABLE_ACTIONS"), "version chrome must keep a complete options table");
assert(versionSrc.includes("versionSurfaceIsFiled"), "version chrome must default unlabeled calls to the filed path");
const analysisViewSrc = readFileSync(join(process.cwd(), "src/components/case-analysis-view.tsx"), "utf8");
assert(analysisViewSrc.includes("resolveVersionChrome") && analysisViewSrc.includes("verifiableActionCopy"), "analysis view must use goal-driven version chrome");
assert(!analysisViewSrc.includes("How we analyzed this case"), "analysis view must not hardcode How we analyzed this case");
assert(!analysisViewSrc.includes("Verified from case evidence"), "analysis view must not hardcode Verified from case evidence");
const versionCardSrc = readFileSync(join(process.cwd(), "src/components/case-version-card.tsx"), "utf8");
assert(versionCardSrc.includes("resolveVersionChrome"), "version card must use goal-driven version chrome");
assert(!versionCardSrc.includes("Case record version"), "version card must not hardcode Case record version");
const planCardSrc = readFileSync(join(process.cwd(), "src/components/case-analysis-plan-card.tsx"), "utf8");
assert(planCardSrc.includes("resolveVersionChrome") && planCardSrc.includes("analysisTaskLabel"), "analysis plan card must use goal-driven task labels");
assert(planCardSrc.includes("analysisTaskLabel(task, match)"), "analysis plan card skipped labels must use dual-path task labels");
assert(!planCardSrc.includes("How this case was analyzed"), "analysis plan card must not hardcode How this case was analyzed");

const openGuideItem = guideAccountItemLine({
  title: "Priya Shah marriage options",
  posture: OPEN_OPTIONS_POSTURE,
  inquiryMode: "open_options",
  actionLine: "Next: upload identity",
  evidenceLine: "Evidence: identity pending",
  surface: familyGuideInput,
});
const rfeGuideItem = guideAccountItemLine({
  title: "I-485 RFE response",
  posture: "RFE notice needs review",
  inquiryMode: "existing_case",
  actionLine: "Next: upload the RFE",
  evidenceLine: "Evidence: notice on file",
  versionLine: "Version 2 · Full case review",
  surface: rfeGuideInput,
});
assert(openGuideItem.startsWith('Situation "Priya Shah marriage options"'), "open-options guide snapshot must not stay Case \"…\"");
assert(!openGuideItem.startsWith("Case "), "open-options guide snapshot must not prefix Case");
assert(rfeGuideItem.startsWith('Case "I-485 RFE response"'), "filed RFE guide snapshot stays Case \"…\"");
assert(rfeGuideItem.includes("Version 2 · Full case review"), "filed RFE guide snapshot keeps the version line");
assert(guideAccountEmptyLine(familyGuideInput) === "No situations yet — the user hasn't started a situation.", "open-options empty guide snapshot must not stay hasn't started a case");
assert(guideAccountEmptyLine(rfeGuideInput) === "No cases yet — the user hasn't started a case.", "filed empty guide snapshot stays hasn't started a case");
assert(guideAccountEmptyLine() === "No situations yet — the user hasn't started a situation.", "unlabeled empty guide snapshot defaults to a situation");
const mixedGuideOpening = guideOpeningSnapshotBody(
  [
    "User first name: Priya",
    "Plan: Pro",
    openGuideItem,
    rfeGuideItem,
    "Situation: open_options",
    "Matching form: I-130",
    "Current situation: married to a US citizen",
    "No situations yet — the user hasn't started a situation.",
    "Deadline: \"RFE respond-by\" due 9/1/2026",
  ].join("\n"),
);
assert(mixedGuideOpening.includes('Situation "Priya Shah marriage options"'), "opening filter must keep Situation \"…\" item lines");
assert(mixedGuideOpening.includes('Case "I-485 RFE response"'), "opening filter must keep Case \"…\" item lines");
assert(mixedGuideOpening.includes("Situation: open_options"), "opening filter must keep Situation: mode lines");
assert(mixedGuideOpening.includes("Matching form: I-130"), "opening filter must keep Matching lines");
assert(mixedGuideOpening.includes("No situations yet"), "opening filter must keep No situations yet");
assert(mixedGuideOpening.includes("Deadline:"), "opening filter must keep Deadline lines");
assert(!mixedGuideOpening.includes("User first name"), "opening filter must still hide account metadata");
assert(!mixedGuideOpening.includes("Current situation:"), "opening filter must still hide the raw situation paragraph");
assert(guideSrc.includes("guideAccountItemLine") && guideSrc.includes("guideAccountEmptyLine"), "guide runtime must use dual-path snapshot lines");
assert(guideSrc.includes("guideOpeningSnapshotBody"), "guide opening must filter snapshot lines through the dual-path helper");
assert(!guideSrc.includes('Case "${c.title'), "guide runtime must not hardcode Case \"title\" snapshot lines");
assert(!guideSrc.includes("No cases yet — the user hasn't started a case."), "guide runtime must not hardcode No cases yet snapshot copy");
assert(familyForms[0]?.formNumber === "I-130", "goal-driven guide snapshot must not rerank I-485 ahead of I-130");
assert(presentation.hero.current_posture === "RFE notice needs review", "goal-driven guide snapshot must not convert the RFE fixture into open-options");
assert(requested.autoAssigned === false, "goal-driven guide snapshot must not auto-assign consultants");

assert(recordRefLabel(familyGuideInput, 11) === "Situation IMM-000011", "open-options record ref must not stay Case IMM");
assert(recordRefLabel(rfeGuideInput, 1) === "Case IMM-000001", "filed RFE record ref stays Case IMM");
assert(recordRefLabel({}, 7) === "Situation IMM-000007", "unlabeled record ref defaults to Situation");
assert(formPrefillRecordHint(familyGuideInput, 11) === " and situation IMM-000011", "open-options form prefill must not say and case IMM");
assert(formPrefillRecordHint(rfeGuideInput, 1) === " and case IMM-000001", "filed RFE form prefill stays and case IMM");
assert(formPrefillRecordHint(familyGuideInput, null) === "", "form prefill hint is empty when no record is linked");
assert(/options analysis/.test(knownFactsSourceHint(familyGuideInput)), "open-options known-facts source must not stay case analysis");
assert(/case analysis/.test(knownFactsSourceHint(rfeGuideInput)), "filed RFE known-facts source stays case analysis");
assert(/A receipt is not required/.test(knownFactsVerifyHint(familyGuideInput)), "open-options known-facts verify must not require a USCIS notice or case record");
assert(/USCIS notice or case record/.test(knownFactsVerifyHint(rfeGuideInput)), "filed RFE known-facts verify stays a notice or case record");
const customerCaseSrc = readFileSync(join(process.cwd(), "src/app/app/cases/[id]/page.tsx"), "utf8");
assert(customerCaseSrc.includes("recordRefLabel"), "customer case page must use dual-path record labels");
assert(!customerCaseSrc.includes("Case ${formatCaseNumber"), "customer case page must not hardcode Case IMM");
const adminCaseSrc = readFileSync(join(process.cwd(), "src/app/admin/cases/[id]/page.tsx"), "utf8");
assert(adminCaseSrc.includes("recordRefLabel"), "admin case page must use the same dual-path record labels as the customer");
assert(!adminCaseSrc.includes("Case ${formatCaseNumber"), "admin case page must not hardcode Case IMM");
const formPrefillSrc = readFileSync(join(process.cwd(), "src/lib/form-prefill.ts"), "utf8");
assert(formPrefillSrc.includes("consultantRecordLabel") && formPrefillSrc.includes("formPrefillRecordHint"), "form prefill must use dual-path record labels");
assert(!formPrefillSrc.includes('add("Case"'), "form prefill must not hardcode the Case fact label");
const fillFormSrc = readFileSync(join(process.cwd(), "src/app/app/forms/fill/[id]/page.tsx"), "utf8");
assert(fillFormSrc.includes("prefill.recordHint"), "form wizard must use the dual-path record hint");
assert(!fillFormSrc.includes("and case ${prefill.caseNumber}"), "form wizard must not hardcode and case IMM");
const knownFactsSrc = readFileSync(join(process.cwd(), "src/components/known-facts-panel.tsx"), "utf8");
assert(knownFactsSrc.includes("sourceHint") && knownFactsSrc.includes("verifyHint"), "known-facts panel must take dual-path hints");
assert(!knownFactsSrc.includes("From your profile and case analysis."), "known-facts panel must not hardcode case analysis as the default");
assert(familyForms[0]?.formNumber === "I-130", "goal-driven record labels must not rerank I-485 ahead of I-130");
assert(presentation.hero.current_posture === "RFE notice needs review", "goal-driven record labels must not convert the RFE fixture into open-options");
assert(requested.autoAssigned === false, "goal-driven record labels must not auto-assign consultants");

const openClarify = resolveClarifyChrome(familyGuideInput);
const rfeClarify = resolveClarifyChrome(rfeGuideInput);
assert(!/receipt numbers/.test(openClarify.placeholder), "open-options clarify placeholder must not hunt a receipt number");
assert(/A receipt is not required/.test(openClarify.placeholder), "open-options clarify placeholder must say a receipt is not required");
assert(/receipt numbers/.test(rfeClarify.placeholder), "filed RFE clarify placeholder still asks for receipt numbers");
assert(/USCIS notice is optional/.test(openClarify.attachHint), "open-options clarify attach must not require a USCIS notice");
assert(/USCIS notices, receipts/.test(rfeClarify.attachHint), "filed RFE clarify attach still takes notices and receipts");
assert(/do not need a receipt number/.test(openClarify.helperWithQuestion), "open-options clarify helper must not stay case details");
assert(/case details/.test(rfeClarify.helperWithQuestion), "filed RFE clarify helper stays case details");
assert(!/receipt numbers/.test(resolveClarifyChrome().placeholder), "unlabeled clarify placeholder defaults off a receipt hunt");
const clarifyFormSrc = readFileSync(join(process.cwd(), "src/components/clarify-answer-form.tsx"), "utf8");
assert(clarifyFormSrc.includes("placeholder") && clarifyFormSrc.includes("attachHint"), "clarify form must take dual-path chrome");
assert(!clarifyFormSrc.includes("receipt numbers, form names, dates, and evidence details help most"), "clarify form must not hardcode the receipt-number placeholder");
const caseClarifySrc = readFileSync(join(process.cwd(), "src/components/case-clarify.tsx"), "utf8");
assert(caseClarifySrc.includes("resolveClarifyChrome"), "case clarify must use dual-path clarify chrome");
assert(!caseClarifySrc.includes("INQUIRY_MODES.OPEN_OPTIONS"), "case clarify must classify with isFiledCaseSurface via resolveClarifyChrome");
assert(familyForms[0]?.formNumber === "I-130", "goal-driven clarify chrome must not rerank I-485 ahead of I-130");
assert(presentation.hero.current_posture === "RFE notice needs review", "goal-driven clarify chrome must not convert the RFE fixture into open-options");
assert(requested.autoAssigned === false, "goal-driven clarify chrome must not auto-assign consultants");

const emptyOpenGuide = { inquiryMode: "open_options" as const, themes: marriageInquiry.themes };
const emptyRfeGuide = { inquiryMode: "existing_case" as const, noticeTypes: ["RFE"], hasNotices: true };
assert(guidePrimaryAction(emptyOpenGuide).label === "Start your first situation", "empty open-options guide CTA must not stay Start my first case");
assert(guidePrimaryAction(emptyOpenGuide).href === "/app/cases/new", "empty open-options guide CTA still starts intake");
assert(guidePrimaryAction(emptyRfeGuide).label === "Start your first case", "empty filed guide CTA stays Start your first case");
assert(guidePrimaryAction({}).label === "Start your first situation", "unlabeled empty guide CTA defaults to a situation");
assert(/This situation is still open-options/.test(guideStatusHint("What is my receipt status?", familyGuideInput)), "open-options receipt hint must not say This case is still open-options");
assert(/This situation is still open-options/.test(guideStatusHint("What is my receipt status?", emptyOpenGuide)), "empty open-options receipt hint must not say This case");
assert(/upload the USCIS notice or receipt number/.test(guideStatusHint("What is my RFE deadline?", rfeGuideInput)), "filed RFE receipt hint stays on the case page");
assert(!/This case is still open-options/.test(guideStatusHint("What is my receipt status?", familyGuideInput)), "open-options status hint must drop This case");
assert(/the situation page updates automatically/.test(guideTipForStep("REVIEW_ANALYSIS", familyGuideInput) ?? ""), "open-options review tip must not say the case page");
assert(/the case page updates automatically/.test(guideTipForStep("REVIEW_ANALYSIS", rfeGuideInput) ?? ""), "filed RFE review tip stays the case page");
assert(/the situation page updates automatically/.test(guideTipForStep("REVIEW_ANALYSIS") ?? ""), "unlabeled review tip defaults to the situation page");
assert(/listed on your situation/.test(guideTipForStep("PREPARE_FORM", { inquiryMode: "open_options" }) ?? ""), "open-options form fallback must not say listed on your case");
assert(/listed on your case/.test(guideTipForStep("PREPARE_FORM", { inquiryMode: "existing_case" }) ?? ""), "filed form fallback stays listed on your case");
assert(/Form I-130/.test(guideTipForStep("PREPARE_FORM", familyGuideInput) ?? ""), "open-options with a matching form still names I-130");
assert(!/Start my first case/.test(guidePrimaryAction(emptyOpenGuide).label + guidePrimaryAction({}).label), "guide empty CTA must not hardcode Start my first case");
const goalGuideSrc = readFileSync(join(process.cwd(), "src/lib/goal-guide.ts"), "utf8");
assert(goalGuideSrc.includes("resolveIntakeChrome(input).firstCta"), "empty guide CTA must reuse C21 firstCta");
assert(!goalGuideSrc.includes("Start my first case"), "goal-guide must not hardcode Start my first case");
assert(!goalGuideSrc.includes("This case is still open-options"), "goal-guide must not hardcode This case is still open-options");
assert(!goalGuideSrc.includes("the case page updates automatically"), "goal-guide must not hardcode the case page updates automatically");
assert(!goalGuideSrc.includes("listed on your case"), "goal-guide must not hardcode listed on your case");
assert(goalGuideSrc.includes("the ${surfaceNoun(input)} page updates automatically"), "review tip must use the surface noun");
assert(familyForms[0]?.formNumber === "I-130", "goal-driven guide copy must not rerank I-485 ahead of I-130");
assert(presentation.hero.current_posture === "RFE notice needs review", "goal-driven guide copy must not convert the RFE fixture into open-options");
assert(requested.autoAssigned === false, "goal-driven guide copy must not auto-assign consultants");

const progressSrc = readFileSync(join(process.cwd(), "src/lib/case-progress.ts"), "utf8");
assert(progressSrc.includes("matchingProgressKinds") && progressSrc.includes("usesMatchingEvidenceProgress"), "progress verification must count matching kinds on open-options");
assert(progressSrc.includes("FILED_VERIFIABLE_ACTIONS"), "progress key table stays the filed keys so verification still runs");
const presentationViewSrc = readFileSync(join(process.cwd(), "src/components/case-presentation-view.tsx"), "utf8");
assert(presentationViewSrc.includes("verifiableActionCopy") && presentationViewSrc.includes("resolveVersionChrome"), "presentation path steps must use goal-driven progress copy");
const noticesSrc = readFileSync(join(process.cwd(), "src/app/app/notices/page.tsx"), "utf8");
assert(noticesSrc.includes("resolveVersionChrome") && noticesSrc.includes("fitsHeading"), "notices page must use dual-path fit headings");
assert(familyForms[0]?.formNumber === "I-130", "goal-driven versions must not rerank I-485 ahead of I-130");
assert(presentation.hero.current_posture === "RFE notice needs review", "goal-driven versions must not convert the RFE fixture into open-options");
assert(listFromOptions.posture === OPEN_OPTIONS_POSTURE, "goal-driven versions must keep the approved open-options posture");
assert(requested.autoAssigned === false, "goal-driven versions must not auto-assign consultants");
assert(!/receipt number detected/i.test(openVersion.emptyEvidenceSummary + verifiableActionCopy("GET_CASE_RECORD", familyGuideInput)), "version copy must not invent a detected receipt number");

const openIntake = resolveIntakeChrome(familyGuideInput);
const rfeIntake = resolveIntakeChrome(rfeGuideInput);
const unlabeledIntake = resolveIntakeChrome();
assert(openIntake.pageTitle === "Start a new situation", "open-options intake title must not be Start a new case");
assert(/receipt is not required/.test(openIntake.prefillBanner), "open-options prefill must not require a receipt");
assert(openIntake.submitLabel === "Analyze my situation →", "open-options intake submit must not say Analyze my case");
assert(openIntake.listCta === "New situation →", "open-options dashboard CTA must not say New case");
assert(openIntake.firstCta === "Start your first situation", "open-options empty dashboard must not say Start your first case");
assert(openIntake.startLabel === "Start a situation", "open-options list start must not say Start a case");
assert(resolveCasesListCopy(familyGuideInput).startLabel === "Start a situation", "cases list copy must use the options start label");
assert(openIntake.consultantConsent.includes("situation details"), "open-options consultant consent must not say case details");
assert(!/case details/.test(openIntake.consultantConsent), "open-options consultant consent must not say case details");
assert(openIntake.documentsTitle === "Documents matched to your situation", "open-options documents header must not say your case");
assert(openIntake.lettersTitle === "USCIS letters, matched to your situation", "open-options letters header must not say your case");
assert(/receipt is not required/.test(openIntake.documentsEmptyIdentity), "open-options empty vault must not require a receipt");
assert(/this situation/.test(openIntake.formsSubtitle), "open-options forms subtitle must not say latest case");
assert(/this situation/.test(openIntake.letterGroundHint), "open-options letter grounding must not say this case");
assert(openIntake.officialMaterialLead === "Official material for this situation points to", "open-options matching lead must not say this case");
assert(openIntake.professionalReview.includes("this situation"), "open-options professional review must not say this case");
assert(/case record is not required/.test(openIntake.verificationHint), "open-options verification must not chase a USCIS case record");
assert(openIntake.guideNewCaseLabel === "Yes — start this as a new situation", "open-options guide handoff must not say start this as a new case");
assert(/receipt is not required/.test(openIntake.guideNewCaseMessage), "open-options guide handoff must not require a receipt");
assert(/Open your situation/.test(openIntake.guideOpenStep), "open-options guide must not say Open your case");
assert(rfeIntake.pageTitle === "Start a new case", "filed RFE intake title stays Start a new case");
assert(rfeIntake.submitLabel === "Analyze my case →", "filed RFE intake submit stays Analyze my case");
assert(rfeIntake.listCta === "New case →", "filed RFE dashboard CTA stays New case");
assert(rfeIntake.startLabel === "Start a case", "filed RFE list start stays Start a case");
assert(resolveCasesListCopy(rfeGuideInput).startLabel === "Start a case", "filed RFE cases list stays Start a case");
assert(rfeIntake.consultantConsent.includes("case details"), "filed RFE consultant consent stays case details");
assert(rfeIntake.documentsTitle === "Documents matched to your case", "filed RFE documents header stays your case");
assert(rfeIntake.lettersTitle === "USCIS letters, matched to your case", "filed RFE letters header stays your case");
assert(rfeIntake.officialMaterialLead === "Official material for this case points to", "filed RFE matching lead stays this case");
assert(rfeIntake.guideNewCaseLabel === "Yes — start this as a new case", "filed RFE guide handoff stays start this as a new case");
assert(unlabeledIntake.pageTitle === "Start a new situation", "unlabeled intake defaults to options so empty accounts are not sold a filed case");
assert(!/Start a case review/.test(openIntake.pageTitle + openIntake.listCta), "intake chrome must not revive Start a case review");
const newCaseSrc = readFileSync(join(process.cwd(), "src/app/app/cases/new/page.tsx"), "utf8");
assert(newCaseSrc.includes("resolveIntakeChrome"), "new-case page must use goal-driven intake chrome");
assert(!newCaseSrc.includes("Start a new case"), "new-case page must not hardcode Start a new case");
assert(!newCaseSrc.includes("Analyze my situation"), "new-case page must not hardcode Analyze my situation");
const dashboardSrc = readFileSync(join(process.cwd(), "src/app/app/page.tsx"), "utf8");
assert(dashboardSrc.includes("resolveIntakeChrome") && dashboardSrc.includes("listCta"), "dashboard must use goal-driven new-situation CTA");
assert(!dashboardSrc.includes("New case →"), "dashboard must not hardcode New case");
assert(!dashboardSrc.includes("Start your first case"), "dashboard empty state must not hardcode Start your first case");
const casesListSrc = readFileSync(join(process.cwd(), "src/app/app/cases/page.tsx"), "utf8");
assert(casesListSrc.includes("resolveIntakeChrome"), "cases list must use goal-driven intake chrome");
assert(!casesListSrc.includes("New case →"), "cases list must not hardcode New case");
const consultantsSrc = readFileSync(join(process.cwd(), "src/app/app/consultants/page.tsx"), "utf8");
assert(consultantsSrc.includes("consultantConsent"), "consultant consent must use goal-driven intake chrome");
assert(!consultantsSrc.includes("view your case details"), "consultant page must not hardcode view your case details");
const docsPageSrc = readFileSync(join(process.cwd(), "src/app/app/documents/page.tsx"), "utf8");
assert(docsPageSrc.includes("documentsTitle"), "documents page must use dual-path title");
assert(!docsPageSrc.includes("Documents matched to your case"), "documents page must not hardcode matched to your case");
const lettersPageSrc = readFileSync(join(process.cwd(), "src/app/app/letters/page.tsx"), "utf8");
assert(lettersPageSrc.includes("lettersTitle"), "letters page must use dual-path title");
assert(!lettersPageSrc.includes("matched to your case"), "letters page must not hardcode matched to your case");
const formsPageSrc = readFileSync(join(process.cwd(), "src/app/app/forms/page.tsx"), "utf8");
assert(formsPageSrc.includes("formsSubtitle"), "forms page must use dual-path subtitle");
assert(!formsPageSrc.includes("your latest case"), "forms page must not hardcode your latest case");
assert(presentationViewSrc.includes("officialMaterialLead"), "presentation matching leads must use intake chrome");
assert(!presentationViewSrc.includes("Official material for this case points to"), "presentation must not hardcode Official material for this case");
const analysisViewSrcC21 = readFileSync(join(process.cwd(), "src/components/case-analysis-view.tsx"), "utf8");
assert(analysisViewSrcC21.includes("verificationHint"), "analysis verification must use dual-path intake copy");
assert(!analysisViewSrcC21.includes("like the USCIS account"), "legacy analysis verification must not hardcode a USCIS account case record");
const guideRuntimeSrc = readFileSync(join(process.cwd(), "src/lib/guide.ts"), "utf8");
assert(guideRuntimeSrc.includes("guideNewCaseLabel"), "guide new-situation handoff must use intake chrome");
assert(!guideRuntimeSrc.includes("Yes — start this as a new case"), "guide runtime must not hardcode start this as a new case");
assert(!guideRuntimeSrc.includes("Open your case and follow"), "guide runtime must not hardcode Open your case");
const readmeSrc = readFileSync(join(process.cwd(), "README.md"), "utf8");
assert(/explore options before they file/i.test(readmeSrc), "README must lead with options before a filing");
assert(/receipt is not required/i.test(readmeSrc), "README must not require a USCIS receipt to start");
assert(!/A friendly AI immigration case assistant/.test(readmeSrc), "README must not introduce the product as a case assistant only");
assert(!/^\| Upload \/ photograph USCIS notices \|/m.test(readmeSrc), "README feature table must not lead with notice upload");
assert(familyForms[0]?.formNumber === "I-130", "goal-driven intake must not rerank I-485 ahead of I-130");
assert(presentation.hero.current_posture === "RFE notice needs review", "goal-driven intake must not convert the RFE fixture into open-options");
assert(listFromOptions.posture === OPEN_OPTIONS_POSTURE, "goal-driven intake must keep the approved open-options posture");
assert(requested.autoAssigned === false, "goal-driven intake must not auto-assign consultants");
assert(!/receipt number detected/i.test(openIntake.prefillBanner + openIntake.guideNewCaseMessage), "intake copy must not invent a detected receipt number");

assert(resolveCasesListCopy(familyGuideInput).pageTitle === "My situations", "open-options list title must not stay My cases");
assert(resolveCasesListCopy(familyGuideInput).recentHeading === "Recent situations", "open-options dashboard list must not stay Recent cases");
assert(resolveCasesListCopy(familyGuideInput).navLabel === "My situations", "open-options nav must not stay My cases");
assert(resolveCasesListCopy(familyGuideInput).emptyTitle === "No situations yet", "open-options empty list must not stay No cases yet");
assert(resolveCasesListCopy(rfeGuideInput).pageTitle === "My cases", "filed RFE list title stays My cases");
assert(resolveCasesListCopy(rfeGuideInput).recentHeading === "Recent cases", "filed RFE dashboard list stays Recent cases");
assert(resolveCasesListCopy().pageTitle === "My situations", "unlabeled list defaults to situations so empty accounts are not sold a filed case");
assert(surfaceNoun(familyGuideInput) === "situation" && surfaceNoun(rfeGuideInput) === "case", "surface noun must split situation vs case");
assert(/this situation/.test(openNoticeCopy.skipBanner ?? ""), "open-options notice skip must not say this case");
assert(!/this case/.test(openNoticeCopy.skipBanner ?? ""), "open-options notice skip must not say this case");
assert(openNoticeCopy.relatedSelectLabel.includes("situation"), "open-options notice picker must not say Related case");
assert(openNoticeCopy.unlinkedOption.includes("situation"), "open-options notice picker must not say Not linked to a case");
assert(rfeNoticeCopy.relatedSelectLabel.includes("case"), "filed RFE notice picker stays Related case");
assert(/Open-options situations/.test(openDeadlineCopy.emptyBody), "open-options deadlines must not say Open-options cases");
assert(/this situation/.test(letterKindHint(familyGuideInput)), "open-options letter kind hint must not say this case");
assert(/this case/.test(letterKindHint(rfeGuideInput)), "filed RFE letter kind hint stays this case");
assert(letterGroundSelectLabel(familyGuideInput).includes("situation"), "open-options letter ground select must not say a case");
assert(letterGroundSelectLabel(rfeGuideInput).includes("case"), "filed RFE letter ground select stays a case");
assert(/this situation/.test(documentCatalogForSurface(familyGuideInput).find((item) => item.kind === "other")?.hint ?? ""), "open-options other-document hint must not say this case");
assert(/this case/.test(documentCatalogForSurface(rfeGuideInput).find((item) => item.kind === "other")?.hint ?? ""), "filed RFE other-document hint stays this case");
assert(/this situation's follow-up/.test(suggestionUsageFromCount(3, freeSuggestions, familyGuideInput).blockReason), "open-options Free follow-up cap must not say this case's follow-up");
assert(/this case's follow-up/.test(suggestionUsageFromCount(3, freeSuggestions, rfeGuideInput).blockReason), "filed RFE Free follow-up cap stays this case's follow-up");
assert(/this kind of situation/.test(suggestionConsultantCopy(proSuggestions, { name: "Alex Rivera", credentialLabel: "attorney" }, true, familyGuideInput)), "open-options professional review must not say this kind of case");
assert(/this kind of case/.test(suggestionConsultantCopy(proSuggestions, { name: "Alex Rivera", credentialLabel: "attorney" }, true, rfeGuideInput)), "filed RFE professional review stays this kind of case");
assert(qaGroundSelectLabel(familyGuideInput).includes("situation"), "open-options Q&A ground select must not say a case");
assert(qaGroundSelectLabel(rfeGuideInput).includes("case"), "filed RFE Q&A ground select stays a case");
assert(openIntake.consultantRoutedLead.includes("situation"), "open-options consultant routing must not say this case");
assert(rfeIntake.consultantRoutedLead.includes("case"), "filed RFE consultant routing stays this case");
assert(letterStart.submitLabel === "Analyze my case →", "guest letter start submit must not stay Analyze my situation");
assert(optionsStart.submitLabel === "Analyze my situation →", "guest options start submit stays Analyze my situation");
assert(/situation or a filed case/.test(PUBLIC_HOW_IT_WORKS_PAGE), "how-it-works must not only say If your case needs");
assert(!/immigration case assistant/.test(PUBLIC_FAQ_BODY), "FAQ must not introduce the product as a case assistant only");
assert(GUIDE_PROMPT_RULES.includes("start this as a new situation"), "guide prompt must name the options handoff button");
assert(!GUIDE_PROMPT_RULES.includes('"Start as a new case"'), "guide prompt must not only name Start as a new case");
assert(PROMPT_SUPERSEDES.guide.includes("62391e307e8264d1a2ddbfed134edb06dfe52285e60dbbd7f8ad4fa565951832"), "seed must supersede the case-only guide handoff prompt");
assert(!layoutSrc.includes('"My cases"'), "app layout must not hardcode My cases");
assert(!dashboardSrc.includes("Recent cases"), "dashboard must not hardcode Recent cases");
assert(!dashboardSrc.includes("No cases yet"), "dashboard empty state must not hardcode No cases yet");
const casesPageSrcC22 = readFileSync(join(process.cwd(), "src/app/app/cases/page.tsx"), "utf8");
assert(casesPageSrcC22.includes("generateMetadata"), "cases list tab title must use goal-driven list chrome");
assert(!casesPageSrcC22.includes('title: "My cases"'), "cases list must not hardcode My cases metadata");
const lettersNewSrc = readFileSync(join(process.cwd(), "src/app/app/letters/new/page.tsx"), "utf8");
assert(lettersNewSrc.includes("letterGroundSelectLabel"), "letter composer must use dual-path ground labels");
assert(!lettersNewSrc.includes("Ground this letter in a case"), "letter composer must not hardcode Ground this letter in a case");
const letterFormSrc = readFileSync(join(process.cwd(), "src/components/letter-forms.tsx"), "utf8");
assert(!letterFormSrc.includes("official material on this case"), "letter kind hint must not hardcode this case");
const wizardSrc = readFileSync(join(process.cwd(), "src/components/intake-wizard.tsx"), "utf8");
assert(wizardSrc.includes("submitLabel"), "guest start submit must use dual-path public copy");
assert(!wizardSrc.includes("Analyze my situation →"), "guest start must not hardcode Analyze my situation");
const consultantDashSrc = readFileSync(join(process.cwd(), "src/app/consultant/page.tsx"), "utf8");
assert(consultantDashSrc.includes("consultantRoutedLead"), "consultant dashboard must use dual-path routing copy");
assert(!consultantDashSrc.includes("Why this case was routed to you"), "consultant dashboard must not hardcode Why this case was routed");
const qaPageSrc = readFileSync(join(process.cwd(), "src/app/app/qa/page.tsx"), "utf8");
assert(qaPageSrc.includes("qaGroundSelectLabel"), "Q&A page must use dual-path ground labels");
assert(!qaPageSrc.includes("Ground answers in a case"), "Q&A page must not hardcode Ground answers in a case");
assert(familyForms[0]?.formNumber === "I-130", "goal-driven remaining chrome must not rerank I-485 ahead of I-130");
assert(presentation.hero.current_posture === "RFE notice needs review", "goal-driven remaining chrome must not convert the RFE fixture into open-options");
assert(listFromOptions.posture === OPEN_OPTIONS_POSTURE, "goal-driven remaining chrome must keep the approved open-options posture");
assert(requested.autoAssigned === false, "goal-driven remaining chrome must not auto-assign consultants");
assert(!/receipt number detected/i.test(openNoticeCopy.skipBanner ?? ""), "remaining chrome must not invent a detected receipt number");

assert(thisSurfacePhrase(familyGuideInput) === "this situation", "open-options surface phrase must not stay this case");
assert(thisSurfacePhrase(rfeGuideInput) === "this case", "filed RFE surface phrase stays this case");
assert(/this situation/.test(updatesImpactReason(["I-130"], familyGuideInput)), "open-options updates impact must not say this case");
assert(/this case/.test(updatesImpactReason(["RFE"], rfeGuideInput)), "filed RFE updates impact stays this case");
assert(/situation page/.test(billingReportReturn(familyGuideInput)), "open-options billing return must not say the case page");
assert(/case page/.test(billingReportReturn(rfeGuideInput)), "filed RFE billing return stays the case page");
assert(/situation page/.test(billingReportReturn()), "unlabeled billing return defaults to the situation page");
assert(/this situation/.test(presentationNoticeStepDescription(OPEN_OPTIONS_POSTURE, familyGuideInput)), "open-options notice next-step must not say this case");
assert(/this case/.test(presentationNoticeStepDescription("RFE notice needs review", rfeGuideInput)), "filed RFE notice next-step stays this case");
assert(consultantRecordLabel(familyGuideInput) === "Situation", "open-options consultant record label must not stay Case");
assert(consultantRecordLabel(rfeGuideInput) === "Case", "filed RFE consultant record label stays Case");
assert(resolveConsultantWorkspaceCopy([]).heading === "Situations", "empty consultant workspace defaults to situations");
assert(resolveConsultantWorkspaceCopy([familyGuideInput]).heading === "Situations", "open-options consultant workspace must not stay Cases");
assert(resolveConsultantWorkspaceCopy([familyGuideInput]).emptyTitle === "No situations", "open-options consultant empty must not stay No cases");
assert(/hasn't started a situation/.test(resolveConsultantWorkspaceCopy([]).dashboardEmpty), "empty consultant dashboard must not stay hasn't started a case");
assert(resolveConsultantWorkspaceCopy([rfeGuideInput]).heading === "Cases", "filed RFE consultant workspace stays Cases");
assert(/hasn't started a case/.test(resolveConsultantWorkspaceCopy([rfeGuideInput]).dashboardEmpty), "filed RFE consultant dashboard stays hasn't started a case");
assert(resolveConsultantWorkspaceCopy([familyGuideInput, rfeGuideInput]).heading === "Cases & situations", "mixed consultant workspace must name both paths");
const billingPageSrc = readFileSync(join(process.cwd(), "src/app/app/billing/page.tsx"), "utf8");
assert(billingPageSrc.includes("billingReportReturn"), "billing overage return must use dual-path copy");
assert(!billingPageSrc.includes("from the case page"), "billing overage return must not hardcode the case page");
const updatesLibSrc = readFileSync(join(process.cwd(), "src/lib/uscis-updates.ts"), "utf8");
assert(updatesLibSrc.includes("updatesImpactReason"), "USCIS update impacts must use dual-path copy");
assert(!updatesLibSrc.includes("which also appears in this case"), "USCIS update impacts must not hardcode this case");
const noticeBriefSrc = readFileSync(join(process.cwd(), "src/lib/case-presentation-brief.ts"), "utf8");
assert(noticeBriefSrc.includes("presentationNoticeStepDescription"), "notice next-step must use dual-path copy");
assert(!noticeBriefSrc.includes("Approved next step for this case"), "notice next-step must not hardcode this case");
const orchestratorSrc = readFileSync(join(process.cwd(), "src/lib/ai/orchestrator.ts"), "utf8");
assert(orchestratorSrc.includes("matchInputFromCase"), "notice explanations must pass the case surface into next-step copy");
const consultantClientSrc = readFileSync(join(process.cwd(), "src/app/consultant/clients/[id]/page.tsx"), "utf8");
assert(consultantClientSrc.includes("resolveConsultantWorkspaceCopy"), "consultant client workspace must use dual-path list chrome");
assert(!consultantClientSrc.includes('title="No cases"'), "consultant client workspace must not hardcode No cases");
const consultantCaseSrc = readFileSync(join(process.cwd(), "src/app/consultant/clients/[id]/cases/[caseId]/page.tsx"), "utf8");
assert(consultantCaseSrc.includes("recordRefLabel"), "consultant case view must use dual-path record labels");
assert(!consultantCaseSrc.includes("Case ${formatCaseNumber"), "consultant case view must not hardcode Case IMM");
assert(consultantDashSrc.includes("workspace.dashboardEmpty"), "consultant dashboard empty must use dual-path copy");
assert(!consultantDashSrc.includes("hasn't started a case yet"), "consultant dashboard empty must not hardcode hasn't started a case");
assert(familyForms[0]?.formNumber === "I-130", "goal-driven workspace chrome must not rerank I-485 ahead of I-130");
assert(presentation.hero.current_posture === "RFE notice needs review", "goal-driven workspace chrome must not convert the RFE fixture into open-options");
assert(listFromOptions.posture === OPEN_OPTIONS_POSTURE, "goal-driven workspace chrome must keep the approved open-options posture");
assert(requested.autoAssigned === false, "goal-driven workspace chrome must not auto-assign consultants");
assert(!/receipt number detected/i.test(openNoticeCopy.skipBanner ?? ""), "workspace chrome must not invent a detected receipt number");

assert(presentationOrganizingSummary(familyGuideInput) === OPTIONS_ORGANIZING_SUMMARY, "open-options organizing summary must not stay the case");
assert(presentationOrganizingSummary(rfeGuideInput) === FILED_ORGANIZING_SUMMARY, "filed RFE organizing summary stays the case");
assert(withPresentationSurfaceCopy({
  ...optionsPresentation,
  what_this_means: { ...optionsPresentation.what_this_means, summary: FILED_ORGANIZING_SUMMARY },
}, familyGuideInput).what_this_means.summary === OPTIONS_ORGANIZING_SUMMARY, "stored canned case organizing copy must remap on open-options lists and views");
assert(withPresentationSurfaceCopy({
  ...presentation,
  what_this_means: { ...presentation.what_this_means, summary: FILED_ORGANIZING_SUMMARY },
}, rfeGuideInput).what_this_means.summary === FILED_ORGANIZING_SUMMARY, "filed canned organizing copy must stay on RFE presentations");
const cannedList = caseListSummaryFromView(
  { status: "analyzed" },
  buildApprovedCaseView({
    canonical: buildCanonicalApprovedState({
      version: 1,
      reason: "analysis",
      pipelineConfigVersion: "v4.2-c24",
      evidenceSnapshotHash: "canned-hash",
      status: "analyzed",
      readinessScore: 30,
      presentation: {
        ...optionsPresentation,
        what_this_means: { ...optionsPresentation.what_this_means, summary: FILED_ORGANIZING_SUMMARY },
      },
    }),
  }),
  familyGuideInput,
);
assert(cannedList.meaning === OPTIONS_ORGANIZING_SUMMARY, "open-options case lists must not keep the canned case organizing sentence");
const presentationViewSrcC24 = readFileSync(join(process.cwd(), "src/components/case-presentation-view.tsx"), "utf8");
assert(presentationViewSrcC24.includes("withPresentationSurfaceCopy"), "presentation view must remap canned organizing copy");
const analysisViewSrcC24 = readFileSync(join(process.cwd(), "src/components/case-analysis-view.tsx"), "utf8");
assert(analysisViewSrcC24.includes("presentationWhatThisMeansSummary"), "analysis view must remap canned organizing copy");
const lettersNewSrcC24 = readFileSync(join(process.cwd(), "src/app/app/letters/new/page.tsx"), "utf8");
assert(lettersNewSrcC24.includes("approvedPresentationHeading"), "letter composer context card must use dual-path presentation heading");
const listCardSrc = readFileSync(join(process.cwd(), "src/components/case-list-card.tsx"), "utf8");
assert(listCardSrc.includes("approvedPresentationHeading"), "presentation context card default heading must be dual-path");
assert(!listCardSrc.includes('heading = "Approved case presentation"'), "presentation context card must not hardcode Approved case presentation");
assert(familyForms[0]?.formNumber === "I-130", "goal-driven presentation copy must not rerank I-485 ahead of I-130");
assert(presentation.hero.current_posture === "RFE notice needs review", "goal-driven presentation copy must not convert the RFE fixture into open-options");
assert(listFromOptions.posture === OPEN_OPTIONS_POSTURE, "goal-driven presentation copy must keep the approved open-options posture");
assert(requested.autoAssigned === false, "goal-driven presentation copy must not auto-assign consultants");

assert(approvedPresentationPhrase(familyGuideInput) === "approved options presentation", "open-options inline copy must not stay approved case presentation");
assert(approvedPresentationPhrase(rfeGuideInput) === "approved case presentation", "filed RFE inline copy stays approved case presentation");
assert(approvedPresentationPhrase() === "approved options presentation", "unlabeled inline presentation copy defaults to options");
assert(approvedPresentationHeading(familyGuideInput) === "Approved options presentation", "open-options heading still title-cases the options phrase");
assert(approvedPresentationHeading(rfeGuideInput) === "Approved case presentation", "filed RFE heading still title-cases the case phrase");
assert(/approved options presentation/.test(letterComposerGroundingCopy(familyGuideInput)), "open-options letter composer must not draft from the approved case presentation");
assert(/approved case presentation/.test(letterComposerGroundingCopy(rfeGuideInput)), "filed RFE letter composer stays the approved case presentation");
assert(/Cover letters do not invent a receipt number/.test(letterComposerGroundingCopy(familyGuideInput)), "open-options letter composer still refuses to invent a receipt");
assert(/approved options presentation/.test(letterReviewGroundingCopy(familyGuideInput)), "open-options letter review must not stay the approved case presentation");
assert(/approved case presentation/.test(letterReviewGroundingCopy(rfeGuideInput)), "filed RFE letter review stays the approved case presentation");
assert(/approved options presentation/.test(qaGroundedConversationCopy(familyGuideInput)), "open-options Q&A must not stay grounded in the approved case presentation");
assert(/approved case presentation/.test(qaGroundedConversationCopy(rfeGuideInput)), "filed RFE Q&A stays grounded in the approved case presentation");
assert(!/approved case presentation/.test(qaGroundedConversationCopy()), "unlabeled Q&A grounding defaults off the filed phrase");
assert(lettersNewSrcC24.includes("letterComposerGroundingCopy"), "letter composer subtitle must use dual-path presentation copy");
assert(!lettersNewSrcC24.includes("We'll produce a professional draft from the approved case presentation"), "letter composer must not hardcode approved case presentation");
const lettersIdSrc = readFileSync(join(process.cwd(), "src/app/app/letters/[id]/page.tsx"), "utf8");
assert(lettersIdSrc.includes("letterReviewGroundingCopy"), "letter review subtitle must use dual-path presentation copy");
assert(!lettersIdSrc.includes("Review every word against the approved case presentation"), "letter review must not hardcode approved case presentation");
assert(qaPageSrc.includes("qaGroundedConversationCopy"), "Q&A subtitle must use dual-path presentation copy");
assert(!qaPageSrc.includes("grounded in the approved case presentation"), "Q&A page must not hardcode approved case presentation");
assert(DEFAULT_PROMPTS.letter_writer.includes("APPROVED CASE PRESENTATION"), "letter writer prompt token stays APPROVED CASE PRESENTATION");
assert(DEFAULT_PROMPTS.assistant.includes("APPROVED CASE PRESENTATION"), "assistant prompt token stays APPROVED CASE PRESENTATION");
assert(familyForms[0]?.formNumber === "I-130", "goal-driven presentation grounding copy must not rerank I-485 ahead of I-130");
assert(presentation.hero.current_posture === "RFE notice needs review", "goal-driven presentation grounding copy must not convert the RFE fixture into open-options");
assert(requested.autoAssigned === false, "goal-driven presentation grounding copy must not auto-assign consultants");

const emptyReanalysisSnapshot = (overrides: Partial<CustomerFacingSnapshot["case"]> & { posture?: string; finding?: string; step?: string }): CustomerFacingSnapshot => ({
  capturedAt: "2026-08-26T00:00:00.000Z",
  case: {
    status: overrides.status ?? "analyzed",
    readinessScore: overrides.readinessScore ?? 40,
    evidenceAvailableScore: overrides.evidenceAvailableScore ?? 40,
    evidenceProcessedScore: overrides.evidenceProcessedScore ?? 40,
    actionReadinessScore: overrides.actionReadinessScore ?? 40,
    conflictsJson: overrides.conflictsJson ?? "[]",
  },
  issues: overrides.finding
    ? [{
        id: "issue-1",
        issueType: "other",
        caseYear: null,
        title: overrides.finding,
        description: "",
        expectedCents: null,
        receivedCents: null,
        differenceCents: null,
        confidence: "medium",
        priority: "medium",
        state: "review",
        nextAction: "REVIEW_ANALYSIS",
        uscisBasis: "",
        evidenceJson: "[]",
        itemKind: "issue",
        evidenceStatus: "needs_verification",
        evidenceStrength: "limited",
        conclusion: "",
        unclearJson: "[]",
        explanationsJson: "[]",
        altAction: "",
      }]
    : [],
  pathSteps: overrides.step
    ? [{ id: "step-1", sortOrder: 0, title: overrides.step, description: "", actionKey: "REVIEW_ANALYSIS", status: "current" }]
    : [],
  actionNodes: [],
  reconstruction: {
    summary: "Summary",
    currentPosition: overrides.posture ?? "RFE notice needs review",
    timelineJson: "[]",
    pendingActionsJson: "[]",
    confidence: "needs_verification",
  },
  canonical: {
    approvedStateJson: JSON.stringify({
      version: 1,
      reason: "analysis",
      pipeline_config_version: "test",
      evidence_snapshot_hash: "",
      status: "analyzed",
      readiness_score: overrides.readinessScore ?? 40,
      evidence_available_score: 40,
      evidence_processed_score: 40,
      action_readiness_score: 40,
      presentation: {
        hero: {
          current_posture: overrides.posture ?? "RFE notice needs review",
          status: "analyzed",
          next_best_action: { title: "Upload the USCIS notice", action_key: "UPLOAD_NOTICE" },
          nearest_deadline: null,
          evidence_strength: "Limited",
          professional_review_recommended: false,
        },
        what_this_means: { summary: "Summary", unresolved_count: 0, pending_actions: [], unknowns: [], evidence_gate_status: null, conflicts: [] },
        timeline: [],
        findings: overrides.finding ? [{ id: "issue-1", title: overrides.finding, group: "issue", state: "review", evidence_status: "needs_verification", evidence_strength: "limited", conclusion: "", next_action: "REVIEW_ANALYSIS" }] : [],
        deadlines: [],
        actions: [],
        evidence: [],
        professional_review: null,
      },
      analysis_plan: null,
    }),
    stateJson: "{}",
    versionId: "v1",
    evidenceSnapshotHash: "",
  },
  presentation: null,
  presentationIds: [],
  latestVersion: null,
});
const currentReanalysisSnap = emptyReanalysisSnapshot({ finding: "Respond to the RFE", step: "Upload the notice" });
const proposedReanalysisSnap = emptyReanalysisSnapshot({
  posture: "RFE response in progress",
  finding: "Add the missing civil documents",
  step: "Draft the RFE response",
  readinessScore: 55,
});
const reanalysisDiff = compareCustomerSnapshots(currentReanalysisSnap, proposedReanalysisSnap);
assert(reanalysisDiff.changed, "admin re-analysis compare must detect a changed staff snapshot");
assert(reanalysisDiff.posture.current === "RFE notice needs review", "admin re-analysis compare must keep the current RFE posture");
assert(reanalysisDiff.posture.proposed === "RFE response in progress", "admin re-analysis compare must show the proposed posture");
assert(reanalysisDiff.findingsAdded.includes("Add the missing civil documents"), "admin re-analysis compare must list added findings");
assert(!reanalysisVisibleTo({ visibleToCustomer: false, visibleToConsultant: false, status: "completed" }, "customer"), "completed hidden drafts are not customer-visible");
assert(reanalysisVisibleTo({ visibleToCustomer: true, visibleToConsultant: false, status: "shared" }, "customer"), "shared customer visibility is on after share");
assert(!reanalysisVisibleTo({ visibleToCustomer: true, visibleToConsultant: true, status: "shared", overriddenAt: "2026-08-26" }, "customer"), "override hides the shared staff preview");
assert(!reanalysisVisibleTo({ visibleToCustomer: true, visibleToConsultant: false, status: "completed" }, "consultant"), "consultant does not see a customer-only share");
const v2Plan = readFileSync(join(process.cwd(), "ImmigrationonmeV2.md"), "utf8");
assert(v2Plan.includes("Mailing packet without filing"), "ImmigrationonmeV2 must plan the mailing-packet track");
assert(v2Plan.includes("Prompt dual-path"), "ImmigrationonmeV2 must plan the prompt dual-path track");
assert(v2Plan.includes("Admin case re-analysis"), "ImmigrationonmeV2 must plan the admin re-analysis track");
assert(v2Plan.includes("Do not start"), "ImmigrationonmeV2 must keep USCIS filing and legal representation parked");
const adminNavSrc = readFileSync(join(process.cwd(), "src/app/admin/layout.tsx"), "utf8");
assert(adminNavSrc.includes("/admin/reanalysis"), "admin nav must include the case re-analysis section");
assert(adminCaseSrc.includes("Re-run analysis"), "admin case page must restore the Re-run analysis CTA");
assert(adminCaseSrc.includes("startAdminReanalysisFromCaseAction"), "admin Re-run analysis CTA must start the staff draft flow");
assert(!customerCaseSrc.includes("Re-run analysis"), "customer case page must not show Re-run analysis");
assert(!customerCaseSrc.includes("reanalyzeCaseAction"), "customer case page must not call reanalyzeCaseAction");
assert(!customerCaseSrc.includes("startAdminReanalysis"), "customer case page must not start admin re-analysis");
const consultantCaseViewSrc = readFileSync(join(process.cwd(), "src/app/consultant/clients/[id]/cases/[caseId]/page.tsx"), "utf8");
assert(!consultantCaseViewSrc.includes("Re-run analysis"), "consultant case page must not show Re-run analysis");
assert(!consultantCaseViewSrc.includes("reanalyzeCaseAction"), "consultant case page must not call reanalyzeCaseAction");
const reanalyzeSrc = readFileSync(join(process.cwd(), "src/actions/case.ts"), "utf8");
const reanalyzeFnSrc = reanalyzeSrc.slice(
  reanalyzeSrc.indexOf("export async function reanalyzeCaseAction"),
  reanalyzeSrc.indexOf("export async function clarifyAnswerAction"),
);
assert(reanalyzeFnSrc.includes('hasAdminArea(user, "admin.cases")'), "reanalyzeCaseAction must be admin-only");
assert(!reanalyzeFnSrc.includes("userId !== user.id"), "reanalyzeCaseAction must not stay owner-gated for customers");
assert(reanalyzeFnSrc.includes("/admin/reanalysis"), "reanalyzeCaseAction must open the admin re-analysis lab");
const adminReanalysisActionSrc = readFileSync(join(process.cwd(), "src/actions/admin-reanalysis.ts"), "utf8");
const shareFnSrc = adminReanalysisActionSrc.slice(
  adminReanalysisActionSrc.indexOf("shareAdminReanalysisAction"),
  adminReanalysisActionSrc.indexOf("overrideAdminReanalysisAction"),
);
assert(!shareFnSrc.includes("overrideCustomerOutputWithSnapshot"), "share must not override the customer output");
assert(!shareFnSrc.includes("finalizeCaseVersion"), "share must not write canonical approved state");
assert(adminReanalysisActionSrc.includes("overrideCustomerOutputWithSnapshot"), "override must write the proposed snapshot as the customer output");
const orchSrc = readFileSync(join(process.cwd(), "src/lib/ai/orchestrator.ts"), "utf8");
assert(orchSrc.includes('persistMode?: "live" | "draft"'), "analysis pipeline must support a draft persist mode");
assert(orchSrc.includes("if (needsConsultant && !draft)"), "draft re-analysis must not notify or auto-assign consultants");
assert(orchSrc.includes("providerIds"), "draft re-analysis must accept selected AI providers");
assert(presentationStepCta("RERUN_ANALYSIS", "case-1") === null, "path-step CTAs must not restore re-run analysis for customers");
assert(versionReasonLabel("admin_override", rfeGuideInput) === "Admin replaced the customer output", "filed override version reason is labeled");
assert(versionReasonLabel("admin_override", familyGuideInput) === "Admin replaced the options output", "open-options override version reason is labeled");
assert(versionReasonLabel("analysis") === "Full case review", "admin re-analysis must not change unlabeled analysis version labels");
assert(familyForms[0]?.formNumber === "I-130", "admin re-analysis must not rerank I-485 ahead of I-130");
assert(presentation.hero.current_posture === "RFE notice needs review", "admin re-analysis must not convert the RFE fixture into open-options");
assert(requested.autoAssigned === false, "admin re-analysis must not auto-assign consultants");

const termsPage = LEGAL_CONTENT_PAGES.find((page) => page.slug === "terms-of-service");
const privacyPage = LEGAL_CONTENT_PAGES.find((page) => page.slug === "privacy-policy");
const agreementPage = LEGAL_CONTENT_PAGES.find((page) => page.slug === "user-agreement");
assert(termsPage && privacyPage && agreementPage, "legal pages must include terms, privacy, and the registration agreement");
for (const page of LEGAL_CONTENT_PAGES) {
  for (const marker of LEGAL_DRAFT_MARKERS) {
    assert(!page.body.includes(marker), `${page.slug} must not publish draft marker: ${marker}`);
  }
}
assert(termsPage.body.includes("Nueve Technologies LLC"), "terms must name Nueve Technologies LLC");
assert(termsPage.body.includes("Nueve Parties"), "revised terms must define Nueve Parties");
assert(termsPage.body.includes("American Arbitration Association"), "revised terms must name AAA arbitration");
assert(termsPage.body.includes("Owner & Platform Protection Revision"), "terms must publish the revised last-updated label");
assert(termsPage.body.includes("Harris County, Texas"), "terms must include Harris County venue");
assert(termsPage.body.includes("legal@immigrationonme.com"), "terms must include the legal contact");
assert(privacyPage.body.includes("privacy@immigrationonme.com"), "privacy policy must include the privacy contact");
assert(/does not sell customer immigration documents/i.test(privacyPage.body), "privacy policy must prohibit sale of immigration case information");
assert(privacyPage.body.includes("Owner & Platform Protection Revision"), "privacy policy must publish the revised last-updated label");
assert(agreementPage.title.includes("Registration, Consent"), "user agreement title must match the attached registration agreement");
assert(agreementPage.body.includes("each acknowledgment is recorded separately"), "registration agreement must keep acknowledgments separate");
assert(agreementPage.body.includes("electronically sign"), "registration agreement must treat account creation as the electronic signature");
assert(agreementPage.body.includes("Nueve Parties"), "revised registration agreement must define Nueve Parties");
assert(agreementPage.body.includes("American Arbitration Association"), "revised registration agreement must name AAA arbitration");
assert(!agreementPage.body.includes("Suggested user-facing label"), "registration agreement must not publish the UI implementation table");
const seedLegalSrc = readFileSync(join(process.cwd(), "prisma/seed.ts"), "utf8");
assert(seedLegalSrc.includes("LEGAL_CONTENT_PAGES"), "seed must publish the attached legal documents");
assert(!seedLegalSrc.includes("Replace this placeholder text with your reviewed terms"), "seed must not keep placeholder terms");
const registerFormSrc = readFileSync(join(process.cwd(), "src/components/auth-forms.tsx"), "utf8");
assert(registerFormSrc.includes("REGISTRATION_CONSENTS"), "register form must render the separate registration consents");
assert(registerFormSrc.includes("item.formName"), "register form must submit each consent under its own field name");
assert(REQUIRED_REGISTRATION_CONSENT_KEYS.join(",") === "agreement_bundle,core_processing,ai_processing,service_providers", "registration must require the four attached consents");
assert(registerFormSrc.includes("electronic signature"), "register form must state that creating an account is the electronic signature");
assert(!/name=["']agree["']/.test(registerFormSrc), "register form must not collapse consents into one agree checkbox");
assert(registerFormSrc.includes("startGoogleSignupAction"), "Google signup must collect consents before OAuth");
assert(registerFormSrc.includes("completeGoogleRegisterAction"), "pending Google signup must finish on the consent form");
const authSrc = readFileSync(join(process.cwd(), "src/actions/auth.ts"), "utf8");
assert(authSrc.includes("parseRegistrationConsents"), "registerAction must require parsed registration consents");
assert(authSrc.includes("recordRegistrationLegal"), "registerAction must record per-control consents");
assert(!authSrc.includes('agree: z.literal("on"'), "registerAction must not accept a single agree checkbox");
const googleCallbackSrc = readFileSync(join(process.cwd(), "src/app/api/auth/google/callback/route.ts"), "utf8");
assert(googleCallbackSrc.includes("hasRequiredRegistrationConsents"), "Google callback must require registration consents for new users");
assert(googleCallbackSrc.indexOf("hasRequiredRegistrationConsents") < googleCallbackSrc.indexOf("db.user.create"), "Google callback must not create a user before consent checks");
assert(googleCallbackSrc.includes("register?google=pending"), "Google callback must send new users without consents back to registration");
const missingConsents = new FormData();
assert(parseRegistrationConsents(missingConsents).ok === false, "registration without consents must fail");
const requiredConsents = new FormData();
for (const item of REGISTRATION_CONSENTS.filter((item) => item.required)) requiredConsents.set(item.formName, "on");
const parsedRequired = parseRegistrationConsents(requiredConsents);
assert(parsedRequired.ok === true, "registration with the four required consents must succeed");
assert(parseRegistrationConsents(requiredConsents, { asConsultant: true }).ok === false, "consultant registration must also require the consultant agreement");
assert(parseOauthConsentsCookie(JSON.stringify({ version: "2026-08-26", grants: parsedRequired.ok ? parsedRequired.grants : {} })) !== null, "oauth consent cookie must accept required grants");
assert(parseOauthConsentsCookie(JSON.stringify({ version: "2026-08-26", grants: { agreement_bundle: true } })) === null, "oauth consent cookie must reject incomplete grants");
assert(versionReasonLabel("analysis") === "Full case review", "legal consent work must not change unlabeled analysis version labels");
assert(familyForms[0]?.formNumber === "I-130", "legal consent work must not rerank I-485 ahead of I-130");
assert(presentation.hero.current_posture === "RFE notice needs review", "legal consent work must not convert the RFE fixture into open-options");
assert(requested.autoAssigned === false, "legal consent work must not auto-assign consultants");

const presentationLayoutSrc = readFileSync(join(process.cwd(), "src/components/case-presentation-view.tsx"), "utf8");
const analysisLayoutSrc = readFileSync(join(process.cwd(), "src/components/case-analysis-view.tsx"), "utf8");
const customerCaseLayoutSrc = readFileSync(join(process.cwd(), "src/app/app/cases/[id]/page.tsx"), "utf8");
const heroSlice = presentationLayoutSrc.slice(
  presentationLayoutSrc.indexOf("Next best action"),
  presentationLayoutSrc.indexOf("What this means"),
);
assert(!heroSlice.includes("Matching USCIS form"), "matching form card must not sit in the analysis hero");
assert(!heroSlice.includes("Matching USCIS letter"), "matching letter card must not sit in the analysis hero");
assert(!heroSlice.includes("Matching evidence"), "matching evidence card must not sit in the analysis hero");
assert(presentationLayoutSrc.includes("Related USCIS materials"), "matching materials must be grouped as related reference");
assert(presentationLayoutSrc.includes("export function MatchingUscisMaterials"), "matching materials must be a reusable bottom section");
assert(analysisLayoutSrc.includes("{matchingMaterials}"), "analysis must render matching materials after the presentation");
assert(analysisLayoutSrc.indexOf("{matchingMaterials}") > analysisLayoutSrc.indexOf("<CasePresentationView"), "matching materials must render after the approved presentation");
assert(analysisLayoutSrc.lastIndexOf("{matchingMaterials}") > analysisLayoutSrc.lastIndexOf("id=\"case-documents\""), "fallback analysis must keep matching materials at the bottom");
assert(customerCaseLayoutSrc.indexOf("<CaseAnalysisView") < customerCaseLayoutSrc.indexOf("<CaseComments"), "situation discussion must stay after the analysis, including related materials");
assert(familyForms[0]?.formNumber === "I-130", "matching-materials layout must not rerank I-485 ahead of I-130");
assert(presentation.hero.current_posture === "RFE notice needs review", "matching-materials layout must not convert the RFE fixture into open-options");
assert(requested.autoAssigned === false, "matching-materials layout must not auto-assign consultants");

const vawaBrief = buildSituationBrief(VAWA_PRIMA_FACIE_FIXTURE);
assert(vawaBrief.caseType === "VAWA self-petition", `VAWA fixture case type should be VAWA self-petition, got ${vawaBrief.caseType}`);
assert(vawaBrief.primaryForm === "I-360", `VAWA fixture primary form should be I-360, got ${vawaBrief.primaryForm}`);
assert(vawaBrief.relatedForm === "I-485", `VAWA fixture related form should be I-485, got ${vawaBrief.relatedForm}`);
assert(vawaBrief.relatedProcess === "Adjustment of Status", "VAWA fixture related process should be adjustment of status");
assert(vawaBrief.doNotRecommendNewPathway === true, "VAWA fixture must not recommend a new pathway");
assert(vawaBrief.lockFamilyOpenOptionsI130 === false, "VAWA fixture must not lock the family open-options I-130 path");
assert(/prima facie/i.test(vawaBrief.customerQuestion), `VAWA fixture question should be about the prima facie notice, got ${vawaBrief.customerQuestion}`);
assert(vawaBrief.situationBullets.every((item) => !/\[Clarified/i.test(item.text)), "situation brief bullets must not include interview tags");
assert(vawaBrief.situationBullets.every((item) => !item.text.includes(" and ") || item.text.split(" ").length < 18), "situation brief bullets should stay one idea each");
assert(vawaBrief.verifiedFacts.some((item) => /I-360/i.test(item.text)), "VAWA fixture should verify the I-360 filing from documents");
assert(vawaBrief.verifiedFacts.some((item) => /prima facie/i.test(item.text)), "VAWA fixture should verify the prima facie determination from documents");
assert(vawaBrief.reportedFacts.some((item) => /I-485/i.test(item.text)), "VAWA fixture should keep the I-485 filing as reported until a receipt is reviewed");
assert(vawaBrief.unknownFacts.some((item) => /I-485 receipt/i.test(item.text)), "VAWA fixture should leave the I-485 receipt unknown");
assert(vawaBrief.situationBullets.length >= 8 && vawaBrief.situationBullets.length <= 15, `VAWA situation bullets should stay 8-15, got ${vawaBrief.situationBullets.length}`);

const familyBrief = buildSituationBrief(FAMILY_OPEN_OPTIONS_FIXTURE);
assert(familyBrief.primaryForm === "I-130", `family open-options brief should lock I-130, got ${familyBrief.primaryForm}`);
assert(familyBrief.lockFamilyOpenOptionsI130 === true, "family open-options with nothing filed should keep the I-130 lock");
assert(familyBrief.doNotRecommendNewPathway === false, "family open-options may still discuss a first petition");
assert(familyForms[0]?.formNumber === "I-130", "v5 situation brief must not rerank I-485 ahead of I-130 for family open-options");

const rfeBrief = buildSituationBrief(RFE_I485_FIXTURE);
assert(rfeBrief.primaryForm === "I-485", `RFE brief should lock I-485, got ${rfeBrief.primaryForm}`);
assert(rfeBrief.lockFamilyOpenOptionsI130 === false, "RFE brief must not lock a family I-130 path");
assert(rfeBrief.doNotRecommendNewPathway === true, "RFE brief must prefer the existing notice over a new pathway");
assert(presentation.hero.current_posture === "RFE notice needs review", "v5 situation brief must not convert the RFE fixture into open-options");

assert(stripClarifiedNarrative("I am in the United States.\n\n[Clarified evidence] What happened: I filed I-360.") === "I am in the United States.", "clarified interview lines must be stripped from customer situation text");
assert(presentationWhatThisMeansSummary("[Clarified] My USCIS notice: an RFE.") === OPTIONS_ORGANIZING_SUMMARY, "what this means must not display clarified interview tags");
assert(reportedFactsFromAnswer("I already filed Form I-485 and received a prima facie notice.").some((item) => item.key === "form_type" && item.value === "I-485"), "clarify answers should record reported form facts without rewriting the situation");
assert(PROMPT_VERSION.includes("v32"), "v5 situation brief must not bump analysis prompt version");
assert(requested.autoAssigned === false, "v5 situation brief must not auto-assign consultants");

const caseActionSrc = readFileSync(join(process.cwd(), "src/actions/case.ts"), "utf8");
const clarifyFn = caseActionSrc.slice(caseActionSrc.indexOf("export async function clarifyAnswerAction"), caseActionSrc.indexOf("export async function createOptionsCaseFromQaAction"));
assert(!clarifyFn.includes("situationLine"), "clarify answers must not be appended onto the customer situation narrative");
assert(clarifyFn.includes("reportedFactsFromAnswer"), "clarify answers must become user-reported facts");
assert(clarifyFn.includes('provenance: "USER_REPORTED"'), "clarify facts must be stored as USER_REPORTED");

const orchestratorRebuildSrc = readFileSync(join(process.cwd(), "src/lib/ai/orchestrator.ts"), "utf8");
assert(
  orchestratorRebuildSrc.indexOf("await rebuildCaseEvidenceState") > 0 &&
    orchestratorRebuildSrc.indexOf("await rebuildCaseEvidenceState") < orchestratorRebuildSrc.indexOf("await snapshotAuthorityForPlan"),
  "pipeline must lock the situation brief before authority retrieval",
);
assert(readFileSync(join(process.cwd(), "src/lib/evidence/case-state.ts"), "utf8").includes("buildSituationBrief"), "evidence reconstruction must persist the situation brief");
assert(readFileSync(join(process.cwd(), "prisma/schema.prisma"), "utf8").includes("briefJson"), "situation brief must persist on case reconstruction");

const vawaUploads = (VAWA_PRIMA_FACIE_FIXTURE.documents ?? []).map((doc) =>
  compileImmigrationEvidence({
    id: doc.fileName,
    fileName: doc.fileName,
    text: doc.text ?? "",
    declaredType: "identity_document",
  }),
);
const vawaUploadTypes = vawaUploads.map((item) => item.documentType);
assert(new Set(vawaUploadTypes).size === 4, `VAWA uploads must classify as four different types, got ${vawaUploadTypes.join(", ")}`);
assert(vawaUploadTypes.includes("uscis_i360_receipt_notice"), "I-360 receipt must classify as an I-360 receipt notice");
assert(vawaUploadTypes.includes("uscis_vawa_prima_facie_notice"), "prima facie notice must classify as a VAWA prima facie notice");
assert(vawaUploadTypes.includes("relationship_civil_document"), "marriage certificate must classify as a relationship/civil document");
assert(vawaUploadTypes.includes("personal_declaration"), "personal declaration must classify as a personal declaration");
assert(!vawaUploadTypes.includes("identity_document"), "VAWA supporting uploads must not collapse into identity");
assert(
  vawaUploads.every((item, index) => {
    const classified = classifyUploadedDocument({
      fileName: VAWA_PRIMA_FACIE_FIXTURE.documents?.[index]?.fileName,
      text: VAWA_PRIMA_FACIE_FIXTURE.documents?.[index]?.text,
      declaredType: "identity_document",
      docKind: "identity",
    });
    return classified.documentType === item.documentType && classified.docKind !== "identity";
  }),
  "content classification must remap identity upload kinds to the matching catalog kind",
);

const passportClassified = compileImmigrationEvidence({
  id: "passport",
  fileName: "passport.pdf",
  text: "U.S. Passport. Biographic page.",
  declaredType: "identity_document",
});
assert(passportClassified.documentType === "identity_document", `passport must stay an identity document, got ${passportClassified.documentType}`);
assert(immigrationDocumentTypeLabel(passportClassified.documentType) === "Identity & Entry Document", "passport label must be identity and entry");

const i94Classified = compileImmigrationEvidence({
  id: "i94",
  fileName: "i-94.pdf",
  text: "I-94 Arrival/Departure Record. Admitted January 12, 2024.",
  declaredType: "identity_document",
});
assert(i94Classified.documentType === "admission_entry_record", `I-94 must classify as an admission/entry record, got ${i94Classified.documentType}`);

const genericNotice = compileImmigrationEvidence({
  id: "generic-i797",
  fileName: "notice-of-action.txt",
  text: "Form I-797C, Notice of Action. Receipt Number: EAC1234567890. This notice of action does not identify a specific form receipt.",
});
assert(genericNotice.documentType === "i797_notice", `generic I-797 must stay a notice of action, got ${genericNotice.documentType}`);

assert(resolveImmigrationDocumentType({ fileName: "marriage-certificate.pdf", text: "Marriage Certificate.", declaredType: "identity_document" }) === "relationship_civil_document", "declared identity must not beat a marriage certificate");
assert(vawaBrief.verifiedFacts.some((item) => /marriage certificate/i.test(item.text)), "VAWA brief must verify the marriage certificate from its document type");
assert(vawaBrief.verifiedFacts.some((item) => /personal declaration/i.test(item.text)), "VAWA brief must verify the personal declaration from its document type");
assert(VAWA_PRIMA_FACIE_FIXTURE.documents?.every((doc) => doc.documentType && doc.documentType !== "identity_document"), "VAWA fixture documents must keep distinct classified types");
assert(familyForms[0]?.formNumber === "I-130", "v5 document classification must not rerank I-485 ahead of I-130 for family open-options");
assert(presentation.hero.current_posture === "RFE notice needs review", "v5 document classification must not convert the RFE fixture into open-options");
assert(PROMPT_VERSION.includes("v32"), "v5 document classification must not bump analysis prompt version");
assert(requested.autoAssigned === false, "v5 document classification must not auto-assign consultants");

const compilerSrc = readFileSync(join(process.cwd(), "src/lib/evidence/compiler.ts"), "utf8");
const processingSrc = readFileSync(join(process.cwd(), "src/lib/evidence/document-processing.ts"), "utf8");
const caseStateSrc = readFileSync(join(process.cwd(), "src/lib/evidence/case-state.ts"), "utf8");
assert(compilerSrc.includes("resolveImmigrationDocumentType"), "compiler must classify from document contents before declared identity");
assert(processingSrc.includes("classifyUploadedDocument"), "document processing must persist the content-classified type and catalog kind");
assert(caseStateSrc.includes("classifyUploadedDocument"), "reconstruction must reclassify extracted documents before building the situation brief");
assert(readFileSync(join(process.cwd(), "src/lib/ai/prompts.ts"), "utf8").includes(`PROMPT_VERSION = "${PROMPT_VERSION}"`), "document classification must not bump analysis prompt version");

console.log("v3.2 immigration evidence check passed");
console.log(`- ${receipt.documentType}: ${receipt.facts.length} facts, ${receipt.events.length} events`);
console.log(`- ${rfe.documentType}: ${rfe.facts.length} facts, ${rfe.events.length} events`);
console.log(`- ${noid.documentType}, ${biometrics.documentType}, ${approval.documentType}: extra notice fixtures passed`);
console.log(`- universal extraction: ${universalRfe.facts.length} labeled facts, ${universalRfe.instructions_and_conditions.length} instructions`);
console.log(`- reconciled: ${reconciled.facts.length} facts, ${reconciled.events.length} events, ${reconciled.crossDocumentRelationships.length} cross-document link(s)`);
console.log(`- evidence gate: ${gate.status}, can analyze: ${gate.canAnalyze ? "yes" : "no"}`);
console.log("- action intelligence: case record, notice, and deadline satisfied from evidence");
console.log("- prompts: analyst, reviewer, and presenter are evidence-gate aware");
console.log(`- readiness split: available ${readiness.evidenceAvailableScore}, processed ${readiness.evidenceProcessedScore}, action ${readiness.actionReadinessScore}`);
console.log(`- letter guard: replaced ${guardedLetter.findings.length} unsupported value(s)`);
console.log(`- presentation contract: ${presentation.hero.current_posture}, next ${presentation.hero.next_best_action?.action_key}, ${presentation.findings.length} findings`);
console.log("- presentation UX: action statuses and evidence-gate labels are customer-facing");
console.log(`- case list: ${listFromContract.posture}, next ${listFromContract.nextActionTitle}`);
console.log("- case report: presentation contract sections are used for the printable report");
console.log("- v41 B5: letters, notices, and Q&A share approved presentation blocks");
console.log(`- v4 A10: analysis pipeline follows the case plan (${lowPlan.case_complexity}, skip process=${!lowDecisions.processDocuments}, runtime review=${runtimeDecisions.independentReview})`);
console.log(`- v4 A11: canonical approved state v${approvedState.version} stores ${approvedState.presentation?.hero.current_posture} and the analysis plan`);
console.log(`- v4 A12: ${selected?.source} approved state wins over stale stored/live presentations (${listFromCanonical.posture}, ${caseListVersionLine(listFromCanonical)})`);
console.log(`- v4 C2: grounded options ${marriageOptions.issues[0]?.title}, F-1 ${rankedStudent[0]?.reference}, RFE ${rfeInquiry.mode}/${rankedRfe[0]?.reference}`);
console.log(`- v4 C3: unified authority ${findAuthorityForKnowledge(knowledgeCatalog[2], [i130Authority])?.key}, reconstruction cites official material, no preliminary/no-docs customer framing`);
console.log(`- v4 C4: goal-driven next step ${marriageOptions.pathSteps[0]?.action_key}, I-589 consultant ${evaluateConsultantReferral({ text: "I want to stay in the United States.", sources: [knowledgeCatalog.find((item) => item.reference === "Form I-589")!] }).level}`);
console.log(`- v4 C5: follow-up ${nextOfficialQuestion?.key}, learned ${rankedOpenQuestions.map((item) => item.key).join(" > ")}`);
console.log(`- v4 C6: Q&A follow-up ${askedMarriageFollowUp}, next ${askedFollowUpFromAssistant(qaMarriageNext)}`);
console.log(`- v4 C7: remaining next step ${nextStepAfterIdentity}, follow-up ${askedFollowUpFromAssistant(qaAfterIdentity)}`);
console.log(`- v4 C8: guest limit ${guestEntitlement.questionLimit}, free ${freeEntitlement.questionLimit}, plus personalized=${plusEntitlement.personalized}, pro consultant=${proEntitlement.consultantReferral}`);
console.log(`- v4 C9: guest steps ${guestSuggestions.maxPathSteps}, free steps ${freeSuggestions.maxPathSteps}/${freeSuggestions.maxClarifyAnswers} clarify, plus personalized=${plusSuggestions.personalized}, pro consultant=${proSuggestions.consultantReferral}`);
console.log(`- v4 C10: guest request=${guestMatch.canRequest}, pro request=${proMatch.canRequest}, autoAssigned=${requested.autoAssigned}, sharesFiles=${customerMatchSharesFiles(requested.status)}`);
console.log(`- v4 C11: family ${familyForms[0]?.formNumber}, student ${studentForms[0]?.formNumber}, asylum ${asylumForms[0]?.formNumber}, RFE ${rfeForms[0]?.formNumber}, marriage action ${marriageOptions.pathSteps.find((step) => step.action_key === "PREPARE_FORM")?.action_key}`);
console.log(`- v4 C12: family ${familyLetters[0]?.kind}, student ${studentLetters[0]?.kind}, asylum ${asylumLetters[0]?.kind}, RFE ${rfeLetters[0]?.kind}, plus remaining ${letterGenerationAllowed({ canGenerate: true, used: 2, limit: 3 }).remaining}`);
console.log(`- v4 C13: family ${familyDocs[0]?.kind}, student ${studentDocs.find((item) => item.kind === "status_record")?.kind}, asylum ${asylumDocs.find((item) => item.kind === "declaration")?.kind}, RFE ${rfeDocs[0]?.kind}, free remaining ${documentUploadAllowed({ canUpload: true, used: 4, limit: 5 }).remaining}`);
console.log(`- v4 C14: notices skip=${!openNoticeCopy.uploadPrimary}, deadlines auto=${shouldExpectAutomaticDeadlines({ inquiryMode: "open_options" })}, account optional=${Boolean(openAccount.optionalBanner)}, RFE notices primary=${rfeNoticeCopy.uploadPrimary}`);
console.log(`- v4 C15: hero ${PUBLIC_HOME_FEATURES[0]?.title}, catalog ${featuresRankedBeforeNotices()[0]} before notices, closing ${PUBLIC_CLOSING.optionsCta.label}`);
console.log(`- v4 C16: options ${optionsReadinessCopy.overallLabel} expected=${optionsReadinessPolicy.documentsExpected} empty=${optionsEmptyReadiness.actionReadinessScore} identity=${optionsIdentityReadiness.actionReadinessScore}, RFE action=${readiness.actionReadinessScore}`);
console.log(`- v4 C17: open tip ${openRecordTip.includes("I-130") ? "I-130" : "missing"}, chase receipt=${shouldChaseNoticeInGuide("receipt status", familyGuideInput)}, RFE chrome ${guideWidgetChrome(rfeGuideInput).title}`);
console.log(`- v4 C18: nav docs-before-notices=${navHrefsBefore(openNav, "/app/notices").includes("/app/documents")}, options report=${openChrome.reportTitle}, RFE notice=${rfeChrome.evidenceLabel}`);
console.log(`- v4 C19: discussion ${openDiscussion.heading}, closing ${openClosing.notificationTitle("IMM-1").split(" ")[0]}, fallback ${openFallbackSteps[0]?.action_key}`);
console.log(`- v4 C20: open ${openVersion.recordHeading}/${versionReasonLabel("analysis", familyGuideInput)}, RFE ${rfeVersion.recordHeading}/${versionReasonLabel("analysis", rfeGuideInput)}`);
console.log(`- v4 C21: open ${openIntake.pageTitle}/${openIntake.listCta}, RFE ${rfeIntake.pageTitle}/${rfeIntake.listCta}`);
console.log(`- v4 C22: open ${resolveCasesListCopy(familyGuideInput).pageTitle}/${surfaceNoun(familyGuideInput)}, RFE ${resolveCasesListCopy(rfeGuideInput).pageTitle}/${surfaceNoun(rfeGuideInput)}`);
console.log(`- v4 C23: open ${thisSurfacePhrase(familyGuideInput)}/${resolveConsultantWorkspaceCopy([familyGuideInput]).heading}, RFE ${thisSurfacePhrase(rfeGuideInput)}/${resolveConsultantWorkspaceCopy([rfeGuideInput]).heading}`);
console.log(`- v4 C24: open ${presentationOrganizingSummary(familyGuideInput).slice(0, 24)}, RFE ${presentationOrganizingSummary(rfeGuideInput).slice(0, 18)}`);
console.log(`- v4 C25: open ${analysisTaskLabel("PRESENT_APPROVED_STATE", familyGuideInput)}, RFE ${analysisTaskLabel("PRESENT_APPROVED_STATE", rfeGuideInput)}`);
console.log(`- v4 C26: open ${openGuideItem.slice(0, 10)}, empty ${guideAccountEmptyLine(familyGuideInput).slice(0, 18)}, RFE ${rfeGuideItem.slice(0, 5)}`);
console.log(`- v4 C27: open ${recordRefLabel(familyGuideInput, 11)}, RFE ${recordRefLabel(rfeGuideInput, 1)}`);
console.log(`- v4 C28: open ${openClarify.placeholder.includes("receipt is not required") ? "no receipt" : "missing"}, RFE ${rfeClarify.placeholder.includes("receipt numbers") ? "receipts" : "missing"}`);
console.log(`- v4 C29: empty ${guidePrimaryAction(emptyOpenGuide).label}, hint ${guideStatusHint("receipt status", familyGuideInput).includes("This situation") ? "situation" : "missing"}, RFE ${guidePrimaryAction(emptyRfeGuide).label}`);
console.log(`- v4 C30: open ${approvedPresentationPhrase(familyGuideInput)}, RFE ${approvedPresentationPhrase(rfeGuideInput)}`);
console.log(`- admin re-analysis: compare changed=${reanalysisDiff.changed}, share hidden=${!reanalysisVisibleTo({ visibleToCustomer: false, visibleToConsultant: false, status: "completed" }, "customer")}`);
console.log(`- v5 P1: VAWA brief ${vawaBrief.primaryForm}/${vawaBrief.relatedForm}, family lock I-130=${familyBrief.lockFamilyOpenOptionsI130}, RFE ${rfeBrief.primaryForm}`);
console.log(`- v5 P2: VAWA types ${vawaUploadTypes.join(", ")}, passport ${passportClassified.documentType}, I-94 ${i94Classified.documentType}`);
