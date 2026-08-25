import { matchingFormNumber, type FormMatchInput } from "./goal-forms";
import { documentCatalogHref, documentStartLabel, matchingDocumentKind } from "./goal-documents";

export type FiledSurfaceInput = FormMatchInput & {
  noticeTypes?: string[];
  hasNotices?: boolean;
  hasDeadlines?: boolean;
};

export type NoticePageCopy = {
  pageTitle: string;
  pageSubtitle: string;
  emptyTitle: string;
  emptyBody: string;
  skipBanner: string | null;
  uploadPrimary: boolean;
  primaryCta: { label: string; href: string };
};

export type DeadlinesPageCopy = {
  pageSubtitle: string;
  emptyTitle: string;
  emptyBody: string;
  dashboardEmptyBody: string;
  addPlaceholder: string;
};

export type UscisAccountCopy = {
  pageTitle: string;
  pageSubtitle: string;
  intro: string;
  optionalBanner: string | null;
  showGuidePrimary: boolean;
  steps: { title: string; body: string }[];
};

export type FiledSurfaceAudience = "guest" | "free" | "plus" | "pro" | "staff";

export type NoticeCatalogEntitlement = {
  audience: FiledSurfaceAudience;
  canUpload: boolean;
  showRegisterCta: boolean;
  showUpgradeCta: boolean;
};

function queryHay(input: FiledSurfaceInput): string {
  return `${input.query ?? ""} ${(input.noticeTypes ?? []).join(" ")} ${(input.sources ?? []).map((source) => `${source.reference ?? ""} ${source.title ?? ""} ${source.content ?? ""}`).join(" ")}`.toLowerCase();
}

function mentionsRfe(input: FiledSurfaceInput): boolean {
  return /\brfe\b|request for evidence/.test(queryHay(input))
    || (input.noticeTypes ?? []).some((type) => /\brfe\b|request for evidence/i.test(type));
}

export function isFiledCaseSurface(input: FiledSurfaceInput = {}): boolean {
  if (input.inquiryMode === "open_options") return false;
  if (input.inquiryMode === "existing_case") return true;
  if (mentionsRfe(input)) return true;
  if (input.hasNotices) return true;
  return false;
}

export function noticeCatalogHref(caseId?: string | null): string {
  return caseId ? `/app/notices?case=${encodeURIComponent(caseId)}` : "/app/notices";
}

export function deadlineCatalogHref(): string {
  return "/app/deadlines";
}

export function uscisAccountHref(): string {
  return "/app/uscis-account";
}

export function matchingEvidenceHref(input: FiledSurfaceInput = {}): string {
  return documentCatalogHref(matchingDocumentKind(input) ?? "identity");
}

export function resolveNoticePageCopy(input: FiledSurfaceInput = {}): NoticePageCopy {
  const filed = isFiledCaseSurface(input);
  const rfe = mentionsRfe(input);
  const evidenceHref = matchingEvidenceHref(input);
  const evidenceLabel = documentStartLabel(matchingDocumentKind(input));
  if (!filed) {
    return {
      pageTitle: "USCIS notices",
      pageSubtitle: "Skip this if USCIS has not sent you a letter. Family options start with identity and relationship evidence, not an I-797 receipt.",
      emptyTitle: "No USCIS letter on file",
      emptyBody: "You do not need a receipt or RFE to keep going. Upload matching evidence, or paste a notice later if USCIS sends one.",
      skipBanner: "No USCIS notice is required for this case. Use matching documents first.",
      uploadPrimary: false,
      primaryCta: { label: `${evidenceLabel} →`, href: evidenceHref },
    };
  }
  return {
    pageTitle: "USCIS notices",
    pageSubtitle: rfe
      ? "Upload or photograph the RFE or other USCIS letter. We identify it, extract the key facts, and explain it against the approved case presentation."
      : "Upload or photograph any USCIS letter. We identify it, extract the key facts, and explain it against the approved case presentation.",
    emptyTitle: "No notices yet",
    emptyBody: rfe
      ? "Upload the RFE so the respond-by date and requested evidence can be checked against this case."
      : "When you upload a USCIS letter, its explanation will appear here.",
    skipBanner: null,
    uploadPrimary: true,
    primaryCta: { label: "Explain this notice →", href: noticeCatalogHref() },
  };
}

export function resolveDeadlinesPageCopy(input: FiledSurfaceInput = {}): DeadlinesPageCopy {
  const filed = isFiledCaseSurface(input);
  if (!filed) {
    return {
      pageSubtitle: "USCIS does not set a respond-by date until it sends a notice. Add your own filing targets if you want reminders.",
      emptyTitle: "No USCIS deadlines yet",
      emptyBody: "Open-options cases do not invent an RFE or receipt deadline. Add a date yourself, or it will appear here when a USCIS notice is on file.",
      dashboardEmptyBody: "No USCIS deadline applies yet — none is invented from a receipt you do not have.",
      addPlaceholder: "e.g. File Form I-130",
    };
  }
  return {
    pageSubtitle: "Dates from USCIS notices land here automatically. Add your own too.",
    emptyTitle: "No deadlines tracked",
    emptyBody: mentionsRfe(input)
      ? "When the RFE has a respond-by date, it appears here."
      : "When we find a respond-by date on a notice, it appears here.",
    dashboardEmptyBody: "Dates from USCIS notices appear here automatically.",
    addPlaceholder: "e.g. Respond to RFE",
  };
}

export function shouldExpectAutomaticDeadlines(input: FiledSurfaceInput = {}): boolean {
  return isFiledCaseSurface(input);
}

export function shouldShowUscisAccountGuide(input: FiledSurfaceInput = {}): boolean {
  return isFiledCaseSurface(input);
}

export function resolveUscisAccountCopy(input: FiledSurfaceInput = {}): UscisAccountCopy {
  const filed = isFiledCaseSurface(input);
  if (!filed) {
    return {
      pageTitle: "USCIS online account",
      pageSubtitle: "Use this only if you already filed and have a receipt number. Family options start with matching evidence, not my.uscis.gov.",
      intro: "A USCIS online account is for people who already have a case on file. If you have not filed yet, skip the receipt-number steps and upload the matching identity or relationship records instead.",
      optionalBanner: "You do not need a USCIS online account to explore options. This guide is optional until you have a receipt.",
      showGuidePrimary: false,
      steps: [
        { title: "Skip this if you have not filed", body: "Receipt numbers and case-status tools only exist after USCIS accepts a filing." },
        { title: "Upload matching evidence here first", body: `Start with ${documentStartLabel(matchingDocumentKind(input)).replace(/^Upload /i, "")} from official material, not a case-status printout.` },
        { title: "Come back after you file", body: "Once you have an I-797 receipt, you can sign in at my.uscis.gov and upload that notice here." },
      ],
    };
  }
  return {
    pageTitle: "Set up your USCIS online account",
    pageSubtitle: "Your USCIS account can help you verify receipt numbers, case status, notices, and online filings.",
    intro: "With a USCIS online account, you may be able to view case status tools, online filings, receipt numbers, notices, and account messages. Uploading official records here means our analysis works with confirmed USCIS information instead of estimates.",
    optionalBanner: null,
    showGuidePrimary: true,
    steps: [
      { title: "Go to the USCIS website", body: "Open the official USCIS online account page. Only use official uscis.gov or my.uscis.gov pages." },
      { title: "Sign in or create an account", body: "Use your USCIS account to view available case status tools, notices, and online filings." },
      { title: "Collect your case details", body: "Copy receipt numbers, form types, filing dates, and recent status updates into your ImmigrationOnMe case." },
      { title: "Download available notices", body: "If USCIS provides a notice or confirmation PDF, save it and upload it to your document vault." },
      { title: "Upload records here", body: "Adding official records lets ImmigrationOnMe verify dates, receipt numbers, form types, and deadlines." },
    ],
  };
}

export function resolveNoticeEntitlement(input: {
  isGuest?: boolean;
  isStaff?: boolean;
  planKey?: string;
  hasUpload?: boolean;
}): NoticeCatalogEntitlement {
  if (input.isGuest) {
    return { audience: "guest", canUpload: false, showRegisterCta: true, showUpgradeCta: false };
  }
  if (input.isStaff) {
    return { audience: "staff", canUpload: true, showRegisterCta: false, showUpgradeCta: false };
  }
  const planKey = (input.planKey || "free").toLowerCase();
  const audience: FiledSurfaceAudience = planKey === "pro" ? "pro" : planKey === "plus" ? "plus" : "free";
  return {
    audience,
    canUpload: Boolean(input.hasUpload),
    showRegisterCta: false,
    showUpgradeCta: !input.hasUpload,
  };
}

export function noticeUploadAllowed(input: {
  canUpload: boolean;
  used: number;
  incoming?: number;
  limit: number | null;
}): { allowed: boolean; remaining: number | null; overLimit: boolean } {
  const incoming = Math.max(0, input.incoming ?? 0);
  if (!input.canUpload) {
    return {
      allowed: false,
      remaining: input.limit === null ? null : Math.max(0, input.limit - input.used),
      overLimit: false,
    };
  }
  if (input.limit === null) {
    return { allowed: true, remaining: null, overLimit: false };
  }
  const remaining = Math.max(0, input.limit - input.used);
  const wouldExceed = incoming > 0 && input.used + incoming > input.limit;
  return {
    allowed: remaining > 0 && !wouldExceed,
    remaining,
    overLimit: remaining === 0 || wouldExceed,
  };
}

export function resolveDashboardFiledCopy(input: FiledSurfaceInput = {}): {
  deadlinesEmptyBody: string;
  matchingCta: { label: string; href: string };
} {
  const copy = resolveDeadlinesPageCopy(input);
  const formNumber = matchingFormNumber(input);
  const filed = isFiledCaseSurface(input);
  return {
    deadlinesEmptyBody: copy.dashboardEmptyBody,
    matchingCta: filed
      ? { label: mentionsRfe(input) ? "Upload the USCIS notice →" : "See USCIS notices →", href: noticeCatalogHref() }
      : {
          label: formNumber ? `See matching Form ${formNumber} →` : `${documentStartLabel(matchingDocumentKind(input))} →`,
          href: formNumber ? `/app/forms?form=${encodeURIComponent(formNumber)}` : matchingEvidenceHref(input),
        },
  };
}
