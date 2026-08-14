import { prisma } from "@/lib/db/prisma";
import { getPlatformRuntimeSettings } from "@/lib/platform/settings";
import { CaseAccessState, PublicPlan } from "@/types/case";

const FEATURE_KEYS = {
  fullResults: "analysis.full_results",
  exportCasePackage: "analysis.export_case_package",
  consultantMatching: "consultant.matching",
  advancedForms: "forms.advanced_wizards",
} as const;

const DEFAULT_PLANS: PublicPlan[] = [
  {
    key: "free",
    name: "Free Preview",
    description: "Create an account to keep your case, unlock deeper analysis, and continue later.",
    monthlyUsd: 0,
    features: [
      "Saved case history",
      "Full structured results",
      "Guest-to-account case transfer",
    ],
  },
  {
    key: "guided",
    name: "Guided Review",
    description: "For users who want exports and more guided next-step tooling.",
    monthlyUsd: 29,
    yearlyUsd: 290,
    features: [
      "Everything in Free Preview",
      "Case package export",
      "Expanded next-step tooling",
    ],
    recommended: true,
  },
  {
    key: "attorney-prep",
    name: "Attorney Prep",
    description: "Adds advanced forms and consultant matching foundations.",
    monthlyUsd: 79,
    yearlyUsd: 790,
    features: [
      "Everything in Guided Review",
      "Advanced USCIS form wizards",
      "Consultant recommendation flow",
    ],
  },
];

type SubscriptionFeatureMap = Record<string, boolean>;

function deriveFeatureMap(planKey: string): SubscriptionFeatureMap {
  switch (planKey) {
    case "free":
      return {
        [FEATURE_KEYS.fullResults]: true,
        [FEATURE_KEYS.exportCasePackage]: false,
        [FEATURE_KEYS.consultantMatching]: false,
        [FEATURE_KEYS.advancedForms]: false,
      };
    case "guided":
      return {
        [FEATURE_KEYS.fullResults]: true,
        [FEATURE_KEYS.exportCasePackage]: true,
        [FEATURE_KEYS.consultantMatching]: false,
        [FEATURE_KEYS.advancedForms]: false,
      };
    default:
      return {
        [FEATURE_KEYS.fullResults]: true,
        [FEATURE_KEYS.exportCasePackage]: true,
        [FEATURE_KEYS.consultantMatching]: true,
        [FEATURE_KEYS.advancedForms]: true,
      };
  }
}

async function ensureDefaultPlanCatalog() {
  for (const featureKey of Object.values(FEATURE_KEYS)) {
    await prisma.featureDef.upsert({
      where: { key: featureKey },
      update: {},
      create: {
        key: featureKey,
        label: featureKey,
      },
    });
  }

  for (const [rank, plan] of DEFAULT_PLANS.entries()) {
    const savedPlan = await prisma.subscriptionPlan.upsert({
      where: { key: plan.key },
      update: {
        name: plan.name,
        description: plan.description,
        monthlyUsd: plan.monthlyUsd,
        yearlyUsd: plan.yearlyUsd ?? null,
        isActive: true,
        rank,
      },
      create: {
        key: plan.key,
        name: plan.name,
        description: plan.description,
        monthlyUsd: plan.monthlyUsd,
        yearlyUsd: plan.yearlyUsd ?? null,
        isActive: true,
        rank,
      },
    });

    const featureMap = deriveFeatureMap(plan.key);
    for (const [featureKey, enabled] of Object.entries(featureMap)) {
      await prisma.planFeature.upsert({
        where: {
          planId_featureKey: {
            planId: savedPlan.id,
            featureKey,
          },
        },
        update: { enabled },
        create: {
          planId: savedPlan.id,
          featureKey,
          enabled,
        },
      });
    }
  }
}

export async function getPublicPlans(): Promise<PublicPlan[]> {
  if (!process.env.DATABASE_URL) {
    return DEFAULT_PLANS;
  }

  try {
    const plans = await prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      include: {
        features: {
          where: { enabled: true },
          include: { feature: true },
        },
      },
      orderBy: [{ rank: "asc" }, { monthlyUsd: "asc" }],
    });

    if (plans.length === 0) {
      return DEFAULT_PLANS;
    }

    return plans.map((plan) => ({
      key: plan.key,
      name: plan.name,
      description: plan.description ?? "",
      monthlyUsd: plan.monthlyUsd,
      yearlyUsd: plan.yearlyUsd,
      features: plan.features.map((feature) => feature.feature.label),
      recommended: plan.rank === 1,
    }));
  } catch {
    return DEFAULT_PLANS;
  }
}

export async function ensureFreeSubscriptionForUser(userId: string) {
  let freePlan = await prisma.subscriptionPlan.findUnique({
    where: { key: "free" },
  });

  if (!freePlan) {
    await ensureDefaultPlanCatalog();
    freePlan = await prisma.subscriptionPlan.findUnique({
      where: { key: "free" },
    });
  }

  if (!freePlan) {
    return null;
  }

  const existing = await prisma.subscription.findFirst({
    where: {
      userId,
      status: { in: ["TRIAL", "ACTIVE"] },
    },
    orderBy: { createdAt: "desc" },
  });

  if (existing) {
    return existing;
  }

  return prisma.subscription.create({
    data: {
      userId,
      planId: freePlan.id,
      status: "TRIAL",
    },
  });
}

export async function getCaseAccess(userId?: string | null): Promise<CaseAccessState> {
  const settings = await getPlatformRuntimeSettings();

  if (!userId) {
    return {
      level: "preview",
      previewLimit: settings.freePreviewLimit,
      requiresRegistration: true,
      requiresUpgrade: false,
      canExport: false,
    };
  }

  try {
    const subscription = await prisma.subscription.findFirst({
      where: {
        userId,
        status: { in: ["TRIAL", "ACTIVE"] },
      },
      include: {
        plan: {
          include: {
            features: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!subscription) {
      return {
        level: "preview",
        previewLimit: settings.freePreviewLimit,
        requiresRegistration: false,
        requiresUpgrade: true,
        canExport: false,
      };
    }

    const featureMap = new Map(
      subscription.plan.features.map((feature) => [feature.featureKey, feature.enabled])
    );
    const canSeeFullResults = featureMap.get(FEATURE_KEYS.fullResults) ?? true;
    const canExport = featureMap.get(FEATURE_KEYS.exportCasePackage) ?? false;

    return {
      level: canSeeFullResults ? "full" : "preview",
      previewLimit: settings.freePreviewLimit,
      requiresRegistration: false,
      requiresUpgrade: !canSeeFullResults,
      canExport,
    };
  } catch {
    return {
      level: "full",
      previewLimit: settings.freePreviewLimit,
      requiresRegistration: false,
      requiresUpgrade: false,
      canExport: false,
    };
  }
}
