import { presentationStepCta } from "./case-presentation-ui";
import { matchingFormNumber } from "./goal-forms";
import { matchingDocumentKind } from "./goal-documents";
import { matchingLetterKind } from "./goal-letters";
import { isFiledCaseSurface, type FiledSurfaceInput } from "./goal-notices";

export type ChromeMatchInput = FiledSurfaceInput & {
  caseId?: string | null;
};

export type AccountNavItem = {
  href: string;
  label: string;
  optional: boolean;
};

export type CaseChromeActions = {
  askLabel: string;
  askHref: string;
  evidenceLabel: string;
  evidenceHref: string;
  reportTitle: string;
  reportLabel: string;
  reportHref: string;
  reportLockedLabel: string;
};

export type ReportChromeCopy = {
  documentTitle: string;
  heading: string;
  reviewLevel: string;
  referenceLabel: string;
  openedLabel: string;
  recordLabel: string;
  fileSlug: string;
  footerRole: string;
  footerVerify: string;
  emptyNoticesHtml: string;
};

export type UpdatesChromeCopy = {
  intro: string;
  signInCta: string;
  paidBanner: string;
  impactHeading: string;
  noMatch: string;
};

export type CasesListCopy = {
  pageTitle: string;
  pageSubtitle: string;
  emptyTitle: string;
  emptyBody: string;
  startLabel: string;
};

export const SUPPORT_PLAYBOOK_MATCHING = {
  title: "Ask for matching evidence or a notice",
  staleTitle: "Request latest USCIS notice",
  category: "customer_service",
  body: "If they have not filed yet, ask for matching identity or relationship evidence — not a USCIS receipt. If a USCIS notice is already on file, ask them to upload that letter so we can confirm the form, receipt number, and any deadline.",
};

export const CONSULTANT_EMPTY_BODY =
  "Explore options or ask a question so we can match a licensed attorney or accredited representative who works this kind of matter. Nothing is shared until you request a match and they accept.";

export const CASE_REPORT_FEATURE_NAME = "Downloadable options or case report (with document copies)";

export const UPDATES_CHROME: UpdatesChromeCopy = {
  intro:
    "We monitor current USCIS alerts and news from the current and previous week, refreshing automatically throughout the day. Paid customers also see deterministic notes when an update appears to touch forms, notices, or topics present in their options or filed cases.",
  signInCta: "Sign in for notes on your options or filed case",
  paidBanner: "Notes on your options or filed case are included with paid plans.",
  impactHeading: "Possible impact on your options or cases",
  noMatch: "No match detected from the visible update text for your options or filed cases.",
};

export const BILLING_REPORT_OVERAGE = "Report download limit reached.";
export const BILLING_REPORT_RETURN = "After checkout, return to the report from the case page.";

const NAV_TAIL: AccountNavItem[] = [
  { href: "/app/consultants", label: "My consultant", optional: false },
  { href: "/app/support", label: "Support tickets", optional: false },
  { href: "/app/billing", label: "Plan & billing", optional: false },
  { href: "/app/profile", label: "Profile", optional: false },
];

export function resolveAccountNav(input: ChromeMatchInput = {}): AccountNavItem[] {
  const filed = isFiledCaseSurface(input);
  const head: AccountNavItem[] = [
    { href: "/app", label: "Overview", optional: false },
    { href: "/app/cases", label: "My cases", optional: false },
  ];
  const matching: AccountNavItem[] = [
    { href: "/app/documents", label: "Document vault", optional: false },
    { href: "/app/forms", label: "USCIS forms", optional: false },
    { href: "/app/letters", label: "USCIS letters", optional: false },
  ];
  const qa: AccountNavItem = { href: "/app/qa", label: "Ask the assistant", optional: false };
  const filedItems: AccountNavItem[] = filed
    ? [
        { href: "/app/notices", label: "USCIS notices", optional: false },
        { href: "/app/deadlines", label: "Deadlines", optional: false },
        { href: "/app/uscis-account", label: "USCIS online account", optional: false },
      ]
    : [
        { href: "/app/notices", label: "USCIS notices (optional)", optional: true },
        { href: "/app/deadlines", label: "Deadlines (optional)", optional: true },
        { href: "/app/uscis-account", label: "USCIS account (optional)", optional: true },
      ];
  if (filed) {
    return [
      ...head,
      filedItems[0],
      ...matching,
      filedItems[1],
      qa,
      ...NAV_TAIL.slice(0, 2),
      filedItems[2],
      ...NAV_TAIL.slice(2),
    ];
  }
  return [...head, ...matching, qa, ...NAV_TAIL.slice(0, 1), ...filedItems, ...NAV_TAIL.slice(1)];
}

export function navHrefsBefore(nav: AccountNavItem[], href: string): string[] {
  const index = nav.findIndex((item) => item.href === href);
  return index < 0 ? [] : nav.slice(0, index).map((item) => item.href);
}

export function resolveCaseChrome(
  input: ChromeMatchInput & { caseId: string; hasReportAccess?: boolean },
): CaseChromeActions {
  const filed = isFiledCaseSurface(input);
  const report = resolveReportChrome(input);
  const cta = presentationStepCta("UPLOAD_NOTICE", input.caseId, matchingFormNumber(input), matchingLetterKind(input), {
    inquiryMode: input.inquiryMode,
    matchingDocumentKind: matchingDocumentKind(input),
    noticeTypes: input.noticeTypes,
  });
  return {
    askLabel: filed ? "Ask about this case" : "Ask about this situation",
    askHref: `/app/qa?case=${encodeURIComponent(input.caseId)}`,
    evidenceLabel: cta?.label ?? (filed ? "Upload the USCIS notice" : "Upload matching documents"),
    evidenceHref: cta?.href ?? (filed ? `/app/notices?case=${encodeURIComponent(input.caseId)}` : "/app/documents?kind=identity"),
    reportTitle: report.documentTitle,
    reportLabel: input.hasReportAccess === false ? `${report.documentTitle} 🔒` : `${report.documentTitle} ↗`,
    reportLockedLabel: `${report.documentTitle} 🔒`,
    reportHref: `/api/cases/${encodeURIComponent(input.caseId)}/report`,
  };
}

export function resolveReportChrome(input: ChromeMatchInput = {}): ReportChromeCopy {
  const filed = isFiledCaseSurface(input);
  if (filed) {
    return {
      documentTitle: "Case report",
      heading: "Case Report",
      reviewLevel: "Case analysis",
      referenceLabel: "Case reference",
      openedLabel: "Case opened",
      recordLabel: "Case record",
      fileSlug: "case-report",
      footerRole: "an immigration case assistant, not USCIS, a law firm, or a government agency",
      footerVerify:
        "this report summarizes the applicant's approved case presentation and records for personal or professional review. Verify all dates, deadlines, eligibility questions, and filing requirements against official USCIS records or qualified professional advice.",
      emptyNoticesHtml: "",
    };
  }
  return {
    documentTitle: "Options report",
    heading: "Options Report",
    reviewLevel: "Options analysis",
    referenceLabel: "Situation reference",
    openedLabel: "Situation opened",
    recordLabel: "Approved record",
    fileSlug: "options-report",
    footerRole: "an immigration options and paperwork assistant, not USCIS, a law firm, or a government agency",
    footerVerify:
      "this report summarizes the approved options presentation and matching records for personal or professional review. A USCIS receipt is not required. Verify matching form instructions against official USCIS material or qualified professional advice.",
    emptyNoticesHtml:
      "<h2>USCIS notices</h2><p>No USCIS notice is on file. None is required to explore options — a receipt is not invented.</p>",
  };
}

export function resolveCasesListCopy(input: ChromeMatchInput = {}): CasesListCopy {
  if (isFiledCaseSurface(input)) {
    return {
      pageTitle: "My cases",
      pageSubtitle: "Each case is one immigration situation, with a current posture and next step.",
      emptyTitle: "No cases yet",
      emptyBody: "Describe your situation and goal, and we'll analyze it into a clear case plan.",
      startLabel: "Start a case",
    };
  }
  return {
    pageTitle: "My cases",
    pageSubtitle: "Each case is one immigration situation — options before a filing, or a letter already on file.",
    emptyTitle: "No cases yet",
    emptyBody:
      "Describe your situation and goal, even if you have not filed anything with USCIS, and we'll map options and next steps.",
    startLabel: "Start a case",
  };
}

export function reportFileName(appName: string, ref: string, input: ChromeMatchInput = {}): string {
  return `${appName.replace(/\s+/g, "")}-${resolveReportChrome(input).fileSlug}-${ref}.html`;
}
