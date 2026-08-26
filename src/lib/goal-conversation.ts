import { isFiledCaseSurface, type FiledSurfaceInput } from "./goal-notices";

export type ConversationMatchInput = FiledSurfaceInput;

export type DiscussionChrome = {
  heading: string;
  emptyCustomer: string;
  emptyStaff: string;
  placeholder: string;
  attachHint: string;
};

export type ClosingCopy = {
  completedLead: (opened: string, closed: string) => string;
  abandonedLead: (opened: string, lastActivity: string) => string;
  completedKeep: string;
  abandonedKeep: string;
  notificationTitle: (ref: string) => string;
  notificationCompletedBody: string;
  notificationAbandonedBody: string;
};

export type FallbackPathStep = { title: string; description: string; action_key: string };

export const ACCOUNT_CREATED_EMAIL = {
  key: "account_created",
  name: "Account created",
  subject: "Welcome to ImmigrationOnMe",
  bodyHtml:
    "<p>Welcome to ImmigrationOnMe. Your account is ready. Sign in to explore options before a filing, or to work a USCIS letter already on file.</p>",
};

export const STALE_ACCOUNT_CREATED_BODIES = ["your saved case information is available in your dashboard"];

export const CLOSING_PROMPT_RULES = `- If CASE DATA inquiry_mode is open_options, recap the situation and matching official material. Do not invent a receipt number, RFE, deadline, interview, biometrics, or confirmation letter. Do not tell the person to start a new USCIS case they do not have. A receipt is not required.
- If CASE DATA inquiry_mode is existing_case, or notices on file include an RFE, recap that filed case: forms, notices, dates, documents, and deadlines actually on file.
- If CASE DATA includes approved_presentation, use it as the customer-facing recap (posture, next action, findings, deadlines).
- If CASE DATA includes evidence_brief, use it as the compiled record and do not invent receipt numbers, form types, dates, deadlines, outcomes, or requested evidence outside that brief.
- Never promise USCIS outcomes.`;

export function resolveDiscussionChrome(input: ConversationMatchInput = {}): DiscussionChrome {
  if (isFiledCaseSurface(input)) {
    return {
      heading: "Case discussion",
      emptyCustomer: "Ask a question about your case, or leave a note.",
      emptyStaff: "Add a review comment for this case.",
      placeholder: "Ask about this USCIS case, receipt number, deadline, notice, or evidence…",
      attachHint: "Attach USCIS notices, receipts, forms, or evidence. Files join the case documents and are analyzed automatically.",
    };
  }
  return {
    heading: "Situation discussion",
    emptyCustomer: "Ask a question about this situation, or leave a note.",
    emptyStaff: "Add a review comment for this situation.",
    placeholder: "Ask about this situation, matching documents, or official questions. A receipt is not required…",
    attachHint: "Attach identity, relationship, or other matching evidence. A USCIS notice is optional until USCIS sends one. Files join this situation and are analyzed automatically.",
  };
}

export function commentNotificationTitle(
  ref: string,
  input: ConversationMatchInput = {},
  audience: "customer" | "consultant" = "customer",
): string {
  const filed = isFiledCaseSurface(input);
  if (audience === "consultant") {
    return filed ? `Client commented on case ${ref}` : `Client commented on this situation ${ref}`;
  }
  return filed ? `New comment on your case ${ref}` : `New comment on your situation ${ref}`;
}

export function consultantMatchNotificationTitle(input: ConversationMatchInput = {}): string {
  return isFiledCaseSurface(input)
    ? "We found a consultant who fits your case"
    : "We found a consultant who fits this situation";
}

export function qaGroundSelectLabel(input: ConversationMatchInput = {}): string {
  return isFiledCaseSurface(input) ? "Ground answers in a case" : "Ground answers in a situation";
}

export function qaLinkedAllowanceCopy(input: ConversationMatchInput = {}): string {
  return isFiledCaseSurface(input)
    ? "Questions about this case do not use your general Q&A allowance. Upgrade to Plus for personalized general follow-ups, or Pro to add a matched professional."
    : "Questions about this situation do not use your general Q&A allowance. Upgrade to Plus for personalized general follow-ups, or Pro to add a matched professional.";
}

export function resolveClosingCopy(input: ConversationMatchInput = {}): ClosingCopy {
  if (isFiledCaseSurface(input)) {
    return {
      completedLead: (opened, closed) => `Final review of your case, opened ${opened} and closed ${closed}.`,
      abandonedLead: (opened, lastActivity) =>
        `This case was opened on ${opened} and has had no activity since ${lastActivity}, so we're closing it to keep your account tidy. Nothing is lost — every document and finding stays in your account, and you can start a new case (or ask us to continue this one) at any time.`,
      completedKeep:
        "Keep your documents and any USCIS confirmation letters safe — they're your proof of what was filed, decided, or requested. If a new notice arrives, start a new case and we'll pick up with everything we already know.",
      abandonedKeep:
        "Your documents remain in your vault. When you're ready to continue, re-run the analysis or start a fresh case — everything you've provided carries over.",
      notificationTitle: (ref) => `Case ${ref} closed — final review inside`,
      notificationCompletedBody: "Your case is complete. Read your closing remarks and final review on the case page.",
      notificationAbandonedBody:
        "We closed this case after a period of inactivity. Your documents are safe and you can pick it back up anytime.",
    };
  }
  return {
    completedLead: (opened, closed) => `Final review of your situation, opened ${opened} and closed ${closed}.`,
    abandonedLead: (opened, lastActivity) =>
      `This situation was opened on ${opened} and has had no activity since ${lastActivity}, so we're closing it to keep your account tidy. Nothing is lost — every document and finding stays in your account, and you can start a new situation (or ask us to continue this one) at any time.`,
    completedKeep:
      "Keep the matching documents you uploaded. A USCIS receipt is not required to explore options. If USCIS later sends a notice, add it here — none is invented from a filing you do not have.",
    abandonedKeep:
      "Your documents remain in your vault. When you're ready to continue, re-run the analysis or start a fresh situation — everything you've provided carries over, and a receipt is not required.",
    notificationTitle: (ref) => `Situation ${ref} closed — options review inside`,
    notificationCompletedBody: "Your options review is complete. Read the closing remarks on the situation page.",
    notificationAbandonedBody:
      "We closed this situation after a period of inactivity. Your documents are safe and you can pick it back up anytime. A USCIS receipt is not required.",
  };
}

export function fallbackEvidenceLine(
  docs: { docKind: string; readable: boolean }[],
  input: ConversationMatchInput = {},
): string {
  const unreadableCount = docs.filter((doc) => !doc.readable).length;
  if (docs.length === 0) {
    return isFiledCaseSurface(input)
      ? "No documents are on file yet. Upload notices, receipts, forms, and identity records so each finding can be checked against evidence."
      : "This review uses the situation you described and matching official USCIS or DOJ material. A USCIS receipt is not required.";
  }
  const kinds = Array.from(new Set(docs.map((doc) => doc.docKind).filter(Boolean)));
  return `${docs.length} document${docs.length === 1 ? "" : "s"} uploaded (${kinds.join(", ") || "mixed documents"}).${unreadableCount ? ` ${unreadableCount} document${unreadableCount === 1 ? "" : "s"} still require manual review.` : ""}`;
}

export function resolveFallbackPathSteps(input: ConversationMatchInput = {}): FallbackPathStep[] {
  if (isFiledCaseSurface(input)) {
    return [
      {
        title: "Upload the latest USCIS document",
        description:
          "Add the most recent notice, receipt, approval, RFE, denial, or interview letter so the case posture can be verified.",
        action_key: "UPLOAD_DOCUMENTS",
      },
      {
        title: "Upload or confirm the USCIS case record",
        description:
          "Add receipt notices, online case status records, filing dates, approvals, denials, and deadlines so the timeline can be verified.",
        action_key: "GET_CASE_RECORD",
      },
      {
        title: "Check the updated case review",
        description:
          "Once records are uploaded, the case review updates as the evidence is processed so the next-step plan reflects the newest USCIS evidence.",
        action_key: "REVIEW_ANALYSIS",
      },
    ];
  }
  return [
    {
      title: "Upload matching identity or relationship evidence",
      description:
        "Add passports, visas, or relationship records that the matching official material lists. A USCIS receipt is not required.",
      action_key: "UPLOAD_DOCUMENTS",
    },
    {
      title: "Start the matching USCIS form",
      description: "Open the form the official material ranked first. For a family petition that is Form I-130, not Form I-485.",
      action_key: "PREPARE_FORM",
    },
    {
      title: "Check the updated options review",
      description:
        "Once matching records are uploaded, the options review updates so the next-step plan reflects the newest official material.",
      action_key: "REVIEW_ANALYSIS",
    },
  ];
}
