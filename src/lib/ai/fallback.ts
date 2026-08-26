import "server-only";
import {
  authorityQueriesForInquiry,
  buildOpenOptionsAnalysis,
  classifyImmigrationInquiry,
  evaluateConsultantReferral,
  INQUIRY_MODES,
} from "../immigration-inquiry";
import { retrieveUnifiedAuthority } from "../authority-retrieval";
import { fallbackEvidenceLine, resolveFallbackPathSteps } from "../goal-conversation";
import { loadBoostsForNarrative, recordSuggestionEvent } from "../goal-suggestion-store";
import type { KnowledgeRecord } from "../knowledge-retrieval";

type Json = Record<string, unknown>;

export type FallbackConflict = { topic: string; description: string; resolution: string };

export type FallbackResult = {
  facts: Json;
  issues: Json[];
  pathSteps: { title: string; description: string; action_key: string }[];
  conflicts: FallbackConflict[];
};

export type DocInfo = { docKind: string; readable: boolean };

const USCIS_FORM_RE = /\b(?:I|N|EOIR|G)-?\d{2,4}[A-Z]?\b/g;
const RECEIPT_RE = /\b[A-Z]{3}\d{10}\b/g;
const NOTICE_RE = /\b(RFE|NOID|NOIR|NOIT|I-?797C?|BIOMETRICS|INTERVIEW|DENIAL|APPROVAL)\b/gi;

function uniq(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function yearsFrom(text: string): number[] {
  return uniq(text.match(/\b20\d{2}\b/g) ?? [])
    .map(Number)
    .filter((year) => year >= 2000 && year <= 2100)
    .sort();
}

function detectDeadlines(text: string): string[] {
  const out: string[] = [];
  const dateMatches = text.match(/\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2},?\s+20\d{2}\b/gi) ?? [];
  out.push(...dateMatches);
  const days = text.match(/\b(?:respond|response|reply|submit|file)[^\n.]{0,50}?\b(?:within|by)\s+\d{1,3}\s+days?\b/gi) ?? [];
  out.push(...days);
  return uniq(out);
}

function evidenceLine(docs: DocInfo[], inquiryMode: string): string {
  return fallbackEvidenceLine(docs, { inquiryMode });
}

async function loadRankedKnowledge(query: string, inquiry: ReturnType<typeof classifyImmigrationInquiry>, caseId?: string): Promise<KnowledgeRecord[]> {
  return retrieveUnifiedAuthority({
    query,
    queries: authorityQueriesForInquiry(inquiry),
    inquiryMode: inquiry.mode,
    themes: inquiry.themes,
    caseId,
    limit: 8,
    persistHits: true,
    preferSnapshots: Boolean(caseId),
  });
}

export async function fallbackAnalyze(
  situation: string,
  goal: string,
  documentsText: string,
  docs: DocInfo[] = [],
  caseId?: string,
): Promise<FallbackResult> {
  const narrative = `${situation}\n${goal}`;
  const text = `${narrative}\n${documentsText}`;
  const lower = text.toLowerCase();
  const forms = uniq(text.toUpperCase().match(USCIS_FORM_RE) ?? []);
  const receiptNumbers = uniq(text.toUpperCase().match(RECEIPT_RE) ?? []);
  const notices = uniq((text.match(NOTICE_RE) ?? []).map((item) => item.toUpperCase().replace(/\s+/g, "")));
  const deadlines = detectDeadlines(text);
  const years = yearsFrom(text);
  const hasDocs = docs.length > 0;
  const inquiry = classifyImmigrationInquiry({
    situation,
    goal,
    documentsText,
    documentCount: docs.length,
    receipts: receiptNumbers,
  });
  const ranked = await loadRankedKnowledge(`${situation} ${goal} ${documentsText}`, inquiry, caseId);
  const { queryKeys, boosts } = await loadBoostsForNarrative(situation, goal);
  const options = inquiry.mode === INQUIRY_MODES.OPEN_OPTIONS
    ? buildOpenOptionsAnalysis({ situation, goal, documentsText }, inquiry, ranked, boosts)
    : null;
  const knowledge = ranked[0] ?? null;
  const referral = evaluateConsultantReferral({ text, inquiry, notices, sources: ranked });
  const issues: Json[] = [];
  const conflicts: FallbackConflict[] = [];
  const evidence = evidenceLine(docs, inquiry.mode);

  if (options) {
    await recordSuggestionEvent(queryKeys, options.suggestionKeys ?? options.pathSteps.map((step) => step.action_key), "recommended");
    return {
      facts: {
        user_goal: goal,
        inquiry_mode: inquiry.mode,
        inquiry_themes: inquiry.themes,
        forms_detected: forms,
        receipt_numbers: receiptNumbers,
        notices_detected: notices,
        years_detected: years,
        deadlines_detected: deadlines,
        documents_uploaded: docs.length,
        unknowns: options.unknowns.map((item) => item.question),
      },
      issues: options.issues as unknown as Json[],
      pathSteps: options.pathSteps,
      conflicts,
    };
  }

  if (notices.some((notice) => ["RFE", "NOID", "NOIR", "NOIT"].includes(notice))) {
    const noticeType = notices.find((notice) => ["RFE", "NOID", "NOIR", "NOIT"].includes(notice)) ?? "RFE";
    issues.push({
      issue_type: "uscis_notice_response",
      item_kind: noticeType === "RFE" ? "issue" : "risk",
      evidence_status: hasDocs ? "likely" : "needs_verification",
      evidence_strength: hasDocs ? "moderate" : "limited",
      title: `${noticeType} response needs organization`,
      what_we_know: `${noticeType} language appears in the case. The response deadline and every requested evidence item should be tracked before preparing a response.`,
      our_conclusion: noticeType === "RFE"
        ? "This appears to be a request for more evidence. A complete response should address each requested item and be sent before the deadline."
        : "This appears to be a serious USCIS intent notice. Professional review is strongly recommended before responding.",
      still_unclear: [
        "The exact response deadline printed on the notice",
        "Every evidence item USCIS requested",
        "Whether any original documents or translations are required",
      ],
      explanations: [
        { title: "Notice response", detail: "USCIS notices control the deadline, mailing/upload location, and response contents. The notice itself is the primary source of truth.", likelihood: "Likely" },
      ],
      confidence: hasDocs ? "medium" : "low",
      priority: noticeType === "RFE" ? "high" : "urgent",
      state: noticeType === "RFE" ? "action_needed" : "urgent",
      next_action: "UPLOAD_NOTICE",
      alternative_action: "A licensed professional is recommended before you respond.",
      uscis_basis: knowledge?.reference ?? noticeType,
      professional_review: referral.level,
      analysis_outline: [
        { heading: "Your situation", detail: `Your case references a ${noticeType}.` },
        { heading: "USCIS context", detail: knowledge?.content ?? "USCIS notice responses should be complete, timely, and organized around each requested item.", source: knowledge?.reference ?? noticeType },
        { heading: "Your evidence", detail: evidence },
        { heading: "Our conclusion", detail: "The notice should be uploaded and indexed before any response is drafted." },
        { heading: "Your next move", detail: "Upload the full notice, confirm the deadline, and list each evidence item requested." },
      ],
    });
  }

  if (deadlines.length > 0) {
    issues.push({
      issue_type: "deadline_tracking",
      item_kind: "risk",
      evidence_status: hasDocs ? "likely" : "possible",
      evidence_strength: hasDocs ? "moderate" : "limited",
      title: "Immigration deadline identified",
      what_we_know: `Potential deadline references found: ${deadlines.slice(0, 3).join("; ")}.`,
      our_conclusion: "Immigration deadlines can affect eligibility, response rights, or case timing. They should be confirmed from the notice or official receipt.",
      still_unclear: ["Exact deadline", "Required filing or response method", "Whether extensions or exceptions are available"],
      confidence: "medium",
      priority: "high",
      state: "action_needed",
      next_action: "ADD_DEADLINE",
      alternative_action: "Upload the notice or receipt that contains the deadline.",
      professional_review: referral.level,
      analysis_outline: [
        { heading: "Your situation", detail: "Your case includes at least one deadline reference." },
        { heading: "USCIS context", detail: "The document that creates the deadline should be treated as authoritative." },
        { heading: "Your evidence", detail: evidence },
        { heading: "Our conclusion", detail: "The deadline should be confirmed and tracked before other planning." },
        { heading: "Your next move", detail: "Add the deadline to reminders and upload the source document." },
      ],
    });
  }

  if (forms.length > 0 || receiptNumbers.length > 0) {
    issues.push({
      issue_type: "case_timeline",
      item_kind: "finding",
      evidence_status: hasDocs ? "likely" : "possible",
      evidence_strength: hasDocs ? "moderate" : "limited",
      title: "Immigration case timeline can be reconstructed",
      what_we_know: `Detected ${forms.length ? `forms (${forms.join(", ")})` : "forms not yet identified"}${receiptNumbers.length ? ` and receipt number(s) ${receiptNumbers.join(", ")}` : ""}.`,
      our_conclusion: "The case can be organized into a timeline of filings, notices, deadlines, and outcomes.",
      still_unclear: ["Complete filing history", "Most recent USCIS action", "Any missing receipt or approval notices"],
      confidence: "medium",
      priority: "medium",
      state: "review",
      next_action: "GET_CASE_RECORD",
      alternative_action: "Upload all USCIS receipts, approvals, RFEs, denials, and interview notices.",
      uscis_basis: forms[0] ?? "USCIS case records",
      professional_review: referral.level,
      analysis_outline: [
        { heading: "Your situation", detail: "Your case includes identifiable immigration forms or receipt numbers." },
        { heading: "USCIS context", detail: "Receipts and notices establish filing dates, case type, office, and current posture." },
        { heading: "Your evidence", detail: evidence },
        { heading: "Our conclusion", detail: "A timeline review is the next best organizing step." },
        { heading: "Your next move", detail: "Upload missing receipts and approvals so the timeline can be verified." },
      ],
    });
  }

  if (/interview|biometrics|fingerprint/.test(lower)) {
    issues.push({
      issue_type: "appointment_preparation",
      item_kind: "opportunity",
      evidence_status: "possible",
      evidence_strength: hasDocs ? "moderate" : "limited",
      title: "Appointment or interview preparation",
      what_we_know: "Your case references an interview, biometrics appointment, or other scheduled USCIS event.",
      our_conclusion: "Appointments should be prepared with identity documents, appointment notices, originals, translations, and copies of submitted filings.",
      still_unclear: ["Appointment date and location", "Documents required by the notice", "Whether an interpreter or attorney should attend"],
      confidence: "medium",
      priority: "medium",
      state: "review",
      next_action: "UPLOAD_NOTICE",
      alternative_action: "Upload the appointment notice for a document checklist.",
      professional_review: referral.level,
    });
  }

  if (issues.length === 0) {
    issues.push({
      issue_type: "case_organization",
      item_kind: "missing_info",
      evidence_status: hasDocs ? "possible" : "needs_verification",
      evidence_strength: hasDocs ? "limited" : "limited",
      title: "More immigration details are needed",
      what_we_know: hasDocs ? "Documents are uploaded, but the case question needs more structure." : "No USCIS documents are on file yet.",
      our_conclusion: "Start by organizing the goal, status history, forms filed, receipt numbers, and recent notices.",
      still_unclear: ["Current immigration status", "Forms filed", "Receipt numbers", "Recent notices or deadlines", "Desired outcome"],
      confidence: "low",
      priority: "medium",
      state: "info_needed",
      next_action: "ADD_CASE_DETAILS",
      alternative_action: "Upload the most recent USCIS notice or receipt.",
      professional_review: referral.level,
      analysis_outline: [
        { heading: "Your situation", detail: "The case needs more structured facts before a reliable assessment can be made." },
        { heading: "USCIS context", detail: "Immigration analysis depends heavily on form type, filing date, current status, and notices received." },
        { heading: "Your evidence", detail: evidence },
        { heading: "Our conclusion", detail: "More information is needed before giving a specific next-step plan." },
        { heading: "Your next move", detail: "Add your most recent notice, receipt number, and desired outcome." },
      ],
    });
  }

  const pathSteps: FallbackResult["pathSteps"] = resolveFallbackPathSteps({
    inquiryMode: inquiry.mode,
    query: narrative,
  });

  return {
    facts: {
      user_goal: goal,
      inquiry_mode: inquiry.mode,
      inquiry_themes: inquiry.themes,
      forms_detected: forms,
      receipt_numbers: receiptNumbers,
      notices_detected: notices,
      years_detected: years,
      deadlines_detected: deadlines,
      documents_uploaded: docs.length,
      unknowns: issues.flatMap((issue) => (Array.isArray(issue.still_unclear) ? issue.still_unclear : [])),
    },
    issues,
    pathSteps,
    conflicts,
  };
}
