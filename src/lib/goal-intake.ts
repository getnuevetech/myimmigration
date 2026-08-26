import { isFiledCaseSurface, type FiledSurfaceInput } from "./goal-notices";

export type IntakeMatchInput = FiledSurfaceInput;

export type IntakeChrome = {
  pageTitle: string;
  pageSubtitle: string;
  prefillBanner: string;
  submitLabel: string;
  listCta: string;
  firstCta: string;
  startLabel: string;
  consultantConsent: string;
  consultantRoutedLead: string;
  consultantAwaiting: string;
  consultantDetailsLabel: string;
  consultantPendingPrivacy: string;
  documentsTitle: string;
  lettersTitle: string;
  lettersSubtitle: string;
  documentsEmptyIdentity: string;
  formsSubtitle: string;
  letterGroundHint: string;
  officialMaterialLead: string;
  professionalReview: string;
  verificationHint: string;
  guideNewCaseMessage: string;
  guideNewCaseLabel: string;
  guideOpenStep: string;
  guideNoCaseYet: string;
  guideFallbackNoCase: string;
};

export function resolveIntakeChrome(input: IntakeMatchInput = {}): IntakeChrome {
  if (isFiledCaseSurface(input)) {
    return {
      pageTitle: "Start a new case",
      pageSubtitle: "Tell us what is going on with this USCIS case, letter, or notice. We'll map the next official steps.",
      prefillBanner: "We carried over what you told the guide — review it, add anything missing, and confirm to open this as a new case.",
      submitLabel: "Analyze my case →",
      listCta: "New case →",
      firstCta: "Start your first case",
      startLabel: "Start a case",
      consultantConsent: "view your case details and the documents you've shared",
      consultantRoutedLead: "Why this case was routed to you:",
      consultantAwaiting: "This client's case is awaiting analysis — open for the case details.",
      consultantDetailsLabel: "Case details",
      consultantPendingPrivacy: "Case files, findings, and contact details stay private until the connection is active.",
      documentsTitle: "Documents matched to your case",
      lettersTitle: "USCIS letters, matched to your case",
      lettersSubtitle:
        "Cover letters for the matching official form, or notice responses when a receipt is actually on file. Matching kinds come from official material on your latest case, not a generic RFE reply.",
      documentsEmptyIdentity: "Start with identity documents and relationship evidence for this case. Skip USCIS receipts until you have a filed case.",
      formsSubtitle:
        "Answer simple questions one at a time — like a quiz — and we assemble the real form for you. Matching forms come from the official material on your latest case, not a generic I-485 default.",
      letterGroundHint: "The draft uses the approved posture, next action, and deadlines from this case.",
      officialMaterialLead: "Official material for this case points to",
      professionalReview: "A licensed professional should look at this case",
      verificationHint:
        "Some values in this case couldn't be confirmed against each other — we flag disagreements instead of guessing. More documents (like the USCIS account case record) resolve this.",
      guideNewCaseMessage:
        "That sounds like a separate immigration situation — it deserves its own case so it gets a full analysis, its own issues, and its own step-by-step plan (chat isn't the right place to handle it). Want me to start it as a new case? Your message will be pre-filled and you just confirm.",
      guideNewCaseLabel: "Yes — start this as a new case",
      guideOpenStep: "Open your case and follow the next matching step.",
      guideNoCaseYet: "You haven't started a case yet — tell us what's going on, even if you have not filed anything with USCIS, and we'll map options and next steps.",
      guideFallbackNoCase: "Start by creating a case — describe what happened and your goal, even if you have not filed anything with USCIS, and we'll map options and next steps.",
    };
  }
  return {
    pageTitle: "Start a new situation",
    pageSubtitle: "Tell us what is going on — a life situation with no filing yet, or a USCIS letter if you already have one. We'll map options and next steps.",
    prefillBanner: "We carried over what you told the guide — review it, add anything missing, and confirm to open this as a new situation. A USCIS receipt is not required.",
    submitLabel: "Analyze my situation →",
    listCta: "New situation →",
    firstCta: "Start your first situation",
    startLabel: "Start a situation",
    consultantConsent: "view your situation details and the documents you've shared",
    consultantRoutedLead: "Why this situation was routed to you:",
    consultantAwaiting: "This client's situation is awaiting analysis — open for the situation details.",
    consultantDetailsLabel: "Situation details",
    consultantPendingPrivacy: "Situation files, findings, and contact details stay private until the connection is active.",
    documentsTitle: "Documents matched to your situation",
    lettersTitle: "USCIS letters, matched to your situation",
    lettersSubtitle:
      "Cover letters for the matching official form. A USCIS notice response is optional until a notice is actually on file. Matching kinds come from official material, not a generic RFE reply.",
    documentsEmptyIdentity: "Start with identity documents and relationship evidence for this situation. A USCIS receipt is not required.",
    formsSubtitle:
      "Answer simple questions one at a time — like a quiz — and we assemble the real form for you. Matching forms come from the official material on this situation, not a generic I-485 default.",
    letterGroundHint: "The draft uses the approved posture, next action, and matching records from this situation. A USCIS receipt is not required.",
    officialMaterialLead: "Official material for this situation points to",
    professionalReview: "A licensed professional should look at this situation",
    verificationHint:
      "Some values in this situation couldn't be confirmed against each other — we flag disagreements instead of guessing. More matching documents resolve this. A USCIS case record is not required.",
    guideNewCaseMessage:
      "That sounds like a separate immigration situation — it deserves its own review so it gets a full analysis, its own issues, and its own step-by-step plan (chat isn't the right place to handle it). Want me to start it as a new situation? Your message will be pre-filled and you just confirm. A USCIS receipt is not required.",
    guideNewCaseLabel: "Yes — start this as a new situation",
    guideOpenStep: "Open your situation and follow the next matching step. A USCIS receipt is not required.",
    guideNoCaseYet: "You haven't started a situation yet — tell us what's going on, even if you have not filed anything with USCIS, and we'll map options and next steps.",
    guideFallbackNoCase: "Start by describing your situation and goal, even if you have not filed anything with USCIS, and we'll map options and next steps. A USCIS receipt is not required.",
  };
}
