import type { SituationFactSet } from "./types";
import { factValue, parseFactSet, reconcileSituationFacts } from "./reconcile";
import {
  emptyInterviewState,
  runQuestionDirector,
  type DirectorResult,
  type InterviewState,
} from "./question-director";

const LABELS: Record<string, string> = {
  country_of_origin: "Country",
  current_location: "Location",
  goal: "Goal",
  inability_or_concern_about_return: "Return concern",
  family_basis: "Family basis",
  usc_child: "U.S.-citizen child",
  prior_filing: "Prior filings",
  entry_manner: "Entry",
  presence_years_approx: "Time in the U.S.",
  country_condition_claim: "Country conditions mentioned",
};

export function echoFactsFromSet(set: SituationFactSet): { key: string; label: string; value: string }[] {
  const keys = [
    "country_of_origin",
    "current_location",
    "goal",
    "inability_or_concern_about_return",
    "family_basis",
    "usc_child",
    "prior_filing",
    "entry_manner",
    "presence_years_approx",
    "country_condition_claim",
  ];
  const out: { key: string; label: string; value: string }[] = [];
  for (const key of keys) {
    const v = factValue(set, key);
    if (v == null || v === "") continue;
    let display = String(v);
    if (key === "current_location") {
      display = v === "inside_us" ? "Inside the United States" : v === "outside_us" ? "Outside the United States" : display;
    }
    if (key === "inability_or_concern_about_return" && v === true) display = "Cannot or concerned about returning";
    if (key === "family_basis" && v === "usc_or_lpr_spouse") display = "U.S. citizen or permanent-resident spouse";
    if (key === "usc_child" && v === true) display = "Yes";
    if (key === "prior_filing" && v === "none_reported") display = "None reported";
    if (key === "goal" && v === "live_and_work_in_us") display = "Live and work in the U.S.";
    out.push({ key, label: LABELS[key] ?? key, value: display });
  }
  return out;
}

export function factSetForSituationRow(row: {
  knownFactsJson: string;
  originalNarrative: string;
  goal: string;
}): SituationFactSet {
  return parseFactSet(row.knownFactsJson) ?? reconcileSituationFacts(row.originalNarrative, row.goal);
}

function interviewFromFactSet(set: SituationFactSet): InterviewState {
  if (set.interview) {
    return {
      asked_count: set.interview.asked_count,
      asked_candidates: set.interview.asked_candidates ?? [],
      stopped: Boolean(set.interview.stopped),
      stop_reason: set.interview.stop_reason as InterviewState["stop_reason"],
    };
  }
  return emptyInterviewState();
}

/** Resolve current Question Director state for a Situation row (UI). */
export function peekSituationInterview(row: {
  knownFactsJson: string;
  originalNarrative: string;
  goal: string;
}): DirectorResult {
  const factSet = factSetForSituationRow(row);
  return runQuestionDirector(factSet, interviewFromFactSet(factSet));
}
