import type { ActivatedDimension, PreScreenSignal, SituationFactSet } from "./types";
import { factValue, hasHumanitarianReturnConcern, hasUscOrLprSpouseBasis } from "./reconcile";
import { runLightCountryPreScreen } from "./pre-screen";

export type SituationResearchFinding = {
  dimension: string;
  topic: string;
  summary: string;
  authority_refs: string[];
  /** Explicit: research cues are not eligibility conclusions. */
  not_a_conclusion: true;
};

/**
 * Full research fan-out keyed by activated dimensions + Fact Set.
 * Deterministic agenda first; optional live authority retrieval when DB/providers exist.
 */
export function buildResearchAgenda(
  factSet: SituationFactSet,
  signals?: PreScreenSignal[],
): SituationResearchFinding[] {
  const findings: SituationResearchFinding[] = [];
  const origin = factValue(factSet, "country_of_origin");
  const loc = factValue(factSet, "current_location");
  const goal = factValue(factSet, "goal");
  const dims = new Set<ActivatedDimension>(factSet.activated_dimensions);
  const pre = signals ?? runLightCountryPreScreen(factSet);

  findings.push({
    dimension: "goal",
    topic: "customer_goal",
    summary: `Stated goal framing: ${String(goal ?? "immigration options")}. Research should stay aligned to this goal without inventing bases.`,
    authority_refs: ["Product goal from Situation Fact Set"],
    not_a_conclusion: true,
  });

  if (typeof origin === "string" && origin) {
    findings.push({
      dimension: "who_origin",
      topic: "country_of_origin",
      summary: `Country/nationality signal: ${origin}. Country-condition and program windows may matter for research, not automatic eligibility.`,
      authority_refs: ["DOS country information / USCIS country-specific pages (verify current)"],
      not_a_conclusion: true,
    });
  }

  if (loc === "inside_us") {
    findings.push({
      dimension: "where",
      topic: "physical_presence_inside_us",
      summary: "Customer reports being inside the United States — inside-U.S. processes may be in scope; entry/status facts still control realism.",
      authority_refs: ["INA framework for adjustment vs consular (context only)"],
      not_a_conclusion: true,
    });
  } else if (loc === "outside_us") {
    findings.push({
      dimension: "where",
      topic: "physical_presence_outside_us",
      summary: "Customer reports being outside the United States — consular / overseas processes are the primary research frame.",
      authority_refs: ["DOS consular processing overview (verify current)"],
      not_a_conclusion: true,
    });
  } else {
    findings.push({
      dimension: "where",
      topic: "location_unresolved",
      summary: "Physical location still unresolved — pathway research must stay branched or cautious.",
      authority_refs: [],
      not_a_conclusion: true,
    });
  }

  if (hasHumanitarianReturnConcern(factSet) || dims.has("humanitarian")) {
    const specificity = factValue(factSet, "return_harm_specificity");
    findings.push({
      dimension: "humanitarian",
      topic: "protection_research",
      summary: specificity
        ? `Return concern with specificity note: ${String(specificity)}. Research protection frameworks (asylum/withholding/CAT/TPS/parole as applicable) without concluding eligibility.`
        : "Return concern reported without persecution specifics — research protection frameworks as possibilities requiring professional judgment.",
      authority_refs: [
        "USCIS Asylum",
        "EOIR protection relief overview",
        "DOS country reports (conditions ≠ personal eligibility)",
      ],
      not_a_conclusion: true,
    });
  }

  if (hasUscOrLprSpouseBasis(factSet) || dims.has("family")) {
    findings.push({
      dimension: "family",
      topic: "family_petition_research",
      summary: hasUscOrLprSpouseBasis(factSet)
        ? "USC/LPR spouse basis is in the Fact Set — family petition research (I-130 and related) is in scope."
        : "Family dimension activated without confirmed USC/LPR spouse status — research only as conditional.",
      authority_refs: ["USCIS I-130", "USCIS family-based green card overview"],
      not_a_conclusion: true,
    });
  }

  if (dims.has("employment") || factValue(factSet, "employer_sponsor_willing") === true) {
    findings.push({
      dimension: "employment",
      topic: "employment_based_research",
      summary: "Employment/sponsorship signals present — research employment-based and work-authorization frames without inventing a job offer.",
      authority_refs: ["USCIS working in the United States", "USCIS permanent workers overview"],
      not_a_conclusion: true,
    });
  }

  if (dims.has("education")) {
    findings.push({
      dimension: "education",
      topic: "student_status_research",
      summary: "Education signals present — research student/status maintenance frames if relevant to goal.",
      authority_refs: ["USCIS students and exchange visitors"],
      not_a_conclusion: true,
    });
  }

  if (dims.has("court_removal") || factValue(factSet, "court_or_removal_signal") === true) {
    findings.push({
      dimension: "court_removal",
      topic: "removal_defense_research",
      summary: "Court/removal signals present — EOIR jurisdiction and defense options require careful professional review.",
      authority_refs: ["EOIR", "USCIS/ICE notices context"],
      not_a_conclusion: true,
    });
  }

  for (const s of pre) {
    findings.push({
      dimension: "country_program",
      topic: s.signal_type,
      summary: `Pre-screen cue for ${s.country ?? "country"}: ${s.cue}${s.date_hint ? ` (date hint ${s.date_hint})` : ""}. Elevates fact ${s.elevates_fact} for analysis — not an approval.`,
      authority_refs: s.authority_refs,
      not_a_conclusion: true,
    });
  }

  const gov = factValue(factSet, "prior_filing");
  if (gov === "none_reported") {
    findings.push({
      dimension: "government_history",
      topic: "no_prior_filing_reported",
      summary: "No prior USCIS/court filing reported — first-filing and affirmative options may be relevant depending on basis.",
      authority_refs: [],
      not_a_conclusion: true,
    });
  } else if (gov === "something_reported") {
    findings.push({
      dimension: "government_history",
      topic: "prior_government_contact",
      summary: "Some government immigration contact reported — identify agency/paper type before strategy.",
      authority_refs: ["USCIS / EOIR / CBP document identification"],
      not_a_conclusion: true,
    });
  }

  // Novel / sparse situations still get a generic open-options research frame
  if (findings.length < 3) {
    findings.push({
      dimension: "general",
      topic: "open_options_scan",
      summary: "Sparse Fact Set — keep research open across location, history, and possible bases without template forcing.",
      authority_refs: ["USCIS Explore my options (informational)"],
      not_a_conclusion: true,
    });
  }

  return findings;
}

/** Optional live authority pull — best-effort; never required for analysis. */
export async function enrichResearchWithAuthority(
  factSet: SituationFactSet,
  findings: SituationResearchFinding[],
): Promise<SituationResearchFinding[]> {
  try {
    const { retrieveUnifiedAuthority } = await import("@/lib/authority-retrieval");
    const origin = factValue(factSet, "country_of_origin");
    const query = [
      typeof origin === "string" ? origin : "",
      hasHumanitarianReturnConcern(factSet) ? "asylum protection country conditions" : "",
      hasUscOrLprSpouseBasis(factSet) ? "family based petition I-130" : "",
      "immigration options",
    ]
      .filter(Boolean)
      .join(" ");
    const records = await retrieveUnifiedAuthority({
      query,
      inquiryMode: "open_options",
      limit: 5,
      persistHits: false,
    });
    if (!Array.isArray(records) || records.length === 0) return findings;
    const extra: SituationResearchFinding[] = records.slice(0, 5).map((r, i) => ({
      dimension: "authority_hit",
      topic: `authority_${i + 1}`,
      summary: String(r.content || r.title || "Authority source retrieved").slice(0, 400),
      authority_refs: [String(r.url || r.reference || r.title || "authority")],
      not_a_conclusion: true as const,
    }));
    return [...findings, ...extra];
  } catch {
    return findings;
  }
}
