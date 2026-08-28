import { applyCaseTypeFormLock, type CaseTypeLock } from "./case-type-lock";

export type FormMatchSource = {
  reference?: string | null;
  title?: string | null;
  tags?: string | null;
  content?: string | null;
};

export type FormMatchInput = {
  sources?: FormMatchSource[];
  themes?: string[];
  inquiryMode?: string;
  query?: string;
  authorityQueries?: string[];
  /** V5 Rules 5–6: lock ranking to the situation brief’s primary matter. */
  caseLock?: CaseTypeLock | null;
};

export type RankedForm = {
  formNumber: string;
  reason: string;
  officialRank: number;
};

export type FormCatalogAudience = "guest" | "free" | "plus" | "pro" | "staff";

export type FormCatalogEntitlement = {
  audience: FormCatalogAudience;
  canStartWizard: boolean;
  showRegisterCta: boolean;
  showUpgradeCta: boolean;
};

const NOTICE_FORMS = new Set(["I-797", "I-797A", "I-797B", "I-797C"]);

const THEME_FORMS: Record<string, string[]> = {
  family: ["I-130", "I-485", "I-864"],
  parents_children: ["I-130", "I-864"],
  adjustment: ["I-485", "I-765"],
  student: ["I-765"],
  employment: ["I-765"],
  asylum: ["I-589"],
  naturalization: ["N-400"],
  humanitarian: ["I-589"],
  consular: ["I-130"],
  visitor: [],
  general: [],
};

export function normalizeFormNumber(value: string | null | undefined): string | null {
  const match = String(value ?? "")
    .trim()
    .toUpperCase()
    .match(/^(I|N|G|DS)-?(\d{3}[A-Z]?)$/);
  if (!match) return null;
  const formNumber = `${match[1]}-${match[2]}`;
  return NOTICE_FORMS.has(formNumber) ? null : formNumber;
}

export function extractFormNumbers(text: string): string[] {
  const found: string[] = [];
  for (const match of String(text ?? "").matchAll(/\b(?:I|N|G|DS)-?\d{3}[A-Z]?\b/gi)) {
    const formNumber = normalizeFormNumber(match[0]);
    if (formNumber && !found.includes(formNumber)) found.push(formNumber);
  }
  return found;
}

export function formNumberFromTitle(title: string | null | undefined): string | null {
  return extractFormNumbers(title ?? "")[0] ?? null;
}

function formsFromSource(source: FormMatchSource): string[] {
  const meta = `${source.reference ?? ""} ${source.title ?? ""} ${source.tags ?? ""}`;
  const fromMeta = extractFormNumbers(meta);
  if (fromMeta.length) return fromMeta;
  return extractFormNumbers(source.content ?? "");
}

function putFirst(list: string[], formNumber: string): string[] {
  if (!formNumber) return list;
  return [formNumber, ...list.filter((item) => item !== formNumber)];
}

function applyOfficialFormOrder(forms: string[], input: FormMatchInput): string[] {
  const lock = input.caseLock ?? null;
  // Existing locked matter wins over theme-based pathway guessing (V5 Rules 5–6).
  if (lock?.doNotRecommendNewPathway && (lock.primaryForm || lock.relatedForm)) {
    return applyCaseTypeFormLock(forms, lock);
  }

  const themes = input.themes ?? [];
  const queryHay = `${input.query ?? ""} ${(input.sources ?? []).map((source) => `${source.reference ?? ""} ${source.title ?? ""}`).join(" ")}`.toLowerCase();
  const existing = input.inquiryMode === "existing_case";
  const rfe = /\brfe\b|request for evidence/.test(queryHay);
  const mentionsI485 = /\bi-?485\b/.test(queryHay);
  let ranked = [...forms];

  const ensure = (formNumber: string) => {
    if (!ranked.includes(formNumber)) ranked.push(formNumber);
  };

  if (existing && (rfe || mentionsI485) && (themes.includes("adjustment") || ranked.includes("I-485") || mentionsI485)) {
    ensure("I-485");
    return applyCaseTypeFormLock(putFirst(ranked, "I-485"), lock);
  }
  if (themes.includes("asylum")) {
    ensure("I-589");
    return applyCaseTypeFormLock(putFirst(ranked, "I-589"), lock);
  }
  if (themes.includes("student")) {
    ensure("I-765");
    return applyCaseTypeFormLock(putFirst(ranked, "I-765"), lock);
  }
  if (themes.includes("naturalization") && !themes.includes("family")) {
    ensure("N-400");
    return applyCaseTypeFormLock(putFirst(ranked, "N-400"), lock);
  }
  if (themes.includes("family") || themes.includes("parents_children") || lock?.lockFamilyOpenOptionsI130) {
    ensure("I-130");
    ranked = putFirst(ranked, "I-130");
    if (ranked.includes("I-485")) {
      ranked = ["I-130", "I-485", ...ranked.filter((item) => item !== "I-130" && item !== "I-485")];
    }
    return applyCaseTypeFormLock(ranked, lock);
  }
  return applyCaseTypeFormLock(ranked, lock);
}

export function rankMatchingForms(input: FormMatchInput = {}): RankedForm[] {
  const ordered: string[] = [];
  const add = (value: string | null | undefined) => {
    const formNumber = value ? normalizeFormNumber(value) ?? extractFormNumbers(value)[0] : null;
    if (formNumber && !ordered.includes(formNumber)) ordered.push(formNumber);
  };

  // Seed locked forms first so theme maps cannot bury the existing matter.
  if (input.caseLock?.primaryForm) add(input.caseLock.primaryForm);
  if (input.caseLock?.relatedForm) add(input.caseLock.relatedForm);

  for (const source of input.sources ?? []) {
    for (const formNumber of formsFromSource(source)) add(formNumber);
  }
  for (const query of input.authorityQueries ?? []) add(query);
  for (const formNumber of extractFormNumbers(input.query ?? "")) add(formNumber);
  for (const theme of input.themes ?? []) {
    for (const formNumber of THEME_FORMS[theme] ?? []) add(formNumber);
  }

  const ranked = applyOfficialFormOrder(ordered, input);
  return ranked.map((formNumber, officialRank) => ({
    formNumber,
    officialRank,
    reason: officialRank === 0
      ? `Best match from official material: Form ${formNumber}`
      : `Also listed in matching official material: Form ${formNumber}`,
  }));
}

export function matchingFormNumber(input: FormMatchInput = {}): string | null {
  return rankMatchingForms(input)[0]?.formNumber ?? null;
}

export function formActionKey(formNumber: string | null | undefined): "COMPLETE_FORM_I485" | "PREPARE_FORM" {
  return normalizeFormNumber(formNumber) === "I-485" ? "COMPLETE_FORM_I485" : "PREPARE_FORM";
}

export function formNumberForStep(input: {
  actionKey?: string | null;
  title?: string | null;
  matchingForm?: string | null;
}): string | null {
  const fromTitle = formNumberFromTitle(input.title);
  if (fromTitle) return fromTitle;
  if (input.matchingForm) return normalizeFormNumber(input.matchingForm);
  if ((input.actionKey ?? "").toUpperCase() === "COMPLETE_FORM_I485") return "I-485";
  return null;
}

export function formCatalogHref(formNumber?: string | null): string {
  const normalized = formNumber ? normalizeFormNumber(formNumber) : null;
  return normalized ? `/app/forms?form=${encodeURIComponent(normalized)}` : "/app/forms";
}

export function formStartLabel(formNumber?: string | null): string {
  const normalized = formNumber ? normalizeFormNumber(formNumber) : null;
  return normalized ? `Start Form ${normalized}` : "See matching USCIS forms";
}

export function rankFormCatalog<T extends { formNumber: string }>(templates: T[], ranked: RankedForm[]): T[] {
  if (!ranked.length) return templates;
  const order = new Map(ranked.map((item, index) => [item.formNumber, index]));
  return templates
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const aRank = order.get(normalizeFormNumber(a.item.formNumber) ?? a.item.formNumber);
      const bRank = order.get(normalizeFormNumber(b.item.formNumber) ?? b.item.formNumber);
      const aScore = aRank == null ? 1000 + a.index : aRank;
      const bScore = bRank == null ? 1000 + b.index : bRank;
      return aScore - bScore;
    })
    .map((entry) => entry.item);
}

export function resolveFormCatalogEntitlement(input: {
  isGuest?: boolean;
  isStaff?: boolean;
  planKey?: string;
  hasWizard?: boolean;
}): FormCatalogEntitlement {
  if (input.isGuest) {
    return {
      audience: "guest",
      canStartWizard: false,
      showRegisterCta: true,
      showUpgradeCta: false,
    };
  }
  if (input.isStaff) {
    return {
      audience: "staff",
      canStartWizard: true,
      showRegisterCta: false,
      showUpgradeCta: false,
    };
  }
  const planKey = (input.planKey || "free").toLowerCase();
  const audience: FormCatalogAudience = planKey === "pro" ? "pro" : planKey === "plus" ? "plus" : "free";
  const canStartWizard = Boolean(input.hasWizard);
  return {
    audience,
    canStartWizard,
    showRegisterCta: false,
    showUpgradeCta: !canStartWizard,
  };
}
