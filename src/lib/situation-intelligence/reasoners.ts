import type { SituationFactSet } from "./types";
import {
  factValue,
  hasHumanitarianReturnConcern,
  hasUscOrLprSpouseBasis,
} from "./reconcile";
import type { SituationResearchFinding } from "./research";

/** Local merge (avoid @/lib/ai/consensus — it is server-only and breaks SI unit checks). */
function listConflicts(a: string[], b: string[], field: string): { field: string; note: string }[] {
  const aSet = new Set(a);
  const bSet = new Set(b);
  const onlyA = a.filter((x) => !bSet.has(x));
  const onlyB = b.filter((x) => !aSet.has(x));
  if (!onlyA.length && !onlyB.length) return [];
  return [
    {
      field,
      note: `Reasoners disagree on ${field}: A-only [${onlyA.join("; ")}] B-only [${onlyB.join("; ")}]`,
    },
  ];
}

export type SituationPathwayCandidate = {
  id: string;
  label: string;
  why: string;
  requires_facts: string[];
};

export type ReasonerPass = {
  id: "reasoner_a" | "reasoner_b";
  focus: string;
  issues: string[];
  candidate_pathways: SituationPathwayCandidate[];
  not_recommended: string[];
  unknowns: string[];
};

function baseUnknowns(factSet: SituationFactSet): string[] {
  const u: string[] = [];
  if (!factValue(factSet, "current_location")) u.push("Current physical location (inside vs outside U.S.)");
  if (factValue(factSet, "current_location") === "inside_us" && !factValue(factSet, "entry_manner")) {
    u.push("How the person most recently entered the United States");
  }
  if (!factValue(factSet, "prior_filing") && !factValue(factSet, "government_history_detail")) {
    u.push("Whether any USCIS / EOIR / ICE / consulate matter already exists");
  }
  if (hasHumanitarianReturnConcern(factSet) && !factValue(factSet, "return_harm_specificity")) {
    u.push("Nature and source of claimed inability/fear regarding return");
  }
  return u;
}

/**
 * Reasoner A — pathway discrimination from research + facts.
 * Does not invent Fact Set rows.
 */
export function runReasonerA(
  factSet: SituationFactSet,
  research: SituationResearchFinding[],
): ReasonerPass {
  const issues: string[] = [];
  const pathways: SituationPathwayCandidate[] = [];
  const not_recommended: string[] = [];
  const unknowns = baseUnknowns(factSet);
  const loc = factValue(factSet, "current_location");

  issues.push("Align options to stated goal without expanding beyond Fact Set bases.");
  if (research.some((r) => r.dimension === "who_origin")) {
    issues.push("Country-of-origin context may affect program windows and protection research.");
  }

  if (hasHumanitarianReturnConcern(factSet)) {
    pathways.push({
      id: "humanitarian_protection_review",
      label: "Humanitarian / protection analysis",
      why: "Fact Set includes inability or concern about return; protection frameworks should be researched — eligibility is not established.",
      requires_facts: ["return_harm_specificity", "current_location", "government_history"],
    });
    issues.push("Filing-timing and one-year asylum considerations may matter if protection is pursued — professional review required.");
  }

  if (hasUscOrLprSpouseBasis(factSet)) {
    pathways.push({
      id: "family_petition_i130",
      label: "Family petition (I-130) track",
      why: "USC/LPR spouse basis is reported in the Fact Set.",
      requires_facts: ["entry_manner", "current_location", "government_history"],
    });
    if (loc === "inside_us") {
      pathways.push({
        id: "adjustment_vs_consular",
        label: "Adjustment vs consular processing",
        why: "Inside U.S. with family basis — entry manner still discriminates finishing path.",
        requires_facts: ["entry_manner"],
      });
    }
  } else {
    not_recommended.push(
      "Do not present a U.S.-citizen spouse / I-130 path — no USC/LPR spouse fact in the Fact Set.",
    );
  }

  if (factSet.activated_dimensions.includes("employment") || factValue(factSet, "employer_sponsor_willing") === true) {
    pathways.push({
      id: "employment_based_review",
      label: "Employment-based options review",
      why: "Employment signals are present; sponsorship details remain unverified.",
      requires_facts: ["employer_sponsor_willing"],
    });
  }

  if (pathways.length === 0) {
    pathways.push({
      id: "open_options_orientation",
      label: "Open options orientation",
      why: "No single strong basis locked — continue orientation and multi-basis discovery.",
      requires_facts: ["possible_bases_answered", "current_location"],
    });
  }

  if (loc === "outside_us") {
    issues.push("Outside-U.S. posture — prioritize consular/overseas research frames.");
  }

  return {
    id: "reasoner_a",
    focus: "pathway_discrimination",
    issues,
    candidate_pathways: pathways,
    not_recommended,
    unknowns,
  };
}

/**
 * Reasoner B — independent risk / missing-fact audit (different emphasis).
 */
export function runReasonerB(
  factSet: SituationFactSet,
  research: SituationResearchFinding[],
): ReasonerPass {
  const issues: string[] = [];
  const pathways: SituationPathwayCandidate[] = [];
  const not_recommended: string[] = [];
  const unknowns = baseUnknowns(factSet);

  issues.push("Independent review: separate reported facts from analytical possibilities.");
  if (research.some((r) => r.dimension === "country_program" || /presence|tps|parole|program/i.test(r.topic + r.summary))) {
    issues.push("Country-program presence windows may make exact arrival/presence dates material.");
    if (!factValue(factSet, "us_arrival_or_presence_start")) {
      unknowns.push("Exact U.S. arrival or continuous-presence start date");
    }
  }

  // B is more conservative on pathways
  if (hasHumanitarianReturnConcern(factSet)) {
    pathways.push({
      id: "humanitarian_protection_review",
      label: "Humanitarian / protection analysis",
      why: "Return concern is reported; B flags that fear-of-persecution is not automatically established.",
      requires_facts: ["return_harm_specificity"],
    });
    if (!factValue(factSet, "return_harm_specificity")) {
      issues.push("Cannot-return language ≠ established persecution claim until specificity is known.");
    }
  }

  if (hasUscOrLprSpouseBasis(factSet)) {
    pathways.push({
      id: "family_petition_i130",
      label: "Family petition (I-130) track",
      why: "Spouse USC/LPR fact present — B agrees family track is in scope for research.",
      requires_facts: ["entry_manner"],
    });
  } else {
    not_recommended.push("Reject spouse/I-130 recommendations without family basis facts.");
  }

  if (factValue(factSet, "court_or_removal_signal") === true) {
    pathways.push({
      id: "removal_defense_priority",
      label: "Court / removal priority review",
      why: "Removal/court signal outranks casual open-options framing until clarified.",
      requires_facts: ["government_history_detail"],
    });
    issues.push("If EOIR has jurisdiction, affirmative USCIS strategy may be constrained.");
  }

  if (pathways.length === 0) {
    pathways.push({
      id: "open_options_orientation",
      label: "Open options orientation",
      why: "B: insufficient basis lock — avoid overconfident pathway lists.",
      requires_facts: ["current_location", "possible_bases_answered"],
    });
  }

  return {
    id: "reasoner_b",
    focus: "risk_and_missing_facts",
    issues,
    candidate_pathways: pathways,
    not_recommended,
    unknowns,
  };
}

export function reconcileReasoners(
  a: ReasonerPass,
  b: ReasonerPass,
): {
  pathways: SituationPathwayCandidate[];
  issues: string[];
  not_recommended: string[];
  unknowns: string[];
  conflicts: { field: string; note: string }[];
  agreement: string;
} {
  const byId = new Map<string, SituationPathwayCandidate>();
  for (const p of [...a.candidate_pathways, ...b.candidate_pathways]) {
    if (!byId.has(p.id)) byId.set(p.id, p);
  }

  const aIds = new Set(a.candidate_pathways.map((p) => p.id));
  const bIds = new Set(b.candidate_pathways.map((p) => p.id));
  const shared = [...aIds].filter((id) => bIds.has(id));
  const pathways = shared.length
    ? shared.map((id) => byId.get(id)!).filter(Boolean)
    : [...byId.values()];

  const unknowns = [...new Set([...a.unknowns, ...b.unknowns])];
  const issues = [...new Set([...a.issues, ...b.issues])];
  const not_recommended = [...new Set([...a.not_recommended, ...b.not_recommended])];
  const conflicts = [
    ...listConflicts(
      a.candidate_pathways.map((p) => p.id),
      b.candidate_pathways.map((p) => p.id),
      "pathway_ids",
    ),
    ...listConflicts(a.not_recommended, b.not_recommended, "not_recommended"),
  ];

  const agreement =
    shared.length >= Math.min(aIds.size, bIds.size) && shared.length > 0
      ? `Reasoners agree on ${shared.length} pathway track(s): ${shared.join(", ")}.`
      : conflicts.length
        ? "Reasoners partially disagree — conflicts flagged for professional review."
        : "Reasoners produced complementary emphasis; shared tracks listed where available.";

  return {
    pathways,
    issues,
    not_recommended,
    unknowns,
    conflicts,
    agreement,
  };
}
