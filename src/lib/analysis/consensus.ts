import { AnalysisStage, StageRole } from "@prisma/client";

export interface ProviderStageOutput<T = unknown> {
  stage: AnalysisStage;
  providerLabel: string;
  model: string;
  role: StageRole;
  payload: T;
  confidence?: number;
}

export interface ConsensusResult<T = unknown> {
  merged: T;
  verificationRequired: boolean;
  confidence: number;
  reasons: string[];
}

/**
 * Deterministic merge strategy:
 * - If only one payload exists, trust it with declared confidence.
 * - If all JSON payloads are equal, merged result is accepted.
 * - If payloads differ, first payload wins and verificationRequired is flagged.
 *
 * This keeps UI deterministic while exposing disagreement explicitly.
 */
export function mergeStageOutputs<T>(outputs: ProviderStageOutput<T>[]): ConsensusResult<T> {
  if (outputs.length === 0) {
    return {
      merged: {} as T,
      verificationRequired: true,
      confidence: 0,
      reasons: ["No provider output available"],
    };
  }

  if (outputs.length === 1) {
    return {
      merged: outputs[0].payload,
      verificationRequired: false,
      confidence: outputs[0].confidence ?? 0.7,
      reasons: ["Single provider execution"],
    };
  }

  const serialized = outputs.map((item) => JSON.stringify(item.payload));
  const allEqual = serialized.every((item) => item === serialized[0]);

  if (allEqual) {
    const avgConfidence =
      outputs.reduce((acc, item) => acc + (item.confidence ?? 0.8), 0) / outputs.length;
    return {
      merged: outputs[0].payload,
      verificationRequired: false,
      confidence: Number(avgConfidence.toFixed(2)),
      reasons: ["Providers agreed on output"],
    };
  }

  return {
    merged: outputs[0].payload,
    verificationRequired: true,
    confidence: 0.5,
    reasons: ["Provider disagreement detected; verification required"],
  };
}
