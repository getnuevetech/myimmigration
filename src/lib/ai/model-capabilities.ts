/**
 * Model Responsibility Contract — capability aliases.
 * Responsibilities stay fixed; underlying provider names are configurable.
 */
import { db } from "@/lib/db";
import { getSetting } from "@/lib/settings";

export const MODEL_CAPABILITIES = {
  PRIMARY_REASONING: "primary_reasoning",
  DOCUMENT_INTELLIGENCE: "document_intelligence",
  PRESENTATION: "presentation",
} as const;

export type ModelCapability = (typeof MODEL_CAPABILITIES)[keyof typeof MODEL_CAPABILITIES];

export const CAPABILITY_SETTING_KEYS: Record<ModelCapability, string> = {
  primary_reasoning: "ai.capability.primary_reasoning",
  document_intelligence: "ai.capability.document_intelligence",
  presentation: "ai.capability.presentation",
};

/** Default provider display names (seed). Override via settings without rewriting architecture. */
export const DEFAULT_CAPABILITY_PROVIDERS: Record<ModelCapability, string> = {
  primary_reasoning: "OpenAI GPT-5.6 Sol",
  document_intelligence: "Anthropic Claude Opus 5",
  presentation: "OpenAI GPT-5.6 Sol",
};

/** Stages owned by each capability under the Model Responsibility Contract. */
export const STAGE_CAPABILITY: Record<string, ModelCapability> = {
  summary: "primary_reasoning",
  goal: "primary_reasoning",
  situation: "primary_reasoning",
  qa: "primary_reasoning",
  guide: "primary_reasoning",
  letter: "primary_reasoning",
  match: "primary_reasoning",
  match_reason: "primary_reasoning",
  closing: "presentation",
  presenter: "presentation",
  document: "document_intelligence",
  // Notice: Opus extracts; Sol explains (sequential steps in seed).
  notice: "document_intelligence",
};

export const DOCUMENT_INTELLIGENCE_ROLES = new Set(["document_intelligence", "extractor_a", "extractor_b"]);
export const PRESENTATION_ROLES = new Set(["presenter"]);
export const REASONING_ROLES = new Set([
  "fact_extractor",
  "interpreter",
  "skeptic",
  "analyst",
  "reviewer",
  "assistant",
]);

export async function resolveCapabilityProviderName(capability: ModelCapability): Promise<string> {
  const fromSettings = await getSetting(CAPABILITY_SETTING_KEYS[capability], "");
  return (fromSettings || DEFAULT_CAPABILITY_PROVIDERS[capability]).trim();
}

export async function resolveCapabilityProvider(capability: ModelCapability) {
  const name = await resolveCapabilityProviderName(capability);
  const byName = await db.aiProvider.findFirst({
    where: { name, isEnabled: true },
  });
  if (byName) return byName;
  // Soft fallback: name contains Sol / Opus cues
  if (capability === "document_intelligence") {
    return db.aiProvider.findFirst({
      where: { isEnabled: true, OR: [{ name: { contains: "Opus" } }, { kind: "anthropic" }] },
      orderBy: { createdAt: "asc" },
    });
  }
  return db.aiProvider.findFirst({
    where: { isEnabled: true, name: { contains: "Sol" } },
    orderBy: { createdAt: "asc" },
  });
}

export function capabilityForStage(stageKey: string): ModelCapability {
  return STAGE_CAPABILITY[stageKey] ?? "primary_reasoning";
}

/** Prefer the capability-bound provider; keep others only as explicit fallbacks. */
export function preferCapabilitySteps<T extends { provider: { id: string; name: string }; providerId: string }>(
  steps: T[],
  preferredProviderId: string | null | undefined,
): T[] {
  if (!preferredProviderId || steps.length === 0) return steps;
  const preferred = steps.filter((s) => s.providerId === preferredProviderId);
  if (preferred.length) return preferred;
  return steps;
}
