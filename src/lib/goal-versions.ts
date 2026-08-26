import { classifyImmigrationInquiry, OPEN_OPTIONS_POSTURE } from "./immigration-inquiry";
import { DOCUMENT_CATALOG } from "./goal-documents";
import { ANALYSIS_TASK_LABELS } from "./case-analysis-plan";
import { isFiledCaseSurface, type FiledSurfaceInput } from "./goal-notices";

export type VersionMatchInput = FiledSurfaceInput;

export type VersionChrome = {
  recordHeading: string;
  recordListHeading: string;
  versionLabel: (version: number) => string;
  laterVersions: string;
  howAnalyzedHeading: string;
  closedEyebrow: (closedAt: string, reason: string) => string;
  closedEmpty: string;
  verifiedDone: string;
  fitsHeading: string;
  emptyEvidenceSummary: string;
  defaultPosture: string;
};

export const FILED_VERSION_REASON_LABELS: Record<string, string> = {
  analysis: "Full case review",
  document: "New documents on file",
  clarify: "Answers added to the case",
  reprocess: "Evidence reprocessed",
  admin_reanalysis: "Admin comparison review",
  admin_override: "Admin replaced the customer output",
};

export const OPTIONS_VERSION_REASON_LABELS: Record<string, string> = {
  analysis: "Options review",
  document: "New matching documents on file",
  clarify: "Answers added to this situation",
  reprocess: "Evidence reprocessed",
  admin_reanalysis: "Admin comparison review",
  admin_override: "Admin replaced the options output",
};

export const FILED_VERIFIABLE_ACTIONS: Record<string, string> = {
  UPLOAD_DOCUMENTS: "Completes when your case has at least one document",
  UPLOAD_NOTICE: "Completes when a USCIS notice is extracted into the evidence record",
  GET_CASE_RECORD: "Completes when a USCIS case record is uploaded to your case",
  GET_ACCOUNT_RECORD: "Completes when a USCIS online account record is uploaded to your case",
  REVIEW_ANALYSIS: "Completes when the analysis has been re-run after documents were added",
  RERUN_ANALYSIS: "Completes when the analysis has been re-run after documents were added",
  DRAFT_LETTER: "Completes when a response letter has been drafted",
  COMPLETE_FORM_I485: "Completes when the matching Form I-485 wizard is finished",
  PREPARE_FORM: "Completes when the matching USCIS form wizard is finished",
  ADD_DEADLINE: "Completes when a deadline is tracked for this case",
  PREPARE_APPOINTMENT: "Completes when an appointment or interview event is extracted into evidence",
};

export const OPTIONS_VERIFIABLE_ACTIONS: Record<string, string> = {
  UPLOAD_DOCUMENTS: "Completes when this situation has at least one matching document",
  UPLOAD_NOTICE: "Completes when matching identity or relationship evidence is uploaded — a USCIS notice is optional",
  GET_CASE_RECORD: "Completes when matching identity or relationship evidence is uploaded — a receipt is not required",
  GET_ACCOUNT_RECORD: "Completes when matching evidence is on file — a my.uscis.gov record is not required",
  REVIEW_ANALYSIS: "Completes when the options review has been re-run after documents were added",
  RERUN_ANALYSIS: "Completes when the options review has been re-run after documents were added",
  DRAFT_LETTER: "Completes when a matching cover or preparation letter has been drafted",
  COMPLETE_FORM_I485: "Completes when the matching form wizard is finished",
  PREPARE_FORM: "Completes when the matching USCIS form wizard is finished",
  ADD_DEADLINE: "Completes when a deadline is tracked for this situation — none is invented from a receipt you do not have",
  PREPARE_APPOINTMENT: "Completes when an appointment notice is actually on file",
};

function versionSurfaceIsFiled(input?: VersionMatchInput): boolean {
  if (input == null) return true;
  if (input.inquiryMode === "open_options") return false;
  if (input.inquiryMode === "existing_case") return true;
  if (input.query || input.hasNotices || (input.noticeTypes && input.noticeTypes.length > 0) || input.themes?.length) {
    return isFiledCaseSurface(input);
  }
  return true;
}

export function matchInputFromCase(c: {
  situation?: string | null;
  goal?: string | null;
  notices?: { noticeType?: string | null }[];
  inquiryMode?: string | null;
}): VersionMatchInput {
  const query = `${c.situation ?? ""} ${c.goal ?? ""}`;
  const noticeTypes = (c.notices ?? []).map((notice) => notice.noticeType).filter((value): value is string => Boolean(value));
  const inquiryMode = c.inquiryMode ?? classifyImmigrationInquiry({ situation: c.situation ?? undefined, goal: c.goal ?? undefined }).mode;
  return { inquiryMode, query, noticeTypes };
}

export function versionReasonLabel(reason: string, input?: VersionMatchInput): string {
  const filed = versionSurfaceIsFiled(input);
  const labels = filed ? FILED_VERSION_REASON_LABELS : OPTIONS_VERSION_REASON_LABELS;
  return labels[reason] ?? (filed ? "Case review" : "Options review");
}

export function resolveVersionChrome(input?: VersionMatchInput): VersionChrome {
  if (versionSurfaceIsFiled(input)) {
    return {
      recordHeading: "Case record version",
      recordListHeading: "Case record versions",
      versionLabel: (version) => `Case record version ${version}`,
      laterVersions: "Later document uploads or answers create a new version. This review used the records on file at that time.",
      howAnalyzedHeading: "How this case was analyzed",
      closedEyebrow: (closedAt, reason) => `Case closed ${closedAt} · ${reason}`,
      closedEmpty: "This case has been closed.",
      verifiedDone: "Verified from case evidence",
      fitsHeading: "How this fits your case",
      emptyEvidenceSummary: "Upload USCIS records so the case timeline can be reconstructed from evidence.",
      defaultPosture: "Case posture needs verification",
    };
  }
  return {
    recordHeading: "Approved record",
    recordListHeading: "Approved record versions",
    versionLabel: (version) => `Approved record version ${version}`,
    laterVersions: "Later matching documents or answers create a new version. This review used the records on file at that time. A USCIS receipt is not required.",
    howAnalyzedHeading: "How this situation was analyzed",
    closedEyebrow: (closedAt, reason) => `Situation closed ${closedAt} · ${reason}`,
    closedEmpty: "This situation has been closed.",
    verifiedDone: "Verified from matching evidence",
    fitsHeading: "How this fits your situation",
    emptyEvidenceSummary: "Share matching documents or the facts the official material still needs. A USCIS receipt is not required.",
    defaultPosture: OPEN_OPTIONS_POSTURE,
  };
}

export function closedReasonLabel(closedReason: string | null | undefined): string {
  if (closedReason === "abandoned") return "closed for inactivity";
  if (closedReason === "completed") return "completed";
  return "closed";
}

export function verifiableActionCopy(actionKey: string, input?: VersionMatchInput): string {
  const key = actionKey.toUpperCase();
  const table = versionSurfaceIsFiled(input) ? FILED_VERIFIABLE_ACTIONS : OPTIONS_VERIFIABLE_ACTIONS;
  return table[key] ?? FILED_VERIFIABLE_ACTIONS[key] ?? "";
}

export function matchingProgressKinds(): string[] {
  return DOCUMENT_CATALOG.filter((item) => !item.isFiledCase).map((item) => item.kind);
}

export function usesMatchingEvidenceProgress(input?: VersionMatchInput): boolean {
  return !versionSurfaceIsFiled(input);
}

export function analysisDocumentWalkthrough(docCount: number, input?: VersionMatchInput): string {
  if (!versionSurfaceIsFiled(input)) {
    if (docCount === 0) {
      return "Used the situation you described and matching official material. A receipt is not required.";
    }
    return `Cross-checked ${docCount} document${docCount === 1 ? "" : "s"} against the situation, comparing matching evidence to official material. A receipt is not required.`;
  }
  return `Cross-checked ${docCount} document${docCount === 1 ? "" : "s"} against the story, comparing forms, receipt numbers, dates, and deadlines.`;
}

export function analysisTaskLabel(task: string, input?: VersionMatchInput): string {
  if (task === "PRESENT_APPROVED_STATE" && !versionSurfaceIsFiled(input)) {
    return "Approved options presentation";
  }
  return ANALYSIS_TASK_LABELS[task] ?? task;
}
