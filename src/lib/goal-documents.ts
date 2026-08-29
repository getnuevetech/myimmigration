import { matchingFormNumber, type FormMatchInput } from "./goal-forms";
import { shouldExcludeCountryConditions } from "./case-type-lock";

export type DocumentKindDef = {
  kind: string;
  name: string;
  hint: string;
  isFiledCase: boolean;
};

export type DocumentMatchInput = FormMatchInput & {
  noticeTypes?: string[];
  haveKinds?: string[];
};

export type RankedDocument = {
  kind: string;
  label: string;
  hint: string;
  officialRank: number;
  reason: string;
};

export type DocumentCatalogAudience = "guest" | "free" | "plus" | "pro" | "staff";

export type DocumentCatalogEntitlement = {
  audience: DocumentCatalogAudience;
  canUpload: boolean;
  showRegisterCta: boolean;
  showUpgradeCta: boolean;
};

export const DOCUMENT_CATALOG: DocumentKindDef[] = [
  {
    kind: "identity",
    name: "Passport / visa / identity document",
    hint: "Shows who you are — passport biographic page, national ID, or birth certificate.",
    isFiledCase: false,
  },
  {
    kind: "relationship",
    name: "Marriage and relationship evidence",
    hint: "Marriage certificate and proof you share a life together, as Form I-130 instructions describe.",
    isFiledCase: false,
  },
  {
    kind: "status_record",
    name: "Status record (I-20, green card, visa stamp)",
    hint: "Shows current status — I-20, permanent resident card, visa stamp, or EAD.",
    isFiledCase: false,
  },
  {
    kind: "declaration",
    name: "Personal declaration / statement",
    hint: "Your written account of the facts, as Form I-589 and similar packets request.",
    isFiledCase: false,
  },
  {
    kind: "country_conditions",
    name: "Country-conditions material",
    hint: "Reports or articles about conditions in the country of feared harm.",
    isFiledCase: false,
  },
  {
    kind: "form",
    name: "Immigration form",
    hint: "A draft or filed USCIS form packet.",
    isFiledCase: false,
  },
  {
    kind: "evidence",
    name: "Supporting evidence",
    hint: "Other records the matching official form lists as relevant.",
    isFiledCase: false,
  },
  {
    kind: "notice",
    name: "USCIS notice or letter",
    hint: "A notice USCIS already sent — receipt, appointment, RFE, or similar.",
    isFiledCase: true,
  },
  {
    kind: "rfe",
    name: "Request for Evidence (RFE)",
    hint: "The RFE itself, used only when USCIS has already issued one.",
    isFiledCase: true,
  },
  {
    kind: "receipt",
    name: "USCIS receipt notice",
    hint: "An I-797 receipt for a case that is already on file.",
    isFiledCase: true,
  },
  {
    kind: "case_record",
    name: "USCIS case record / online account",
    hint: "A case-status printout or account record with a receipt number.",
    isFiledCase: true,
  },
  {
    kind: "approval",
    name: "USCIS approval notice",
    hint: "An approval notice for a case that is already decided.",
    isFiledCase: true,
  },
  {
    kind: "other",
    name: "Other",
    hint: "Anything else you want stored with this situation. A USCIS receipt is not required.",
    isFiledCase: false,
  },
];

const KIND_BY_VALUE = new Map(DOCUMENT_CATALOG.map((item) => [item.kind, item]));

const THEME_DOC_KINDS: Record<string, string[]> = {
  family: ["identity", "relationship", "form"],
  parents_children: ["identity", "relationship", "form"],
  student: ["identity", "status_record", "form"],
  employment: ["identity", "status_record", "form"],
  asylum: ["identity", "declaration", "country_conditions"],
  humanitarian: ["identity", "declaration", "country_conditions"],
  naturalization: ["identity", "status_record", "form"],
  adjustment: ["identity", "form", "evidence"],
  consular: ["identity", "relationship", "form"],
  visitor: ["identity", "status_record"],
  general: ["identity", "evidence"],
};

export function documentKindDef(kind: string | null | undefined): DocumentKindDef | null {
  const key = String(kind ?? "").trim().toLowerCase();
  return KIND_BY_VALUE.get(key) ?? null;
}

export function normalizeDocumentKind(kind: string | null | undefined): string | null {
  return documentKindDef(kind)?.kind ?? null;
}

export function documentKindFromEvidenceItem(item: string): string {
  const hay = String(item ?? "").toLowerCase();
  if (/\b(rfe|request for evidence)\b/.test(hay)) return "rfe";
  if (/\breceipt\b/.test(hay)) return "receipt";
  if (/\bnotice\b/.test(hay)) return "notice";
  if (/\b(passport|identity|birth certificate|photo(?:graph)?s?|biographic)\b/.test(hay)) return "identity";
  if (/\b(marriage|relationship|bona fide|spouse|civil documents?)\b/.test(hay)) return "relationship";
  if (/\b(i-?20|sevis|opt|green card|permanent resident card|ead|employment authorization)\b/.test(hay)) return "status_record";
  if (/\b(country.?conditions?|persecution)\b/.test(hay)) return "country_conditions";
  if (/\b(declaration|personal statement)\b/.test(hay) && !/\baffidavit of support\b/.test(hay)) return "declaration";
  if (/\b(i-?864|affidavit of support|form i-?\d+)\b/.test(hay)) return "form";
  return "evidence";
}

function queryHay(input: DocumentMatchInput): string {
  return `${input.query ?? ""} ${(input.noticeTypes ?? []).join(" ")} ${(input.sources ?? []).map((source) => `${source.reference ?? ""} ${source.title ?? ""} ${source.content ?? ""}`).join(" ")}`.toLowerCase();
}

function mentionsRfe(input: DocumentMatchInput): boolean {
  return /\brfe\b|request for evidence/.test(queryHay(input))
    || (input.noticeTypes ?? []).some((type) => /\brfe\b|request for evidence/i.test(type));
}

function putFirst(list: string[], kind: string): string[] {
  if (!kind) return list;
  return [kind, ...list.filter((item) => item !== kind)];
}

export function rankMatchingDocuments(input: DocumentMatchInput = {}): RankedDocument[] {
  const existing = input.inquiryMode === "existing_case";
  const rfe = mentionsRfe(input);
  const kinds: string[] = [];
  const add = (kind: string | null | undefined) => {
    const normalized = normalizeDocumentKind(kind);
    if (normalized && !kinds.includes(normalized)) kinds.push(normalized);
  };

  if (existing && rfe) {
    add("rfe");
    add("notice");
    add("evidence");
    add("case_record");
  }

  const formNumber = matchingFormNumber(input);
  if (formNumber === "I-130") {
    add("identity");
    add("relationship");
    add("form");
  } else if (formNumber === "I-360") {
    add("identity");
    add("relationship");
    add("declaration");
    add("form");
    add("notice");
    add("receipt");
  } else if (formNumber === "I-765") {
    add("identity");
    add("status_record");
    add("form");
  } else if (formNumber === "I-589") {
    add("identity");
    add("declaration");
    add("country_conditions");
    add("form");
  } else if (formNumber === "N-400") {
    add("identity");
    add("status_record");
    add("form");
  } else if (formNumber === "I-485") {
    add("identity");
    add("form");
    add("evidence");
  }

  for (const source of input.sources ?? []) {
    add(documentKindFromEvidenceItem(`${source.reference ?? ""} ${source.title ?? ""} ${source.content ?? ""}`));
  }
  for (const theme of input.themes ?? []) {
    for (const kind of THEME_DOC_KINDS[theme] ?? []) {
      if (kind === "country_conditions" && shouldExcludeCountryConditions(input.caseLock)) continue;
      add(kind);
    }
  }

  add("identity");
  add("evidence");
  add("form");
  if (existing) {
    add("notice");
    add("case_record");
    add("receipt");
  }
  add("rfe");
  add("receipt");
  add("case_record");
  add("approval");
  add("notice");
  add("other");

  let ordered = kinds;
  if (existing && rfe) {
    ordered = putFirst(putFirst(putFirst(ordered, "case_record"), "notice"), "rfe");
  } else {
    const preferred = formNumber === "I-130"
      ? "identity"
      : formNumber === "I-360"
        ? "notice"
        : formNumber === "I-765"
          ? "identity"
          : formNumber === "I-589"
            ? "identity"
            : kinds.find((kind) => !documentKindDef(kind)?.isFiledCase) ?? "evidence";
    ordered = putFirst(ordered, preferred);
    if (formNumber === "I-130") ordered = putFirst(putFirst(ordered, "relationship"), "identity");
    if (formNumber === "I-360") {
      ordered = putFirst(putFirst(putFirst(putFirst(ordered, "identity"), "relationship"), "declaration"), "notice");
    }
    if (formNumber === "I-765") ordered = putFirst(putFirst(ordered, "status_record"), "identity");
    if (formNumber === "I-589") ordered = putFirst(putFirst(putFirst(ordered, "country_conditions"), "declaration"), "identity");
    if (shouldExcludeCountryConditions(input.caseLock)) {
      ordered = ordered.filter((kind) => kind !== "country_conditions");
    }
    ordered = [
      ...ordered.filter((kind) => !documentKindDef(kind)?.isFiledCase),
      ...ordered.filter((kind) => documentKindDef(kind)?.isFiledCase),
    ];
  }

  return ordered.map((kind, officialRank) => {
    const def = documentKindDef(kind);
    return {
      kind,
      label: def?.name ?? kind,
      hint: def?.hint ?? "",
      officialRank,
      reason: officialRank === 0
        ? `Best match from official material: ${def?.name ?? kind}`
        : `Also listed for this situation: ${def?.name ?? kind}`,
    };
  });
}

export function matchingDocumentKind(input: DocumentMatchInput = {}): string | null {
  return rankMatchingDocuments(input)[0]?.kind ?? null;
}

export function rankDocumentCatalog<T extends { kind: string }>(items: T[], ranked: RankedDocument[]): T[] {
  if (!ranked.length) return items;
  const order = new Map<string, number>(ranked.map((item, index) => [item.kind, index]));
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const aRank = order.get(normalizeDocumentKind(a.item.kind) ?? a.item.kind);
      const bRank = order.get(normalizeDocumentKind(b.item.kind) ?? b.item.kind);
      const aScore = aRank == null ? 1000 + a.index : aRank;
      const bScore = bRank == null ? 1000 + b.index : bRank;
      return aScore - bScore;
    })
    .map((entry) => entry.item);
}

export function documentCatalogForSurface(input: DocumentMatchInput = {}): DocumentKindDef[] {
  const filed = input.inquiryMode === "open_options"
    ? false
    : input.inquiryMode === "existing_case" || mentionsRfe(input);
  return DOCUMENT_CATALOG.map((item) => {
    if (item.kind !== "other") return item;
    return {
      ...item,
      hint: filed
        ? "Anything else you want stored with this case."
        : "Anything else you want stored with this situation. A USCIS receipt is not required.",
    };
  });
}

export function neededDocumentsFromRanked(ranked: RankedDocument[]): RankedDocument[] {
  const firstIsFiled = Boolean(ranked[0] && documentKindDef(ranked[0].kind)?.isFiledCase);
  return ranked
    .filter((item) => item.kind !== "other")
    .filter((item) => firstIsFiled || !documentKindDef(item.kind)?.isFiledCase)
    .slice(0, 6);
}

export function documentCatalogHref(kind?: string | null): string {
  const normalized = normalizeDocumentKind(kind);
  return normalized ? `/app/documents?kind=${encodeURIComponent(normalized)}` : "/app/documents";
}

export function documentStartLabel(kind?: string | null): string {
  const def = documentKindDef(kind);
  return def ? `Upload ${def.name}` : "Upload matching documents";
}

export function resolveDocumentCatalogEntitlement(input: {
  isGuest?: boolean;
  isStaff?: boolean;
  planKey?: string;
  hasUpload?: boolean;
}): DocumentCatalogEntitlement {
  if (input.isGuest) {
    return {
      audience: "guest",
      canUpload: false,
      showRegisterCta: true,
      showUpgradeCta: false,
    };
  }
  if (input.isStaff) {
    return {
      audience: "staff",
      canUpload: true,
      showRegisterCta: false,
      showUpgradeCta: false,
    };
  }
  const planKey = (input.planKey || "free").toLowerCase();
  const audience: DocumentCatalogAudience = planKey === "pro" ? "pro" : planKey === "plus" ? "plus" : "free";
  return {
    audience,
    canUpload: Boolean(input.hasUpload),
    showRegisterCta: false,
    showUpgradeCta: !input.hasUpload,
  };
}

export function documentUploadAllowed(input: {
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
