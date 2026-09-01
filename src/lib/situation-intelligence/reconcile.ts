import { auditDecomposeResult } from "./audit";
import { decomposeNarrative } from "./decompose";
import type {
  ActivatedDimension,
  FoundationalDimension,
  SituationFact,
  SituationFactSet,
} from "./types";
import { FOUNDATIONAL_DIMENSIONS } from "./types";

function isoNow() {
  return new Date().toISOString();
}

/**
 * Deterministic reconciliation of AI1 + AI2 into a Situation Fact Set.
 */
export function reconcileSituationFacts(message: string, goal = ""): SituationFactSet {
  const d1 = decomposeNarrative(message, goal);
  const audit = auditDecomposeResult(d1, message);
  const byKey = new Map(d1.claims.map((c) => [c.key, c]));

  for (const finding of audit) {
    const existing = byKey.get(finding.key);
    if (finding.action === "drop") {
      byKey.delete(finding.key);
      continue;
    }
    if (finding.action === "downgrade" && existing) {
      byKey.set(finding.key, {
        ...existing,
        value: finding.revised_value !== undefined ? finding.revised_value : existing.value,
        claim_strength: finding.revised_strength ?? "ambiguous",
        confidence: Math.min(existing.confidence, 0.5),
      });
      continue;
    }
    if (finding.action === "add_unknown") {
      // Do not add a fact row for unknown fear — leave unresolved
      byKey.delete(finding.key);
    }
  }

  // Drop ambiguous/null fear rows entirely
  const fear = byKey.get("fear_of_persecution");
  if (fear && (fear.value == null || fear.claim_strength === "ambiguous")) {
    byKey.delete("fear_of_persecution");
  }

  // Soft spouse_mentioned stays as reported soft signal; USC spouse stays reported
  const facts: SituationFact[] = [];
  for (const claim of byKey.values()) {
    if (claim.claim_strength === "ambiguous" && claim.value == null) continue;
    facts.push({
      key: claim.key,
      value: claim.value,
      state: "reported",
      dimension: claim.dimension,
      provenance: "reconciler",
      source_text: claim.source_text,
      updated_at: isoNow(),
    });
  }

  const activated = new Set<ActivatedDimension>(d1.activated_dimensions);
  // If family was dropped, remove family activation
  if (!facts.some((f) => f.key === "family_basis" || f.key === "usc_child")) {
    activated.delete("family");
  }
  if (facts.some((f) => f.key === "inability_or_concern_about_return")) {
    activated.add("humanitarian");
  }

  const resolvedDims = new Set<string>();
  for (const f of facts) {
    if (f.dimension === "who_origin") resolvedDims.add("who_origin");
    if (f.dimension === "where") resolvedDims.add("where");
    if (f.dimension === "immigration_position") resolvedDims.add("immigration_position");
    if (f.dimension === "government_history") resolvedDims.add("government_history");
    if (f.dimension === "goal") resolvedDims.add("goal");
    if (f.key === "family_basis" || f.key === "inability_or_concern_about_return" || f.key === "employment_signal") {
      resolvedDims.add("possible_basis");
    }
  }

  const unresolved_foundational = FOUNDATIONAL_DIMENSIONS.filter(
    (d) => !resolvedDims.has(d),
  ) as FoundationalDimension[];

  return {
    schema_version: "si-1",
    facts,
    activated_dimensions: [...activated],
    unresolved_foundational,
  };
}

export function serializeFactSet(set: SituationFactSet): string {
  return JSON.stringify(set);
}

export function parseFactSet(raw: string | null | undefined): SituationFactSet | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as SituationFactSet;
    if (
      (parsed?.schema_version !== "si-0" && parsed?.schema_version !== "si-1") ||
      !Array.isArray(parsed.facts)
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function factValue(set: SituationFactSet, key: string): string | boolean | number | null | undefined {
  return set.facts.find((f) => f.key === key)?.value;
}

/** True when Fact Set has a reported/verified family immigration basis (spouse USC/LPR). */
export function hasUscOrLprSpouseBasis(set: SituationFactSet): boolean {
  return set.facts.some(
    (f) =>
      f.key === "family_basis" &&
      f.value === "usc_or_lpr_spouse" &&
      (f.state === "reported" || f.state === "verified"),
  );
}

export function hasAnyFamilyBasis(set: SituationFactSet): boolean {
  return set.facts.some(
    (f) =>
      (f.key === "family_basis" || f.key === "usc_child") &&
      (f.state === "reported" || f.state === "verified"),
  );
}

export function hasHumanitarianReturnConcern(set: SituationFactSet): boolean {
  return set.facts.some(
    (f) => f.key === "inability_or_concern_about_return" && f.value === true,
  );
}

/** Narrative-level guard used by branch templates before Fact Set is threaded everywhere. */
export function narrativeHasUscSpouse(message: string): boolean {
  return (
    /\b(wife|husband|spouse)\b/i.test(message) &&
    /\b(u\.?s\.?\s*citizen|usc|green.?card|permanent resident|lpr)\b/i.test(message)
  );
}
