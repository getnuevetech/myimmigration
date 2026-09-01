import type { PreScreenSignal, SituationFactSet } from "./types";
import { factValue } from "./reconcile";

/**
 * Lightweight country/program pre-screen (Phase SI-2).
 * Curated signals only — not full legal research, not eligibility conclusions.
 * Elevates which facts the Question Director should ask about.
 */
const COUNTRY_SIGNALS: Record<
  string,
  Array<Omit<PreScreenSignal, "country" | "confidence"> & { confidence?: number }>
> = {
  Haiti: [
    {
      signal_type: "country_program_window",
      cue: "continuous_presence_since",
      date_hint: "2021-07-29",
      authority_refs: ["DHS/USCIS TPS Haiti designation history (check current Federal Register)"],
      elevates_fact: "us_arrival_or_presence_start",
      confidence: 0.75,
    },
  ],
  Ukraine: [
    {
      signal_type: "country_program_window",
      cue: "humanitarian_parole_or_tps_window",
      date_hint: "2022-02-24",
      authority_refs: ["DHS Ukraine humanitarian programs / TPS (verify current dates)"],
      elevates_fact: "us_arrival_or_presence_start",
      confidence: 0.72,
    },
  ],
  Venezuela: [
    {
      signal_type: "country_program_window",
      cue: "tps_or_parole_presence_window",
      date_hint: "2021-03-09",
      authority_refs: ["DHS/USCIS TPS Venezuela (verify current dates)"],
      elevates_fact: "us_arrival_or_presence_start",
      confidence: 0.72,
    },
  ],
  Cuba: [
    {
      signal_type: "country_program_window",
      cue: "presence_and_entry_manner_often_material",
      authority_refs: ["INA / USCIS Cuban Adjustment Act context (verify current law)"],
      elevates_fact: "entry_manner",
      confidence: 0.7,
    },
  ],
  Afghanistan: [
    {
      signal_type: "country_program_window",
      cue: "evacuation_parole_or_siv_context",
      date_hint: "2021-07-30",
      authority_refs: ["DHS/State Afghanistan parole / SIV programs (verify current)"],
      elevates_fact: "us_arrival_or_presence_start",
      confidence: 0.7,
    },
  ],
  Zimbabwe: [
    {
      signal_type: "country_condition_context",
      cue: "humanitarian_country_conditions_may_matter",
      authority_refs: ["DOS country reports / USCIS asylum country conditions (non-conclusive)"],
      elevates_fact: "return_harm_specificity",
      confidence: 0.55,
    },
  ],
};

function normalizeCountry(raw: string): string {
  const t = raw.trim();
  const aliases: Record<string, string> = {
    haitian: "Haiti",
    ukraine: "Ukraine",
    ukrainian: "Ukraine",
    venezuela: "Venezuela",
    venezuelan: "Venezuela",
    cuba: "Cuba",
    cuban: "Cuba",
    afghanistan: "Afghanistan",
    afghani: "Afghanistan",
    afghan: "Afghanistan",
    zimbabwe: "Zimbabwe",
    zimbabwean: "Zimbabwe",
  };
  const lower = t.toLowerCase();
  if (aliases[lower]) return aliases[lower];
  // Title-case common names already stored as "Haiti"
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/**
 * Run light pre-screen from Fact Set origin (and optional free-text fallback).
 * Never invents family/employer; never writes pathway conclusions into Fact Set.
 */
export function runLightCountryPreScreen(
  factSet: SituationFactSet,
  opts?: { mockSignals?: PreScreenSignal[] },
): PreScreenSignal[] {
  if (opts?.mockSignals) return opts.mockSignals;

  const origin = factValue(factSet, "country_of_origin");
  if (typeof origin !== "string" || !origin.trim()) return [];

  const country = normalizeCountry(origin);
  const rows = COUNTRY_SIGNALS[country];
  if (!rows?.length) return [];

  return rows.map((row) => ({
    signal_type: row.signal_type,
    country,
    cue: row.cue,
    date_hint: row.date_hint,
    authority_refs: row.authority_refs,
    elevates_fact: row.elevates_fact,
    confidence: row.confidence ?? 0.6,
  }));
}
