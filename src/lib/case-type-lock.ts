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

/* ─── Phase C — three locks (Correction Spec §7 / INV-LOCK-01/02) ─── */

/** Contaminating phrases forbidden in VAWA customer copy (golden exact_must_not_include). */
export const VAWA_CONTAMINATION_PHRASES = [
  "Form I-130 instructions describe",
  "Form I-589 and similar packets",
] as const;

export const ANTI_I130_MARRIAGE_ALONE =
  "Do not treat marriage alone as a reason to file a new Form I-130 instead.";

export function isVawaI360Lock(lock: CaseTypeLock | null | undefined): boolean {
  if (!lock) return false;
  return lockedFormNumbers(lock).includes("I-360") || /\bvawa\b/i.test(lock.caseType ?? "");
}

/**
 * Retrieval lock (hard filter): drop knowledge / authority rows that are
 * competing pathway material when the brief locks an existing matter.
 * Soft scoring still applies in knowledge-retrieval; this is the hard gate.
 */
export function passesRetrievalLock(
  text: string,
  lock: CaseTypeLock | null | undefined,
): boolean {
  if (!lock?.doNotRecommendNewPathway) return true;
  const locked = lockedFormNumbers(lock);
  const hay = text;

  // I-589 / country-conditions never enter VAWA (or non-asylum) locked context.
  if (!locked.includes("I-589")) {
    if (/\bi-?589\b/i.test(hay) && !/\bi-?360\b|\bvawa\b/i.test(hay)) return false;
    if (/country.?conditions/i.test(hay) && !/\bi-?360\b|\bvawa\b/i.test(hay)) return false;
  }

  // Competing starter forms as primary evidence framework — keep only if locked.
  for (const form of COMPETING_PATHWAY_FORMS) {
    if (locked.includes(form)) continue;
    const re = new RegExp(`\\b${form.replace("-", "-?")}\\b`, "i");
    if (!re.test(hay)) continue;
    // Allow contrast / anti-recommendation mentions of I-130 under VAWA.
    if (form === "I-130" && isVawaI360Lock(lock)) {
      if (
        /do not|instead of|not (?:a |the )?reason to file|anti.?recommend|rather than|competing/i.test(
          hay,
        )
      ) {
        continue;
      }
      // Pure I-130 instructional / petition-framework material — drop.
      if (/instructions describe|family petition|Form I-130 instructions/i.test(hay)) return false;
      if (/\bi-?130\b/i.test(hay) && !/\bi-?360\b|\bvawa\b|\bi-?485\b/i.test(hay)) return false;
      continue;
    }
    if (isCompetingPathwayForm(form, lock)) {
      if (re.test(hay) && !locked.some((f) => new RegExp(f.replace("-", "-?"), "i").test(hay))) {
        return false;
      }
    }
  }
  return true;
}

export function filterByRetrievalLock<T>(
  items: T[],
  lock: CaseTypeLock | null | undefined,
  textOf: (item: T) => string,
): T[] {
  if (!lock?.doNotRecommendNewPathway) return items;
  return items.filter((item) => passesRetrievalLock(textOf(item), lock));
}

/**
 * Presentation lock: customer-facing strings must not use foreign form
 * families as evidence frameworks under a locked VAWA (etc.) matter.
 */
export function passesPresentationLock(
  text: string,
  lock: CaseTypeLock | null | undefined,
): boolean {
  const t = text.trim();
  if (!t) return false;
  for (const phrase of VAWA_CONTAMINATION_PHRASES) {
    if (t.includes(phrase)) return false;
  }
  if (!lock?.doNotRecommendNewPathway) return true;

  if (isVawaI360Lock(lock)) {
    if (/\bForm I-130 instructions\b/i.test(t)) return false;
    if (/\bForm I-589 and similar packets\b/i.test(t)) return false;
    if (/\bfile Form I-130 first\b/i.test(t)) return false;
    // I-589 as requirement / evidence framework
    if (/\bi-?589\b/i.test(t) && !/do not|instead|not (?:required|needed)/i.test(t)) return false;
    if (/country.?conditions/i.test(t) && !/do not|not required|not needed/i.test(t)) return false;
  }
  return true;
}

export function scrubPresentationContamination(text: string): string {
  let out = text;
  for (const phrase of VAWA_CONTAMINATION_PHRASES) {
    out = out.split(phrase).join("");
  }
  out = out.replace(/\bForm I-130 instructions describe[^.]*\./gi, "");
  out = out.replace(/\bForm I-589 and similar packets[^.]*\./gi, "");
  return out.replace(/\s{2,}/g, " ").trim();
}

/**
 * Recommendation lock: competing starter petitions must not appear as
 * recommended next filings when doNotRecommendNewPathway is set.
 */
export function passesRecommendationLock(
  text: string,
  lock: CaseTypeLock | null | undefined,
): boolean {
  if (!lock?.doNotRecommendNewPathway) return true;
  const t = text.trim();
  if (!t) return false;

  // Explicit anti-recommendations are allowed (INV-LOCK-02 contrast).
  if (
    /do not (?:treat|start|file)|instead of (?:filing|starting)|not (?:a reason to file|recommended as a new)/i.test(
      t,
    )
  ) {
    return true;
  }

  const locked = lockedFormNumbers(lock);
  for (const form of COMPETING_PATHWAY_FORMS) {
    if (locked.includes(form)) continue;
    const re = new RegExp(`\\b${form.replace("-", "-?")}\\b`, "i");
    if (!re.test(t)) continue;
    if (
      /review form|file (?:a |an |form )?|start (?:a |an )?|prepare (?:a |an )?|first (?:us)?cis form|usual first/i.test(
        t,
      )
    ) {
      return false;
    }
  }
  return true;
}

/**
 * Anti-I-130 emission gate (Correction Spec §7).
 * Allowed when locked away from family/I-130 AND there is concrete
 * I-130-shaped contamination risk. Never a global always-on banner.
 */
export function shouldEmitAntiI130(input: {
  lock: CaseTypeLock | null | undefined;
  hasI130ShapedContaminationRisk: boolean;
}): boolean {
  if (!input.hasI130ShapedContaminationRisk) return false;
  const lock = input.lock;
  if (!lock) return false;
  if (lock.lockFamilyOpenOptionsI130) return false;
  if (lockedFormNumbers(lock).includes("I-130") && !isVawaI360Lock(lock)) return false;
  // Emit on VAWA / other non-I-130 locked paths when risk is present.
  if (isVawaI360Lock(lock)) return true;
  if (lock.doNotRecommendNewPathway && !lockedFormNumbers(lock).includes("I-130")) return true;
  return false;
}

/** Heuristic: marriage→I-130 misconception risk from brief / situation text. */
export function detectI130ContaminationRisk(texts: string[]): boolean {
  const blob = texts.join("\n");
  return (
    /\bi-?130\b/i.test(blob) ||
    /Form I-130 instructions/i.test(blob) ||
    /marriage.*(?:petition|i-?130)|(?:file|start).*(?:family petition|i-?130)/i.test(blob) ||
    /spouse (?:is )?(?:a )?u\.?s\.? citizen/i.test(blob) ||
    /married to (?:a )?u\.?s\.? citizen/i.test(blob)
  );
}
