import { extractFormNumbers, normalizeFormNumber } from "./goal-forms";

export const SITUATION_BRIEF_VERSION = 1 as const;

export type SituationFactState = "verified" | "reported" | "unknown";

export type SituationFact = {
  text: string;
  state: SituationFactState;
};

export type SituationBriefInputFact = {
  key: string;
  value: string;
  provenance?: string | null;
  confidence?: string | null;
  sourceText?: string | null;
};

export type SituationBriefInputDocument = {
  fileName?: string | null;
  documentType?: string | null;
  docKind?: string | null;
  text?: string | null;
};

export type SituationBriefInputClarify = {
  question?: string | null;
  answer: string;
};

export type SituationBriefInput = {
  situation?: string | null;
  goal?: string | null;
  documents?: SituationBriefInputDocument[];
  facts?: SituationBriefInputFact[];
  notices?: string[];
  clarifyAnswers?: SituationBriefInputClarify[];
};

export type SituationBrief = {
  version: typeof SITUATION_BRIEF_VERSION;
  caseType: string;
  primaryForm: string | null;
  relatedProcess: string | null;
  relatedForm: string | null;
  customerGoal: string;
  currentPosition: string[];
  situationBullets: SituationFact[];
  verifiedFacts: SituationFact[];
  reportedFacts: SituationFact[];
  unknownFacts: SituationFact[];
  customerQuestion: string;
  doNotRecommendNewPathway: boolean;
  lockFamilyOpenOptionsI130: boolean;
};

const CLARIFIED_LINE_RE = /^\s*\[Clarified(?: evidence)?\]/i;
const VAWA_RE = /\bvawa\b|self-petition|prima facie/i;
const PRIMA_FACIE_RE = /\bprima facie\b/i;
const RFE_RE = /\brequest for evidence\b|\bRFE\b/i;
const MARRIED_USC_RE = /\bmarried to (?:a )?(?:u\.?s\.?|united states) citizen\b|\b(?:u\.?s\.?|united states) citizen (?:spouse|husband|wife)\b|\bmarry a (?:u\.?s\.?|united states) citizen\b/i;
const IN_US_RE = /\bin (?:the )?(?:united states|u\.s\.a?\.?)\b|\bcurrently inside the united states\b/i;
const VISITOR_RE = /\bvisitor visa\b|\bb-?2\b|\btourist visa\b/i;
const EXPIRED_RE = /\b(?:status|visa|stay) (?:later )?expired\b|\boverstay\b|\bexpired\b/i;
const MEDICAL_MISSING_RE = /\b(?:have not|haven't|not yet) (?:completed|done|had).{0,40}medical\b|\bmedical exam(?:ination)? (?:is )?(?:not|missing|outstanding)\b/i;
const WAIVER_RE = /\bwaiver\b/i;
const ADJUSTMENT_FILED_RE = /\b(?:previously |already )?filed (?:for )?(?:adjustment of status|form i-?485|an? i-?485)\b|\bi-?485 (?:was )?filed\b/i;
const GREEN_CARD_RE = /\bgreen card\b|\blawful permanent residenc/i;
const NOTHING_FILED_RE = /\bhave not filed\b|\bnothing filed\b|\bno (?:uscis )?filings?\b|\bnot filed anything\b/i;

function uniq(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

export function isClarifiedInterviewLine(line: string): boolean {
  return CLARIFIED_LINE_RE.test(line);
}

export function stripClarifiedNarrative(text: string | null | undefined): string {
  return String(text ?? "")
    .split(/\n+/)
    .filter((line) => line.trim() && !isClarifiedInterviewLine(line))
    .join("\n")
    .trim();
}

export function parseSituationBrief(value: unknown): SituationBrief | null {
  if (!value) return null;
  let parsed = value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed || trimmed === "{}") return null;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return null;
    }
  }
  if (!parsed || typeof parsed !== "object") return null;
  const brief = parsed as SituationBrief;
  if (brief.version !== SITUATION_BRIEF_VERSION) return null;
  if (typeof brief.caseType !== "string" || !Array.isArray(brief.situationBullets)) return null;
  return brief;
}

function haystack(input: SituationBriefInput): string {
  return [
    stripClarifiedNarrative(input.situation),
    input.goal ?? "",
    ...(input.clarifyAnswers ?? []).map((item) => item.answer),
    ...(input.documents ?? []).map((doc) => `${doc.fileName ?? ""} ${doc.documentType ?? ""} ${doc.docKind ?? ""} ${doc.text ?? ""}`),
    ...(input.facts ?? []).map((fact) => `${fact.key} ${fact.value} ${fact.sourceText ?? ""}`),
    ...(input.notices ?? []),
  ]
    .join("\n")
    .trim();
}

function formsFromInput(input: SituationBriefInput, text: string): string[] {
  const fromFacts = (input.facts ?? [])
    .filter((fact) => fact.key === "form_type")
    .map((fact) => normalizeFormNumber(fact.value))
    .filter((value): value is string => Boolean(value));
  return uniq([...fromFacts, ...extractFormNumbers(text)]);
}

function provenanceIsDocument(provenance?: string | null): boolean {
  const value = String(provenance ?? "").toUpperCase();
  return value === "DOCUMENT_EXTRACTED" || value === "DOCUMENT_VERIFIED";
}

function hasDocumentSignal(input: SituationBriefInput, pattern: RegExp): boolean {
  return (input.documents ?? []).some((doc) =>
    pattern.test(`${doc.fileName ?? ""} ${doc.documentType ?? ""} ${doc.docKind ?? ""} ${doc.text ?? ""}`),
  ) || (input.facts ?? []).some((fact) => provenanceIsDocument(fact.provenance) && pattern.test(`${fact.key} ${fact.value} ${fact.sourceText ?? ""}`));
}

function reportedPrefix(text: string): string {
  const cleaned = text.replace(/\.$/, "").trim();
  if (/^you told us\b/i.test(cleaned)) return cleaned;
  if (/^you /i.test(cleaned)) return `You told us ${cleaned}`;
  return `You told us ${cleaned}`;
}

function pushFact(list: SituationFact[], text: string, state: SituationFactState) {
  const cleaned = text.replace(/\s+/g, " ").trim().replace(/\.$/, "");
  if (!cleaned) return;
  if (list.some((item) => item.text.toLowerCase() === cleaned.toLowerCase())) return;
  list.push({ text: `${cleaned}.`, state });
}

export function reportedFactsFromAnswer(answer: string): { key: string; value: string }[] {
  const facts: { key: string; value: string }[] = [];
  for (const formNumber of extractFormNumbers(answer)) {
    facts.push({ key: "form_type", value: formNumber });
  }
  if (PRIMA_FACIE_RE.test(answer)) facts.push({ key: "notice_type", value: "Prima Facie Determination" });
  if (RFE_RE.test(answer)) facts.push({ key: "notice_type", value: "RFE" });
  return facts;
}

export function buildSituationBrief(input: SituationBriefInput = {}): SituationBrief {
  const situation = stripClarifiedNarrative(input.situation);
  const goal = String(input.goal ?? "").trim();
  const clarifyText = (input.clarifyAnswers ?? []).map((item) => item.answer).join("\n");
  const text = haystack(input);
  const forms = formsFromInput(input, text);
  const hasI360 = forms.includes("I-360") || VAWA_RE.test(text);
  const hasI485Form = forms.includes("I-485");
  const reportsI485 = hasI485Form || ADJUSTMENT_FILED_RE.test(`${situation}\n${clarifyText}\n${goal}`);
  const hasI130Filing = forms.includes("I-130") && !NOTHING_FILED_RE.test(text);
  const primaFacie = PRIMA_FACIE_RE.test(text);
  const primaFacieVerified = hasDocumentSignal(input, PRIMA_FACIE_RE);
  const i360ReceiptVerified = hasDocumentSignal(input, /\bi-?360\b/i) && hasDocumentSignal(input, /\breceipt\b/i);
  const i485ReceiptVerified = hasDocumentSignal(input, /\bi-?485\b/i) && hasDocumentSignal(input, /\breceipt\b/i);
  const rfe = RFE_RE.test(text) || (input.notices ?? []).some((notice) => RFE_RE.test(notice)) || (input.facts ?? []).some((fact) => fact.key === "notice_type" && RFE_RE.test(fact.value));
  const marriedUsc = MARRIED_USC_RE.test(text);
  const inUnitedStates = IN_US_RE.test(text);
  const visitor = VISITOR_RE.test(text);
  const expired = EXPIRED_RE.test(`${situation}\n${clarifyText}`);
  const medicalMissing = MEDICAL_MISSING_RE.test(text);
  const waiver = WAIVER_RE.test(`${situation}\n${clarifyText}\n${goal}`);
  const nothingFiled = NOTHING_FILED_RE.test(text) && !hasI360 && !hasI485Form && !hasI130Filing && !rfe;
  const familyOpenOptions = marriedUsc && nothingFiled && !hasI360 && !rfe;

  let caseType = "Immigration situation";
  let primaryForm: string | null = forms[0] ?? null;
  let relatedForm: string | null = null;
  let relatedProcess: string | null = null;
  let doNotRecommendNewPathway = false;
  let lockFamilyOpenOptionsI130 = false;

  if (hasI360) {
    caseType = "VAWA self-petition";
    primaryForm = "I-360";
    doNotRecommendNewPathway = true;
    if (reportsI485 || hasI485Form) {
      relatedForm = "I-485";
      relatedProcess = "Adjustment of Status";
    }
  } else if (rfe) {
    caseType = "USCIS notice response";
    primaryForm = hasI485Form ? "I-485" : forms.find((form) => form !== "I-797") ?? "I-485";
    doNotRecommendNewPathway = true;
  } else if (hasI485Form && !nothingFiled) {
    caseType = "Adjustment of Status";
    primaryForm = "I-485";
    doNotRecommendNewPathway = true;
  } else if (hasI130Filing) {
    caseType = "Family petition";
    primaryForm = "I-130";
    doNotRecommendNewPathway = true;
    if (reportsI485) {
      relatedForm = "I-485";
      relatedProcess = "Adjustment of Status";
    }
  } else if (familyOpenOptions) {
    caseType = "Family petition options";
    primaryForm = "I-130";
    relatedForm = "I-485";
    relatedProcess = "Adjustment of Status, after a family petition if that path is used";
    lockFamilyOpenOptionsI130 = true;
  }

  const customerGoal = GREEN_CARD_RE.test(goal) || GREEN_CARD_RE.test(situation)
    ? "Obtain a green card"
    : goal || "Understand this immigration situation";

  const verifiedFacts: SituationFact[] = [];
  const reportedFacts: SituationFact[] = [];
  const unknownFacts: SituationFact[] = [];
  const currentPosition: string[] = [];

  if (inUnitedStates) pushFact(reportedFacts, "You are currently in the United States", "reported");
  if (visitor) pushFact(reportedFacts, "You entered using a visitor visa", "reported");
  if (expired && visitor) pushFact(reportedFacts, "You told us that your visitor status later expired", "reported");
  if (marriedUsc) pushFact(reportedFacts, "You are married to a U.S. citizen", "reported");

  if (hasI360 && (i360ReceiptVerified || (input.facts ?? []).some((fact) => fact.key === "form_type" && /i-?360/i.test(fact.value) && provenanceIsDocument(fact.provenance)))) {
    pushFact(verifiedFacts, "You filed Form I-360 as a VAWA self-petitioner", "verified");
    pushFact(verifiedFacts, "USCIS issued a receipt for your Form I-360", "verified");
    currentPosition.push("I-360 filed");
    currentPosition.push("I-360 receipt available");
  } else if (hasI360) {
    pushFact(reportedFacts, reportedPrefix("you filed Form I-360 as a VAWA self-petitioner"), "reported");
    currentPosition.push("I-360 reported as filed");
  }

  if (primaFacieVerified || (primaFacie && hasDocumentSignal(input, PRIMA_FACIE_RE))) {
    pushFact(verifiedFacts, "USCIS issued you a Prima Facie Determination", "verified");
    currentPosition.push("Prima Facie Determination issued");
  } else if (primaFacie) {
    pushFact(reportedFacts, reportedPrefix("you received a Prima Facie Determination"), "reported");
    currentPosition.push("Prima Facie Determination reported");
  }

  if (i485ReceiptVerified) {
    pushFact(verifiedFacts, "USCIS issued a receipt for Form I-485", "verified");
    currentPosition.push("I-485 receipt available");
  } else if (reportsI485) {
    pushFact(reportedFacts, reportedPrefix("you previously filed Form I-485"), "reported");
    currentPosition.push("Customer reports I-485 previously filed");
    pushFact(unknownFacts, "We have not yet reviewed your I-485 receipt", "unknown");
  }

  if (waiver) {
    pushFact(reportedFacts, reportedPrefix("you received a waiver"), "reported");
    currentPosition.push("Customer reports a prior waiver");
    pushFact(unknownFacts, "We have not yet identified the type of waiver", "unknown");
  }

  if (medicalMissing) {
    pushFact(reportedFacts, "You have not completed the immigration medical examination", "reported");
    currentPosition.push("Medical exam not yet completed");
  }

  if (rfe && !hasI360) {
    pushFact((input.facts ?? []).some((fact) => fact.key === "notice_type" && provenanceIsDocument(fact.provenance)) ? verifiedFacts : reportedFacts, "USCIS issued a Request for Evidence", (input.facts ?? []).some((fact) => fact.key === "notice_type" && provenanceIsDocument(fact.provenance)) ? "verified" : "reported");
    currentPosition.push("RFE needs review");
  }

  if (familyOpenOptions) {
    pushFact(reportedFacts, "You have not filed a USCIS petition yet", "reported");
    currentPosition.push("No USCIS filing is on record");
    currentPosition.push("Matching family petition material starts with Form I-130");
  }

  if (GREEN_CARD_RE.test(`${goal}\n${situation}`)) {
    pushFact(reportedFacts, "Your goal is to obtain a green card", "reported");
  }

  if (hasI360 && reportsI485 && !i485ReceiptVerified) {
    pushFact(unknownFacts, "We have not confirmed the status of your I-485", "unknown");
  }
  if (hasI360) {
    pushFact(unknownFacts, "We have not confirmed whether the I-360 has received later USCIS action after the records on file", "unknown");
  }

  const situationBullets = [...verifiedFacts, ...reportedFacts].slice(0, 15);

  let customerQuestion = "What does this immigration situation mean, and what should happen next?";
  if (hasI360 && primaFacie) {
    customerQuestion = "What does the prima facie determination mean for the VAWA case, and how does it relate to getting a green card?";
  } else if (hasI360) {
    customerQuestion = "Where does this VAWA I-360 case stand, and how does it relate to getting a green card?";
  } else if (rfe) {
    customerQuestion = "What does this Request for Evidence mean, and what should I do next?";
  } else if (familyOpenOptions) {
    customerQuestion = "What family immigration options match this situation, and what should I do first?";
  } else if (goal) {
    customerQuestion = goal.replace(/\s+/g, " ").trim();
  }

  return {
    version: SITUATION_BRIEF_VERSION,
    caseType,
    primaryForm,
    relatedProcess,
    relatedForm,
    customerGoal,
    currentPosition: uniq(currentPosition).slice(0, 8),
    situationBullets,
    verifiedFacts,
    reportedFacts,
    unknownFacts,
    customerQuestion,
    doNotRecommendNewPathway,
    lockFamilyOpenOptionsI130,
  };
}

export const VAWA_PRIMA_FACIE_FIXTURE: SituationBriefInput = {
  situation: [
    "I am currently inside the United States.",
    "I originally entered the United States using a visitor visa.",
    "My visitor status later expired.",
    "I am married to a U.S. citizen.",
    "I filed a VAWA self-petition using Form I-360.",
    "I want to understand what the prima facie notice means and how my VAWA case may lead to a green card.",
    "I previously filed for adjustment of status.",
    "I received a waiver.",
    "I have not completed the immigration medical examination.",
  ].join("\n"),
  goal: "Understand my prima facie determination and get a green card",
  documents: [
    {
      fileName: "I-360-receipt.pdf",
      documentType: "receipt_notice",
      text: "USCIS Receipt Notice. Form I-360, Petition for Amerasian, Widow(er), or Special Immigrant. We received your Form I-360.",
    },
    {
      fileName: "prima-facie-determination.pdf",
      documentType: "i797_notice",
      text: "USCIS Prima Facie Determination. This notice is a preliminary determination relating to the eligibility requirements for your VAWA self-petition on Form I-360.",
    },
    {
      fileName: "marriage-certificate.pdf",
      documentType: "supporting_evidence",
      text: "Marriage Certificate.",
    },
    {
      fileName: "personal-declaration.pdf",
      documentType: "supporting_evidence",
      text: "Personal declaration / supporting statement.",
    },
  ],
  facts: [
    { key: "form_type", value: "I-360", provenance: "DOCUMENT_EXTRACTED", sourceText: "Form I-360" },
    { key: "notice_type", value: "I-797", provenance: "DOCUMENT_EXTRACTED", sourceText: "Receipt Notice" },
    { key: "receipt_number", value: "EAC1234567890", provenance: "DOCUMENT_EXTRACTED" },
  ],
};

export const FAMILY_OPEN_OPTIONS_FIXTURE: SituationBriefInput = {
  situation: "I want to marry a US citizen and get a green card. We have not filed anything yet.",
  goal: "Show me what options I have",
  documents: [],
  facts: [],
};

export const RFE_I485_FIXTURE: SituationBriefInput = {
  situation: "I got an RFE from USCIS and the deadline is coming up.",
  goal: "Prepare an RFE response",
  notices: ["RFE"],
  facts: [
    { key: "form_type", value: "I-485", provenance: "DOCUMENT_EXTRACTED" },
    { key: "notice_type", value: "RFE", provenance: "DOCUMENT_EXTRACTED" },
    { key: "response_deadline", value: "July 31, 2026", provenance: "DOCUMENT_EXTRACTED" },
  ],
  documents: [
    { fileName: "rfe.pdf", documentType: "rfe", text: "Request for Evidence. Form I-485. Respond by July 31, 2026." },
  ],
};
