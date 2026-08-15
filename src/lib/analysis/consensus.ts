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
  disagreementPayloads?: T[];
}

/**
 * Merge strategy (Taxonme-style multi-model consensus):
 * - Single output: accepted with moderate confidence.
 * - All outputs agree: accepted with high confidence.
 * - Outputs disagree: all disagreeing payloads are surfaced via `disagreementPayloads`
 *   so that a downstream SYNTHESIZER model call can produce a unified result.
 *   The first payload is kept as the provisional result while `verificationRequired`
 *   signals that synthesis should run.
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
      reasons: ["All providers agreed on output"],
    };
  }

  return {
    merged: outputs[0].payload,
    verificationRequired: true,
    confidence: 0.5,
    reasons: [
      `Provider disagreement detected across ${outputs.length} models (${outputs.map((o) => o.providerLabel).join(", ")}); synthesis required`,
    ],
    disagreementPayloads: outputs.map((o) => o.payload),
  };
}

