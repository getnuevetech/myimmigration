/**
 * Phase SI-6 — Situation Intelligence telemetry helpers (institutional keys only).
 * Events are countable for ops dashboards; no PII.
 */

import { SI_TELEMETRY, type SituationFactSet } from "./types";
import type { SituationLearningHints } from "./learning";
import { hasUscOrLprSpouseBasis } from "./reconcile";

export type SiTelemetryEvent = {
  name: string;
  at: string;
  props: Record<string, string | number | boolean>;
};

type DirectorTelemetryInput = {
  interview: { asked_count: number; stop_reason?: string };
  next: { candidate: string } | null;
  ready_for_analysis: boolean;
  learning_hints: SituationLearningHints;
};

/** In-memory sink for unit checks; production can replace via setSiTelemetrySink. */
let sink: (event: SiTelemetryEvent) => void = () => {};
const buffer: SiTelemetryEvent[] = [];

export function setSiTelemetrySink(fn: (event: SiTelemetryEvent) => void) {
  sink = fn;
}

export function resetSiTelemetryBuffer() {
  buffer.length = 0;
  sink = (event) => {
    buffer.push(event);
  };
}

export function getSiTelemetryBuffer(): SiTelemetryEvent[] {
  return [...buffer];
}

export function emitSiTelemetry(name: string, props: Record<string, string | number | boolean> = {}) {
  const event: SiTelemetryEvent = { name, at: new Date().toISOString(), props };
  sink(event);
}

/**
 * After a director pass: record ask count / skip / learning, and assert premature
 * customer-facing analysis is not unlocked when orientation is still needed.
 */
export function recordDirectorTelemetry(factSet: SituationFactSet, result: DirectorTelemetryInput): void {
  emitSiTelemetry(SI_TELEMETRY.interviewAskCount, {
    ask_count: result.interview.asked_count,
    ready_for_analysis: result.ready_for_analysis,
    has_next: Boolean(result.next),
  });

  if (result.learning_hints.suppress_keys.length) {
    emitSiTelemetry(SI_TELEMETRY.learningSuppress, {
      count: result.learning_hints.suppress_keys.length,
      keys: result.learning_hints.suppress_keys.slice(0, 8).join(","),
    });
  }
  if (result.learning_hints.prefer_keys.length) {
    emitSiTelemetry(SI_TELEMETRY.learningBoost, {
      count: result.learning_hints.prefer_keys.length,
      keys: result.learning_hints.prefer_keys.slice(0, 8).join(","),
    });
  }

  const locationKnown = factSet.facts.some(
    (f) => f.key === "current_location" && f.state !== "unknown" && f.value != null && f.value !== "",
  );
  const underspecified = !locationKnown && result.interview.asked_count === 0;

  if (underspecified && result.next) {
    emitSiTelemetry(SI_TELEMETRY.fullPersonalizedAnalysisBeforeFactOrientation, {
      value: 0,
      reason: "director_still_asking",
    });
  } else if (underspecified && result.ready_for_analysis && !result.next) {
    emitSiTelemetry(SI_TELEMETRY.fullPersonalizedAnalysisBeforeFactOrientation, {
      value: 1,
      reason: "ready_without_orientation",
    });
  }

  if (result.ready_for_analysis) {
    emitSiTelemetry(SI_TELEMETRY.interviewQualityCaptured, {
      ask_count: result.interview.asked_count,
      stop_reason: result.interview.stop_reason ?? "threshold",
      spouse_basis: hasUscOrLprSpouseBasis(factSet),
    });
  }
}
