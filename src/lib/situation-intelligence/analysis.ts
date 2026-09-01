import type { SituationBriefBuckets, SituationFact, SituationFactSet } from "./types";
import {
  factValue,
  hasUscOrLprSpouseBasis,
} from "./reconcile";
import { buildResearchAgenda, enrichResearchWithAuthority, type SituationResearchFinding } from "./research";
import {
  reconcileReasoners,
  runReasonerA,
  runReasonerB,
  type ReasonerPass,
  type SituationPathwayCandidate,
} from "./reasoners";
import { runLightCountryPreScreen } from "./pre-screen";

export type SituationAnalysisResult = {
  schema_version: "si-analysis-0";
  research: SituationResearchFinding[];
  reasoner_a: ReasonerPass;
  reasoner_b: ReasonerPass;
  conflicts: { field: string; note: string }[];
  presentation: {
    headline: string;
    paragraphs: string[];
    pathways: { id: string; condition: string; explanation: string }[];
    not_recommended: string[];
    disclaimer: string;
  };
  brief: SituationBriefBuckets & {
    goal: string;
    government_history_summary: string;
    authority_basis: string[];
    reasoner_agreement: string;
  };
  analyzed_at: string;
};

const DISCLAIMER =
  "This is general information based on official frameworks and your reported facts, not legal advice. A licensed professional should review high-stakes decisions.";

/** Fact firewall: drop spouse/I-130 pathways unless Fact Set supports them. */
export function applyFactFirewall(
  pathways: SituationPathwayCandidate[],
  factSet: SituationFactSet,
): SituationPathwayCandidate[] {
  const allowFamily = hasUscOrLprSpouseBasis(factSet);
  return pathways.filter((p) => {
    if (/i130|spouse|family_petition/i.test(p.id + p.label)) return allowFamily;
    return true;
  });
}

function buildBrief(
  factSet: SituationFactSet,
  issues: string[],
  unknowns: string[],
  research: SituationResearchFinding[],
  agreement: string,
): SituationAnalysisResult["brief"] {
  const reported = factSet.facts.filter((f) => f.state === "reported");
  const verified = factSet.facts.filter((f) => f.state === "verified");
  const goal = String(factValue(factSet, "goal") ?? factSet.facts.find((f) => f.key === "goal")?.value ?? "");
  const gov =
    factValue(factSet, "prior_filing") === "none_reported"
      ? "No USCIS/court filing reported."
      : factValue(factSet, "government_history_detail")
        ? `Government history detail: ${String(factValue(factSet, "government_history_detail"))}`
        : "Government history not fully established.";

  return {
    reported_facts: reported,
    verified_facts: verified,
    ai_findings: issues,
    unresolved: unknowns,
    goal: goal || "Immigration options",
    government_history_summary: gov,
    authority_basis: [...new Set(research.flatMap((r) => r.authority_refs))].slice(0, 12),
    reasoner_agreement: agreement,
  };
}

function buildPresentation(
  factSet: SituationFactSet,
  pathways: SituationPathwayCandidate[],
  issues: string[],
  not_recommended: string[],
  unknowns: string[],
): SituationAnalysisResult["presentation"] {
  const origin = factValue(factSet, "country_of_origin");
  const paragraphs: string[] = [];
  paragraphs.push(
    "Based on the facts you shared (and clarified), here is a careful reading of what may matter next — without inventing relationships or filings you did not describe.",
  );
  if (typeof origin === "string") {
    paragraphs.push(`Your situation involves ${origin} as a country/nationality signal.`);
  }
  if (issues[0]) paragraphs.push(issues[0]);
  if (unknowns.length) {
    paragraphs.push(`Still unresolved for a stronger analysis: ${unknowns.slice(0, 3).join("; ")}.`);
  }

  return {
    headline: "What this may mean",
    paragraphs,
    pathways: pathways.map((p) => ({
      id: p.id,
      condition: p.label,
      explanation: `${p.why}${p.requires_facts.length ? ` Still useful to confirm: ${p.requires_facts.join(", ")}.` : ""}`,
    })),
    not_recommended,
    disclaimer: DISCLAIMER,
  };
}

/**
 * Phase SI-4 Situation analysis — research → A/B → reconcile → firewall → SOL + brief.
 * Does not invoke the V5.1 Case engine.
 */
export async function runSituationAnalysis(
  factSet: SituationFactSet,
  opts?: { enrichAuthority?: boolean },
): Promise<SituationAnalysisResult> {
  const signals = runLightCountryPreScreen(factSet);
  let research = buildResearchAgenda(factSet, signals);
  if (opts?.enrichAuthority !== false) {
    research = await enrichResearchWithAuthority(factSet, research);
  }

  const reasoner_a = runReasonerA(factSet, research);
  const reasoner_b = runReasonerB(factSet, research);
  const reconciled = reconcileReasoners(reasoner_a, reasoner_b);
  const pathways = applyFactFirewall(reconciled.pathways, factSet);

  return {
    schema_version: "si-analysis-0",
    research,
    reasoner_a,
    reasoner_b,
    conflicts: reconciled.conflicts,
    presentation: buildPresentation(
      factSet,
      pathways,
      reconciled.issues,
      reconciled.not_recommended,
      reconciled.unknowns,
    ),
    brief: buildBrief(factSet, reconciled.issues, reconciled.unknowns, research, reconciled.agreement),
    analyzed_at: new Date().toISOString(),
  };
}

export function analysisToAssistantReply(analysis: SituationAnalysisResult): string {
  const parts = [
    analysis.presentation.headline,
    ...analysis.presentation.paragraphs,
    ...(analysis.presentation.pathways.length
      ? [
          "Pathways / tracks that may matter:",
          ...analysis.presentation.pathways.map((p) => `${p.condition}: ${p.explanation}`),
        ]
      : []),
    ...(analysis.presentation.not_recommended.length
      ? ["Not recommended from current facts:", ...analysis.presentation.not_recommended]
      : []),
    analysis.presentation.disclaimer,
  ];
  return parts.join("\n\n");
}

export function analysisToPathwaysJson(analysis: SituationAnalysisResult): string {
  return JSON.stringify(
    analysis.presentation.pathways.map((p) => ({
      id: p.id,
      condition: p.condition,
      explanation: p.explanation,
    })),
  );
}

export function parseSituationAnalysis(intelJson: string | null | undefined): SituationAnalysisResult | null {
  if (!intelJson) return null;
  try {
    const parsed = JSON.parse(intelJson) as { si_analysis?: SituationAnalysisResult };
    if (parsed?.si_analysis?.schema_version === "si-analysis-0") return parsed.si_analysis;
    return null;
  } catch {
    return null;
  }
}

export function mergeAnalysisIntoIntelligenceJson(
  existingIntelJson: string,
  analysis: SituationAnalysisResult,
): string {
  let base: Record<string, unknown> = {};
  try {
    base = JSON.parse(existingIntelJson || "{}") as Record<string, unknown>;
  } catch {
    base = {};
  }
  return JSON.stringify({ ...base, si_analysis: analysis });
}

export type { SituationFact };
