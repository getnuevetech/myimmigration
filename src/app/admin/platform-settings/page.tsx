import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import {
  ADMIN_MANAGED_ENV_KEYS,
  isAdminManagedEnvKey,
  isSecretEnvKey,
  type AdminManagedEnvKey,
} from "@/lib/platform/runtime-env";

const FIELD_META: Record<AdminManagedEnvKey, { label: string; help: string }> = {
  OPENAI_API_KEY: {
    label: "OpenAI API Key",
    help: "Required for GPT-4o analysis requests (SKEPTIC, PRESENTER, SYNTHESIZER roles).",
  },
  OPENAI_DEFAULT_MODEL: {
    label: "Default OpenAI Model",
    help: "Fallback model when pipeline/model-specific values are missing.",
  },
  OPENAI_FALLBACK_MODEL_SUMMARY: {
    label: "Fallback Model — SUMMARY",
    help: "Optional stage-specific fallback for summary stage.",
  },
  OPENAI_FALLBACK_MODEL_GOAL: {
    label: "Fallback Model — GOAL",
    help: "Optional stage-specific fallback for goal stage.",
  },
  OPENAI_FALLBACK_MODEL_DOCUMENT: {
    label: "Fallback Model — DOCUMENT",
    help: "Optional stage-specific fallback for document stage.",
  },
  OPENAI_FALLBACK_MODEL_SITUATION: {
    label: "Fallback Model — SITUATION",
    help: "Optional stage-specific fallback for situation stage.",
  },
  OPENAI_FALLBACK_MODEL_PRESENTATION: {
    label: "Fallback Model — PRESENTATION",
    help: "Optional stage-specific fallback for presentation stage.",
  },
  ANTHROPIC_API_KEY: {
    label: "Anthropic API Key",
    help: "Required for Claude analysis requests (FACT_EXTRACTOR, INTERPRETER roles).",
  },
  ANTHROPIC_DEFAULT_MODEL: {
    label: "Default Anthropic Model",
    help: "Claude model to use when a step's model is unavailable. Default: claude-opus-4-5.",
  },
  GOOGLE_AI_API_KEY: {
    label: "Google AI API Key",
    help: "Required for Gemini analysis requests (VERIFIER role).",
  },
  GOOGLE_DEFAULT_MODEL: {
    label: "Default Google AI Model",
    help: "Gemini model to use when a step's model is unavailable. Default: gemini-1.5-pro.",
  },
  NEXT_PUBLIC_APP_URL: {
    label: "Public App URL",
    help: "Primary app URL for redirects, callbacks, and absolute links.",
  },
  AUTH_SESSION_SECRET: {
    label: "Auth Session Secret",
    help: "Session signing secret; set a long random value.",
  },
  PAYMENT_WEBHOOK_SECRET: {
    label: "Payment Webhook Secret",
    help: "Webhook verification secret from payment provider.",
  },
};

async function saveSettings(formData: FormData) {
  "use server";

  if (process.env.ADMIN_PREVIEW_ENABLED !== "true") {
    redirect("/");
  }

  for (const [rawKey, rawValue] of formData.entries()) {
    if (!isAdminManagedEnvKey(rawKey)) continue;
    const key = rawKey as AdminManagedEnvKey;
    const value = String(rawValue ?? "").trim();
    const secret = isSecretEnvKey(key);

    if (secret && value.length === 0) {
      continue;
    }

    if (!secret && value.length === 0) {
      await prisma.setting.deleteMany({ where: { key } });
      continue;
    }

    await prisma.setting.upsert({
      where: { key },
      update: {
        value,
        type: "env",
        group: "runtime",
        description: FIELD_META[key].help,
        isSecret: secret,
      },
      create: {
        key,
        value,
        type: "env",
        group: "runtime",
        description: FIELD_META[key].help,
        isSecret: secret,
      },
    });
  }

  revalidatePath("/admin/platform-settings");
}

export default async function PlatformSettingsPage() {
  if (process.env.ADMIN_PREVIEW_ENABLED !== "true") {
    redirect("/");
  }

  const settings = await prisma.setting.findMany({
    where: { key: { in: [...ADMIN_MANAGED_ENV_KEYS] } },
  });
  const valueMap = new Map(settings.map((item) => [item.key, item.value]));

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-4xl px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-slate-900">Platform Settings</h1>
          <Link
            href="/admin"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Back to admin
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          Save all runtime variables from admin. Non-secret empty values are cleared. Secret fields keep
          existing values when left blank.
        </div>

        <form action={saveSettings} className="mt-6 space-y-4">
          {ADMIN_MANAGED_ENV_KEYS.map((key) => {
            const meta = FIELD_META[key];
            const secret = isSecretEnvKey(key);
            const hasStoredValue = valueMap.has(key);
            const currentValue = valueMap.get(key) ?? "";

            return (
              <section key={key} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <label htmlFor={key} className="text-sm font-semibold text-slate-900">
                  {meta.label}
                </label>
                <p className="mt-1 text-xs text-slate-500">{meta.help}</p>
                <input
                  id={key}
                  name={key}
                  type={secret ? "password" : "text"}
                  defaultValue={secret ? "" : currentValue}
                  placeholder={
                    secret
                      ? hasStoredValue
                        ? "Saved (leave blank to keep unchanged)"
                        : "Enter value"
                      : "Enter value"
                  }
                  className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
                />
                <p className="mt-2 text-xs text-slate-400">{key}</p>
              </section>
            );
          })}

          <button
            type="submit"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Save settings
          </button>
        </form>
      </main>
    </div>
  );
}

