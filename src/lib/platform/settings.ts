import { AnalysisStage, StageRole } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { DEFAULT_PUBLIC_DISCLAIMER } from "@/lib/platform/constants";

export type StageModelSelection = {
  providerLabel: string;
  model: string;
  role: StageRole;
};

export type AnalysisPipelineConfig = Record<AnalysisStage, StageModelSelection[]>;

const DEFAULT_PIPELINE: AnalysisPipelineConfig = {
  SUMMARY: [
    { providerLabel: "OpenAI", model: "gpt-5.6-sol", role: "FACT_EXTRACTOR" },
    { providerLabel: "Anthropic", model: "claude-sonnet-5", role: "INTERPRETER" },
    { providerLabel: "Google", model: "gemini-3.1-pro-preview", role: "VERIFIER" },
  ],
  GOAL: [
    { providerLabel: "OpenAI", model: "gpt-5.6-sol", role: "FACT_EXTRACTOR" },
    { providerLabel: "Anthropic", model: "claude-sonnet-5", role: "INTERPRETER" },
  ],
  DOCUMENT: [
    { providerLabel: "Anthropic", model: "claude-sonnet-5", role: "FACT_EXTRACTOR" },
    { providerLabel: "Google", model: "gemini-3.1-pro-preview", role: "INTERPRETER" },
    { providerLabel: "OpenAI", model: "gpt-5.6-sol", role: "VERIFIER" },
  ],
  SITUATION: [
    { providerLabel: "OpenAI", model: "gpt-5.6-sol", role: "INTERPRETER" },
    { providerLabel: "Anthropic", model: "claude-opus-5", role: "SKEPTIC" },
    { providerLabel: "Google", model: "gemini-3.1-pro-preview", role: "VERIFIER" },
  ],
  PRESENTATION: [{ providerLabel: "OpenAI", model: "gpt-5.6-terra", role: "PRESENTER" }],
};

const SETTINGS_KEYS = {
  disclaimer: "policy.disclaimer.public",
  analysisThreshold: "analysis.verification.threshold",
  freePreviewLimit: "access.free_preview_limit",
} as const;

export type PlatformRuntimeSettings = {
  disclaimer: string;
  analysisThreshold: number;
  freePreviewLimit: number;
  pipeline: AnalysisPipelineConfig;
};

function parsePositiveNumber(value: string | null | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export async function getPlatformRuntimeSettings(): Promise<PlatformRuntimeSettings> {
  try {
    const [settings, stages] = await Promise.all([
      prisma.setting.findMany({
        where: { key: { in: Object.values(SETTINGS_KEYS) } },
      }),
      prisma.pipelineStage.findMany({
        where: { enabled: true },
        include: {
          steps: {
            where: { enabled: true },
            include: { provider: true },
            orderBy: { orderIndex: "asc" },
          },
        },
      }),
    ]);

    const settingMap = new Map(settings.map((item) => [item.key, item.value]));

    const pipelineFromDb: Partial<AnalysisPipelineConfig> = {};
    for (const stage of stages) {
      pipelineFromDb[stage.key] = stage.steps.map((step) => ({
        providerLabel: step.provider.label,
        model: step.provider.model,
        role: step.stageRole,
      }));
    }

    return {
      disclaimer: settingMap.get(SETTINGS_KEYS.disclaimer) ?? DEFAULT_PUBLIC_DISCLAIMER,
      analysisThreshold: parsePositiveNumber(settingMap.get(SETTINGS_KEYS.analysisThreshold), 0.75),
      freePreviewLimit: parsePositiveNumber(settingMap.get(SETTINGS_KEYS.freePreviewLimit), 1),
      pipeline: {
        ...DEFAULT_PIPELINE,
        ...pipelineFromDb,
      },
    };
  } catch {
    return {
      disclaimer: DEFAULT_PUBLIC_DISCLAIMER,
      analysisThreshold: 0.75,
      freePreviewLimit: 1,
      pipeline: DEFAULT_PIPELINE,
    };
  }
}

export function getDefaultDisclaimer(): string {
  return DEFAULT_PUBLIC_DISCLAIMER;
}
