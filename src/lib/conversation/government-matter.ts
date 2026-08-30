/**
 * Government-matter detection (USCIS / EOIR / ICE/CBP / removal-related).
 * Detection may set customer_state — it does NOT by itself invoke V5.1.
 */

const GOVERNMENT_MATTER_RE =
  /\b(receipt\s*(number|#|no\.?)|i-?797|rsc\s*no|msc\s*\d|eac\s*\d|wac\s*\d|lin\s*\d|src\s*\d|ioe\s*\d)\b/i;

const FILED_FORM_RE =
  /\b(filed|pending|submitted|received)\b.{0,40}\b(i-?130|i-?485|i-?765|i-?131|i-?751|i-?589|i-?360|n-?400)\b|\b(i-?130|i-?485|i-?765|i-?131|i-?751|i-?589|i-?360|n-?400)\b.{0,40}\b(filed|pending|submitted|receipt)\b/i;

const NOTICE_EVENT_RE =
  /\b(rfe|request for evidence|noid|notice of intent to deny|interview\s+(scheduled|notice)|denied|denial|appeal\s+pending|motion\s+to\s+reopen)\b/i;

const COURT_REMOVAL_RE =
  /\b(eoir|immigration\s+court|notice\s+to\s+appear|\bi-?862\b|\bnta\b|removal\s+proceedings|deportation\s+proceedings|ice\s+detainer|cbp\s+encounter|expedited\s+removal)\b/i;

export type GovernmentMatterSignal = {
  existing_government_case: boolean;
  signals: string[];
  systems: Array<"uscis" | "eoir" | "ice_cbp_removal">;
};

export function detectGovernmentMatter(text: string, documentHints: string[] = []): GovernmentMatterSignal {
  const combined = [text, ...documentHints].filter(Boolean).join("\n");
  const signals: string[] = [];
  const systems = new Set<"uscis" | "eoir" | "ice_cbp_removal">();

  if (GOVERNMENT_MATTER_RE.test(combined)) {
    signals.push("receipt_or_i797");
    systems.add("uscis");
  }
  if (FILED_FORM_RE.test(combined)) {
    signals.push("filed_form");
    systems.add("uscis");
  }
  if (NOTICE_EVENT_RE.test(combined)) {
    signals.push("notice_event");
    systems.add("uscis");
  }
  if (COURT_REMOVAL_RE.test(combined)) {
    signals.push("court_or_removal");
    systems.add("eoir");
    systems.add("ice_cbp_removal");
  }

  // Explicit “I have not filed” / “yet to file” suppresses weak form-name-only noise.
  const explicitlyUnfiled =
    /\b(yet to file|haven'?t filed|have not filed|no filings? yet|never filed|nothing filed)\b/i.test(combined);
  if (explicitlyUnfiled && !GOVERNMENT_MATTER_RE.test(combined) && !NOTICE_EVENT_RE.test(combined) && !COURT_REMOVAL_RE.test(combined)) {
    return { existing_government_case: false, signals: [], systems: [] };
  }

  return {
    existing_government_case: signals.length > 0,
    signals,
    systems: [...systems],
  };
}
