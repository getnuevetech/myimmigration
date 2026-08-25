import { matchingFormNumber, normalizeFormNumber, rankMatchingForms, type FormMatchInput } from "./goal-forms";

export type LetterKind =
  | "i130_cover"
  | "i485_cover"
  | "i765_cover"
  | "i589_cover"
  | "n400_cover"
  | "i864_cover"
  | "rfe_response"
  | "notice_response";

export type LetterKindDef = {
  kind: LetterKind;
  title: string;
  description: string;
  formNumber: string | null;
  isNoticeResponse: boolean;
  placeholder: string;
};

export type LetterMatchInput = FormMatchInput & {
  noticeTypes?: string[];
};

export type RankedLetter = {
  kind: LetterKind;
  reason: string;
  officialRank: number;
};

export type LetterCatalogAudience = "guest" | "free" | "plus" | "pro" | "staff";

export type LetterCatalogEntitlement = {
  audience: LetterCatalogAudience;
  canGenerate: boolean;
  showRegisterCta: boolean;
  showUpgradeCta: boolean;
};

export const LETTER_CATALOG: LetterKindDef[] = [
  {
    kind: "i130_cover",
    title: "Form I-130 cover letter",
    description: "Introduce a family-based petition packet. Use this when you are preparing Form I-130, not responding to a USCIS notice.",
    formNumber: "I-130",
    isNoticeResponse: false,
    placeholder: "I am a U.S. citizen preparing Form I-130 for my spouse. The packet includes our marriage certificate, identity documents, and proof we share a life together…",
  },
  {
    kind: "i485_cover",
    title: "Form I-485 cover letter",
    description: "Introduce an adjustment-of-status packet for Form I-485 when you are ready to file that form.",
    formNumber: "I-485",
    isNoticeResponse: false,
    placeholder: "I am preparing Form I-485 to apply for adjustment of status. The packet includes the signed form, supporting civil documents, and the required filing fee…",
  },
  {
    kind: "i765_cover",
    title: "Form I-765 cover letter",
    description: "Introduce an employment-authorization packet for Form I-765, including F-1 OPT categories.",
    formNumber: "I-765",
    isNoticeResponse: false,
    placeholder: "I am an F-1 student preparing Form I-765 for optional practical training. The packet includes my I-20, passport biographic page, and photos…",
  },
  {
    kind: "i589_cover",
    title: "Form I-589 cover letter",
    description: "Introduce an asylum or withholding packet for Form I-589.",
    formNumber: "I-589",
    isNoticeResponse: false,
    placeholder: "I am preparing Form I-589 because I fear persecution if I return home. The packet includes my declaration, identity documents, and country-conditions material…",
  },
  {
    kind: "n400_cover",
    title: "Form N-400 cover letter",
    description: "Introduce a naturalization packet for Form N-400.",
    formNumber: "N-400",
    isNoticeResponse: false,
    placeholder: "I am a lawful permanent resident preparing Form N-400 to apply for naturalization. The packet includes my green card copy, identity documents, and the filing fee…",
  },
  {
    kind: "i864_cover",
    title: "Form I-864 cover letter",
    description: "Introduce an affidavit-of-support packet for Form I-864.",
    formNumber: "I-864",
    isNoticeResponse: false,
    placeholder: "I am the sponsor submitting Form I-864 with tax returns and proof of income to support the intending immigrant…",
  },
  {
    kind: "rfe_response",
    title: "RFE response letter",
    description: "Respond to a Request for Evidence on a case that already has a USCIS receipt.",
    formNumber: null,
    isNoticeResponse: true,
    placeholder: "I want to respond to the RFE by explaining the enclosed relationship evidence and asking USCIS to continue processing…",
  },
  {
    kind: "notice_response",
    title: "USCIS notice response",
    description: "Respond to another USCIS notice (receipt, appointment, NOID, or similar) that is already on file.",
    formNumber: null,
    isNoticeResponse: true,
    placeholder: "I want to respond to the USCIS notice by confirming the enclosed records and asking the agency to update my case…",
  },
];

const FORM_COVER_KIND: Record<string, LetterKind> = {
  "I-130": "i130_cover",
  "I-485": "i485_cover",
  "I-765": "i765_cover",
  "I-589": "i589_cover",
  "N-400": "n400_cover",
  "I-864": "i864_cover",
};

const KIND_BY_VALUE = new Map(LETTER_CATALOG.map((item) => [item.kind, item]));

export function letterKindDef(kind: string | null | undefined): LetterKindDef | null {
  const normalized = normalizeLetterKind(kind);
  return normalized ? KIND_BY_VALUE.get(normalized) ?? null : null;
}

export function normalizeLetterKind(value: string | null | undefined): LetterKind | null {
  const key = String(value ?? "").trim().toLowerCase();
  return KIND_BY_VALUE.has(key as LetterKind) ? (key as LetterKind) : null;
}

export function coverKindForForm(formNumber: string | null | undefined): LetterKind | null {
  const normalized = normalizeFormNumber(formNumber);
  return normalized ? FORM_COVER_KIND[normalized] ?? null : null;
}

export function letterKindFromNoticeType(noticeType: string | null | undefined): LetterKind {
  const hay = String(noticeType ?? "").toLowerCase();
  if (/\brfe\b|request for evidence/.test(hay)) return "rfe_response";
  return "notice_response";
}

function putFirst(list: LetterKind[], kind: LetterKind): LetterKind[] {
  return [kind, ...list.filter((item) => item !== kind)];
}

function queryHay(input: LetterMatchInput): string {
  return `${input.query ?? ""} ${(input.noticeTypes ?? []).join(" ")} ${(input.sources ?? []).map((source) => `${source.reference ?? ""} ${source.title ?? ""}`).join(" ")}`.toLowerCase();
}

function mentionsRfe(input: LetterMatchInput): boolean {
  return /\brfe\b|request for evidence/.test(queryHay(input))
    || (input.noticeTypes ?? []).some((type) => /\brfe\b|request for evidence/i.test(type));
}

export function rankMatchingLetters(input: LetterMatchInput = {}): RankedLetter[] {
  const existing = input.inquiryMode === "existing_case";
  const rfe = mentionsRfe(input);
  const kinds: LetterKind[] = [];
  const add = (kind: LetterKind | null | undefined) => {
    if (kind && !kinds.includes(kind)) kinds.push(kind);
  };

  if (existing && rfe) add("rfe_response");

  for (const ranked of rankMatchingForms(input)) {
    add(coverKindForForm(ranked.formNumber));
  }
  add(coverKindForForm(matchingFormNumber(input)));

  if (existing && (rfe || (input.noticeTypes ?? []).length > 0)) add("notice_response");
  add("rfe_response");
  add("notice_response");

  let ordered = kinds;
  if (existing && rfe) {
    ordered = putFirst(ordered, "rfe_response");
  } else {
    const cover = coverKindForForm(matchingFormNumber(input));
    if (cover) ordered = putFirst(ordered, cover);
    ordered = [
      ...ordered.filter((kind) => !letterKindDef(kind)?.isNoticeResponse),
      ...ordered.filter((kind) => letterKindDef(kind)?.isNoticeResponse),
    ];
  }

  return ordered.map((kind, officialRank) => ({
    kind,
    officialRank,
    reason: officialRank === 0
      ? `Best match from official material: ${letterKindDef(kind)?.title}`
      : `Also listed for this situation: ${letterKindDef(kind)?.title}`,
  }));
}

export function matchingLetterKind(input: LetterMatchInput = {}): LetterKind | null {
  return rankMatchingLetters(input)[0]?.kind ?? null;
}

export function letterKindForStep(input: {
  actionKey?: string | null;
  title?: string | null;
  matchingLetter?: string | null;
}): LetterKind | null {
  const hay = String(input.title ?? "").toLowerCase();
  if (/\brfe\b|request for evidence/.test(hay)) return "rfe_response";
  const fromTitle = String(input.title ?? "").toUpperCase().match(/\b(?:I|N|G)-?\d{3}[A-Z]?\b/);
  if (fromTitle) {
    const cover = coverKindForForm(fromTitle[0]);
    if (cover) return cover;
  }
  if (input.matchingLetter) return normalizeLetterKind(input.matchingLetter);
  if ((input.actionKey ?? "").toUpperCase() === "DRAFT_LETTER") return normalizeLetterKind(input.matchingLetter);
  return null;
}

export function letterCatalogHref(kind?: string | null): string {
  const normalized = normalizeLetterKind(kind);
  return normalized ? `/app/letters?kind=${encodeURIComponent(normalized)}` : "/app/letters";
}

export function letterComposerHref(input: {
  caseId?: string | null;
  kind?: string | null;
  noticeId?: string | null;
}): string {
  const params = new URLSearchParams();
  if (input.caseId) params.set("case", input.caseId);
  if (normalizeLetterKind(input.kind)) params.set("kind", normalizeLetterKind(input.kind)!);
  if (input.noticeId) params.set("notice", input.noticeId);
  const query = params.toString();
  return query ? `/app/letters/new?${query}` : "/app/letters/new";
}

export function letterStartLabel(kind?: string | null): string {
  const def = letterKindDef(kind);
  if (!def) return "Draft my letter";
  if (def.kind === "rfe_response") return "Draft RFE response";
  if (def.kind === "notice_response") return "Draft notice response";
  if (def.formNumber) return `Draft ${def.formNumber} cover letter`;
  return `Draft ${def.title}`;
}

export function letterTitleForKind(kind?: string | null, now = new Date()): string {
  const def = letterKindDef(kind);
  const stamp = now.toLocaleDateString("en-US");
  return def ? `${def.title} — ${stamp}` : `USCIS letter — ${stamp}`;
}

export function rankLetterCatalog<T extends { kind: string }>(items: T[], ranked: RankedLetter[]): T[] {
  if (!ranked.length) return items;
  const order = new Map<string, number>(ranked.map((item, index) => [item.kind, index]));
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const aRank = order.get(normalizeLetterKind(a.item.kind) ?? a.item.kind);
      const bRank = order.get(normalizeLetterKind(b.item.kind) ?? b.item.kind);
      const aScore = aRank == null ? 1000 + a.index : aRank;
      const bScore = bRank == null ? 1000 + b.index : bRank;
      return aScore - bScore;
    })
    .map((entry) => entry.item);
}

export function resolveLetterCatalogEntitlement(input: {
  isGuest?: boolean;
  isStaff?: boolean;
  planKey?: string;
  hasLetters?: boolean;
}): LetterCatalogEntitlement {
  if (input.isGuest) {
    return {
      audience: "guest",
      canGenerate: false,
      showRegisterCta: true,
      showUpgradeCta: false,
    };
  }
  if (input.isStaff) {
    return {
      audience: "staff",
      canGenerate: true,
      showRegisterCta: false,
      showUpgradeCta: false,
    };
  }
  const planKey = (input.planKey || "free").toLowerCase();
  const audience: LetterCatalogAudience = planKey === "pro" ? "pro" : planKey === "plus" ? "plus" : "free";
  const canGenerate = Boolean(input.hasLetters);
  return {
    audience,
    canGenerate,
    showRegisterCta: false,
    showUpgradeCta: !canGenerate,
  };
}

export function letterGenerationAllowed(input: {
  canGenerate: boolean;
  used: number;
  limit: number | null;
}): { allowed: boolean; remaining: number | null; overLimit: boolean } {
  if (!input.canGenerate) {
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
  return { allowed: remaining > 0, remaining, overLimit: remaining === 0 };
}

export function letterWriterInstruction(kind?: string | null): string {
  const def = letterKindDef(kind);
  if (!def || !def.isNoticeResponse) {
    const form = def?.formNumber ? `Form ${def.formNumber}` : "the matching official form";
    return `LETTER KIND: ${def?.kind ?? "cover"}. Draft a cover or preparation letter for ${form}. Do not invent a receipt number, RFE, deadline, or filed-case posture. If no receipt or notice appears in the context, omit Receipt No. entirely.`;
  }
  return `LETTER KIND: ${def.kind}. Draft a response to the USCIS notice. Use a receipt number, form type, or deadline only if it appears in the context, approved presentation, or evidence brief. Do not invent those values.`;
}

export function fallbackLetterDraft(kind: string | null | undefined, context: string): string {
  const normalized = normalizeLetterKind(kind);
  const def = letterKindDef(normalized);
  const snippet = String(context ?? "").replace(/\s+/g, " ").trim().slice(0, 300) || "Describe the enclosed documents and what you are asking USCIS to do.";
  if (def?.isNoticeResponse) {
    return `[DATE]

U.S. Citizenship and Immigration Services
[USCIS ADDRESS FROM YOUR NOTICE]

Re: [FORM TYPE / NOTICE TYPE] — Receipt No. [RECEIPT NUMBER]
Applicant: [YOUR NAME]
A-Number: [A-NUMBER IF ANY]

To Whom It May Concern:

I am writing in response to the notice referenced above.

[Describe your situation here: ${snippet}]

I respectfully request that you review the enclosed documentation and update my case record accordingly. Please contact me at the address or phone number below if you need any additional information.

Sincerely,

[YOUR NAME]
[YOUR ADDRESS]
[YOUR PHONE]

Enclosures: [LIST YOUR DOCUMENTS]`;
  }

  const formLabel = def?.formNumber ? `Form ${def.formNumber}` : "[FORM TYPE]";
  return `[DATE]

U.S. Citizenship and Immigration Services
[USCIS LOCKBOX OR FILING ADDRESS FROM THE FORM INSTRUCTIONS]

Re: ${formLabel} — [PETITION / APPLICATION]
Applicant/Petitioner: [YOUR NAME]
Beneficiary: [BENEFICIARY NAME IF ANY]
A-Number: [A-NUMBER IF ANY]

To Whom It May Concern:

I am submitting ${formLabel === "[FORM TYPE]" ? "the enclosed immigration form" : formLabel} with supporting documents.

[Describe your situation here: ${snippet}]

I respectfully request that you accept this packet for processing. Please contact me at the address or phone number below if you need any additional information.

Sincerely,

[YOUR NAME]
[YOUR ADDRESS]
[YOUR PHONE]

Enclosures: [LIST YOUR DOCUMENTS]`;
}
