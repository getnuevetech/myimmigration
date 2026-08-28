/**
 * Case-type lock derived from the Situation Brief (V5 Rules 5–6).
 * Existing proceedings beat hypothetical new pathways; retrieval and
 * matching lists stay on the locked matter and related filings only.
 */

export type CaseTypeLock = {
  primaryForm: string | null;
  relatedForm: string | null;
  doNotRecommendNewPathway: boolean;
  lockFamilyOpenOptionsI130: boolean;
  caseType?: string;
};

/** Competing starter petitions that must not displace a locked existing matter. */
const COMPETING_PATHWAY_FORMS = new Set(["I-130", "I-589", "N-400", "I-821", "I-821D", "I-129"]);

/** Themes that pull unrelated asylum / country-conditions material. */
const ASYLUM_LIKE_THEMES = new Set(["asylum"]);

function normalizeForm(value: string | null | undefined): string | null {
  const match = String(value ?? "")
    .trim()
    .toUpperCase()
    .match(/^(I|N|G|DS)-?(\d{3}[A-Z]?)$/);
  if (!match) return null;
  return `${match[1]}-${match[2]}`;
}

export function caseTypeLockFromBrief(
  brief: {
    primaryForm?: string | null;
    relatedForm?: string | null;
    doNotRecommendNewPathway?: boolean;
    lockFamilyOpenOptionsI130?: boolean;
    caseType?: string;
  } | null | undefined,
): CaseTypeLock | null {
  if (!brief) return null;
  const primaryForm = normalizeForm(brief.primaryForm) ?? null;
  const relatedForm = normalizeForm(brief.relatedForm) ?? null;
  if (
    !primaryForm &&
    !relatedForm &&
    !brief.doNotRecommendNewPathway &&
    !brief.lockFamilyOpenOptionsI130
  ) {
    return null;
  }
  return {
    primaryForm,
    relatedForm,
    doNotRecommendNewPathway: Boolean(brief.doNotRecommendNewPathway),
    lockFamilyOpenOptionsI130: Boolean(brief.lockFamilyOpenOptionsI130),
    caseType: brief.caseType,
  };
}

export function lockedFormNumbers(lock: CaseTypeLock | null | undefined): string[] {
  if (!lock) return [];
  const forms: string[] = [];
  for (const value of [lock.primaryForm, lock.relatedForm]) {
    const form = normalizeForm(value);
    if (form && !forms.includes(form)) forms.push(form);
  }
  return forms;
}

export function isCompetingPathwayForm(formNumber: string | null | undefined, lock: CaseTypeLock | null | undefined): boolean {
  if (!lock?.doNotRecommendNewPathway) return false;
  const form = normalizeForm(formNumber);
  if (!form || !COMPETING_PATHWAY_FORMS.has(form)) return false;
  const locked = lockedFormNumbers(lock);
  return !locked.includes(form);
}

export function scopeAuthorityQueries(queries: string[], lock: CaseTypeLock | null | undefined): string[] {
  const base = Array.from(new Set(queries.map((item) => String(item ?? "").trim()).filter(Boolean)));
  if (!lock) return base;
  const locked = lockedFormNumbers(lock);
  if (lock.doNotRecommendNewPathway && locked.length) {
    const kept = base.filter((query) => {
      const form = normalizeForm(query);
      if (!form) return true;
      if (locked.includes(form)) return true;
      return !COMPETING_PATHWAY_FORMS.has(form);
    });
    return Array.from(new Set([...locked, ...kept]));
  }
  if (lock.lockFamilyOpenOptionsI130) {
    const withFamily = base.includes("I-130") ? base : ["I-130", ...base];
    return withFamily[0] === "I-130" ? withFamily : ["I-130", ...withFamily.filter((item) => item !== "I-130")];
  }
  return base;
}

export function scopeInquiryThemes<T extends string>(themes: T[], lock: CaseTypeLock | null | undefined): T[] {
  if (!lock?.doNotRecommendNewPathway) return themes;
  const filtered = themes.filter((theme) => !ASYLUM_LIKE_THEMES.has(theme));
  return filtered.length ? filtered : themes;
}

/**
 * Reorder / filter form lists so the locked primary matter wins over theme matching.
 */
export function applyCaseTypeFormLock(forms: string[], lock: CaseTypeLock | null | undefined): string[] {
  if (!lock) return forms;
  let ranked = forms
    .map((form) => normalizeForm(form) ?? form)
    .filter(Boolean);

  if (lock.doNotRecommendNewPathway) {
    ranked = ranked.filter((form) => !isCompetingPathwayForm(form, lock));
    const locked = lockedFormNumbers(lock);
    for (const form of [...locked].reverse()) {
      if (!ranked.includes(form)) ranked.unshift(form);
      else ranked = [form, ...ranked.filter((item) => item !== form)];
    }
    if (lock.primaryForm && lock.relatedForm && lock.primaryForm !== lock.relatedForm) {
      ranked = [
        lock.primaryForm,
        lock.relatedForm,
        ...ranked.filter((item) => item !== lock.primaryForm && item !== lock.relatedForm),
      ];
    } else if (lock.primaryForm) {
      ranked = [lock.primaryForm, ...ranked.filter((item) => item !== lock.primaryForm)];
    }
    return ranked;
  }

  if (lock.lockFamilyOpenOptionsI130) {
    if (!ranked.includes("I-130")) ranked.unshift("I-130");
    ranked = ["I-130", ...ranked.filter((item) => item !== "I-130")];
    if (ranked.includes("I-485")) {
      ranked = ["I-130", "I-485", ...ranked.filter((item) => item !== "I-130" && item !== "I-485")];
    }
  }
  return ranked;
}

/** Document kinds that belong to asylum packets — drop when locked away from I-589. */
export function shouldExcludeCountryConditions(lock: CaseTypeLock | null | undefined): boolean {
  if (!lock?.doNotRecommendNewPathway) return false;
  const locked = lockedFormNumbers(lock);
  if (locked.includes("I-589")) return false;
  return true;
}
