import { presentationStepCta } from "./case-presentation-ui";
import { matchingFormNumber } from "./goal-forms";
import { documentCatalogHref, documentStartLabel, matchingDocumentKind } from "./goal-documents";
import { matchingLetterKind } from "./goal-letters";
import { isFiledCaseSurface, type FiledSurfaceInput } from "./goal-notices";
import { resolveReadinessCopy } from "./goal-readiness";

export type GuideMatchInput = FiledSurfaceInput & {
  caseId?: string | null;
  actionKey?: string | null;
  actionTitle?: string | null;
};

export type GuideChrome = {
  title: string;
  subtitle: string;
  launcherLabel: string;
  placeholder: string;
};

export type GuideLinkAction = {
  type: "link";
  label: string;
  href: string;
};

export const GUIDE_WIDGET_CHROME_DEFAULT: GuideChrome = {
  title: "Your immigration guide",
  subtitle: "Options, a letter, or a filed case — I'll walk the next step",
  launcherLabel: "Open your immigration guide",
  placeholder: "Ask about your next step…",
};

export const GUIDE_PROMPT_RULES = `- Read Situation and Inquiry mode in the ACCOUNT SNAPSHOT.
- If Situation is open_options, lead with matching documents and the matching form (for family that is identity evidence and Form I-130). Do not tell the user to sign in at my.uscis.gov, hunt a receipt number, or upload a USCIS notice they do not have. Do not invent receipt numbers, RFEs, deadlines, interviews, or biometrics.
- If Situation is existing_case, or Notices on file include an RFE, coach that filed case: upload the latest USCIS notice, confirm the receipt number already in the snapshot, or list evidence requested by an RFE.
- Use the ACCOUNT SNAPSHOT to give specific, practical guidance about the user's current matching step.
- If the ACCOUNT SNAPSHOT includes approved posture, next action, nearest deadline, or evidence strength, treat those as the case record the customer already sees. Do not invent a different next step.
- If the ACCOUNT SNAPSHOT includes current evidence position, evidence status, evidence-derived actions, or evidence still needs, treat those as the compiled case record. Do not invent receipt numbers, dates, deadlines, or outcomes outside that record.
- Keep the user on track. Remind them of upcoming deadlines only when the snapshot lists a real deadline. Do not invent a deadline for open-options.
- NEVER intake a new immigration situation in chat. If the user describes a new immigration case, tell them it deserves its own case and that they can start one from the "Start as a new case" button shown below your reply.
- If the user reports a technical problem (errors, login, payments, uploads failing), tell them you'll help create a tech support ticket via the button below your reply.
- If you cannot help with a request, suggest the FAQ or creating a customer service ticket.
- Keep replies short (under 150 words), plain English, warm but professional. No emojis.
- Stay focused on USCIS and immigration. Do not introduce IRS/tax concepts, tax transcripts, refund/balance examples, or dollar placeholders unless the user's immigration case specifically involves a USCIS filing fee.`;

function matchHay(input: GuideMatchInput): GuideMatchInput {
  return {
    ...input,
    inquiryMode: input.inquiryMode,
    themes: input.themes,
    authorityQueries: input.authorityQueries,
    noticeTypes: input.noticeTypes,
    query: input.query,
  };
}

function matchingDocKind(input: GuideMatchInput): string {
  return matchingDocumentKind(matchHay(input)) ?? (isFiledCaseSurface(input) ? "case_record" : "identity");
}

function matchingForm(input: GuideMatchInput): string | null {
  return matchingFormNumber(matchHay(input));
}

function matchingLetter(input: GuideMatchInput): string | null {
  return matchingLetterKind(matchHay(input));
}

export function guideWidgetChrome(input: GuideMatchInput = {}): GuideChrome {
  if (isFiledCaseSurface(input)) {
    return {
      title: "Your case guide",
      subtitle: "Always watching your next step",
      launcherLabel: "Open your case guide",
      placeholder: "Ask about your next step…",
    };
  }
  if (input.inquiryMode === "open_options") {
    return {
      title: "Your options guide",
      subtitle: "I'll walk the next matching step — no receipt required",
      launcherLabel: "Open your options guide",
      placeholder: "Ask about your next matching step…",
    };
  }
  return GUIDE_WIDGET_CHROME_DEFAULT;
}

export function formatGuideSnapshot(input: GuideMatchInput = {}): string[] {
  const filed = isFiledCaseSurface(input);
  const form = matchingForm(input);
  const doc = matchingDocKind(input);
  const letter = matchingLetter(input);
  const notices = (input.noticeTypes ?? []).map((type) => type.trim()).filter(Boolean);
  const copy = resolveReadinessCopy(input);
  return [
    `Situation: ${filed ? "existing_case" : "open_options"}`,
    `Inquiry mode: ${input.inquiryMode ?? (filed ? "existing_case" : "open_options")}`,
    `Matching form: ${form ?? "none yet"}`,
    `Matching document: ${doc}`,
    `Matching letter: ${letter ?? "none yet"}`,
    `Notices on file: ${notices.length ? notices.join(", ") : "none"}`,
    `Readiness label: ${copy.overallLabel}`,
    filed
      ? "Guide rule: Coach the notice or receipt already in this snapshot. Do not invent extra receipts or deadlines."
      : "Guide rule: This is open_options. Do not invent a receipt number, RFE, deadline, interview, or my.uscis.gov hunt. Lead with matching documents and the matching form.",
  ];
}

export function guideDefaultActionKey(input: GuideMatchInput = {}): string | null {
  if (input.actionKey) return String(input.actionKey).toUpperCase();
  if (!input.caseId) return null;
  return isFiledCaseSurface(input) ? "UPLOAD_NOTICE" : "GET_CASE_RECORD";
}

export function guideTipForStep(actionKey: string | null | undefined, input: GuideMatchInput = {}): string | null {
  const key = String(actionKey ?? "").toUpperCase();
  if (!key) return null;
  const filed = isFiledCaseSurface(input);
  const form = matchingForm(input);
  const doc = matchingDocKind(input);
  const docCta = documentStartLabel(doc);
  const letter = matchingLetter(input);
  switch (key) {
    case "GET_CASE_RECORD":
    case "GET_ACCOUNT_RECORD":
      return filed
        ? "Sign in at my.uscis.gov and collect the receipt number, form type, filing date, latest status, and any available notice PDFs. Upload those records to your case documents here."
        : `You do not need a USCIS online account or receipt to keep going. ${docCta} first${form ? ` — the matching form is Form ${form}` : ""}. Skip my.uscis.gov until USCIS actually sends a notice.`;
    case "UPLOAD_NOTICE":
      return filed
        ? /\brfe\b/i.test((input.noticeTypes ?? []).join(" ")) || /\brfe\b|request for evidence/i.test(input.query ?? "")
          ? "Upload or photograph the RFE so the respond-by date and requested evidence can be checked against this case. Use USCIS notices, then open the explanation on your case."
          : "Upload the USCIS notice or receipt you already have. Use USCIS notices so the case page can verify the form, receipt number, and any deadline."
        : `There is no USCIS notice to upload yet. ${docCta} instead of chasing an I-797 receipt.`;
    case "UPLOAD_DOCUMENTS":
      return filed
        ? "Use the document vault and pick the matching kind. Photos from your phone work fine."
        : `Use the document vault and pick the matching kind. ${docCta} — family options start with identity and relationship evidence, not a USCIS receipt. Photos from your phone work fine.`;
    case "REVIEW_ANALYSIS":
      return "You've added documents — the case page updates automatically as the evidence is processed. Check the current evidence position and path forward for the newest verified next step.";
    case "DRAFT_LETTER":
      return filed
        ? "Use USCIS letters. If an RFE is on file, draft the RFE response; otherwise draft the matching notice response. Describe what you want to say in plain English."
        : `Use USCIS letters and pick the matching kind${letter ? ` (${letter.replace(/_/g, " ")})` : ""}. Family options start with an I-130 cover letter. Use an RFE response only when a Request for Evidence is actually on file.`;
    case "COMPLETE_FORM_I485":
    case "PREPARE_FORM": {
      const formNumber = form || (filed && key === "COMPLETE_FORM_I485" ? "I-485" : null);
      return formNumber
        ? `Open USCIS forms → Form ${formNumber} and answer the guided questions. Review the draft against the official USCIS instructions before filing.`
        : "Open USCIS forms and start the matching form listed on your case. Answer the guided questions. Review the draft against the official USCIS instructions before filing.";
    }
    default:
      return input.actionTitle
        ? `Your next step is "${input.actionTitle}". Knock it out and you're one step closer — I'm here if you need help with it.`
        : null;
  }
}

export function mentionsFiledChase(question: string): boolean {
  return /(status|receipt|rfe|notice|deadline|interview|biometrics)/i.test(question);
}

export function shouldChaseNoticeInGuide(question: string, input: GuideMatchInput = {}): boolean {
  return isFiledCaseSurface(input) && mentionsFiledChase(question);
}

export function guideStatusHint(question: string, input: GuideMatchInput = {}): string {
  if (shouldChaseNoticeInGuide(question, input)) {
    return " If your question is about status, an RFE, a notice, or a deadline, upload the USCIS notice or receipt number so the case page can verify it.";
  }
  if (mentionsFiledChase(question) && !isFiledCaseSurface(input)) {
    return " This case is still open-options. There is no USCIS receipt, RFE, or interview notice to chase yet. Keep going with matching documents and the matching form — a receipt is not required to start.";
  }
  return "";
}

export function guideOpeningCloser(input: GuideMatchInput = {}): string {
  return isFiledCaseSurface(input)
    ? "You're making progress — stick with the plan and ask me anything about your next step."
    : "You're mapping options — a USCIS receipt is not required. Ask me anything about the next matching step.";
}

export function guideUpgradeCopy(planName: string): string {
  return `Hi! I'm your personal immigration guide — I watch your next matching step, whether you are exploring options before a filing or working a USCIS letter already on file. The guide is part of our paid plans. You're currently on the ${planName} plan — upgrade to unlock me, and I'll walk you through options, a matching form, or a filed case.`;
}

export function guideFallbackCopy(input: GuideMatchInput, question: string): string {
  const tip = guideTipForStep(guideDefaultActionKey(input), { ...input, actionKey: guideDefaultActionKey(input) })
    ?? (input.caseId
      ? `Open your case and follow the next matching step — a USCIS receipt is not required unless a notice is actually on file.`
      : "Start by creating a case — describe what happened and your goal, even if you have not filed anything with USCIS, and we'll map options and next steps.");
  return `Here's what I can tell you right now: ${tip}${guideStatusHint(question, input)}\n\nIf that doesn't answer your question, the FAQ covers the most common ones, or I can connect you with our customer service team.`;
}

export function guidePrimaryAction(input: GuideMatchInput = {}): GuideLinkAction {
  const caseId = input.caseId ?? "";
  if (!caseId) {
    return { type: "link", label: "Start my first case", href: "/app/cases/new" };
  }
  const actionKey = guideDefaultActionKey(input);
  if (actionKey) {
    const cta = presentationStepCta(actionKey, caseId, matchingForm(input), matchingLetter(input), {
      inquiryMode: input.inquiryMode,
      matchingDocumentKind: matchingDocKind(input),
      noticeTypes: input.noticeTypes,
    });
    if (cta) return { type: "link", label: cta.label, href: cta.href };
  }
  return {
    type: "link",
    label: isFiledCaseSurface(input) ? "Open my case" : "Open my options",
    href: `/app/cases/${caseId}`,
  };
}

export function guideMatchingHref(input: GuideMatchInput = {}): string {
  return documentCatalogHref(matchingDocKind(input));
}
