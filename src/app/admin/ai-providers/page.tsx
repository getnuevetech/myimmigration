import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth";

const KNOWN_PROVIDERS = [
  {
    key: "openai-gpt4o",
    label: "OpenAI GPT-4o",
    provider: "OpenAI",
    model: "gpt-4o",
    apiKeyRef: "OPENAI_API_KEY",
  },
  {
    key: "anthropic-claude-opus",
    label: "Anthropic Claude Opus",
    provider: "Anthropic",
    model: "claude-opus-4-5",
    apiKeyRef: "ANTHROPIC_API_KEY",
  },
  {
    key: "google-gemini-pro",
    label: "Google Gemini 1.5 Pro",
    provider: "Google",
    model: "gemini-1.5-pro",
    apiKeyRef: "GOOGLE_AI_API_KEY",
  },
];

async function saveProvider(formData: FormData) {
  "use server";

  await requireAdmin("admin.ai", true);

  const key = String(formData.get("key") ?? "").trim();
  const label = String(formData.get("label") ?? "").trim();
  const provider = String(formData.get("provider") ?? "").trim();
  const model = String(formData.get("model") ?? "").trim();
  const apiKeyRef = String(formData.get("apiKeyRef") ?? "").trim();
  const maxTokensRaw = String(formData.get("maxTokens") ?? "").trim();
  const enabled = formData.get("enabled") === "on";

  if (!key || !label || !provider || !model || !apiKeyRef) return;

  const maxTokens = maxTokensRaw ? parseInt(maxTokensRaw, 10) : null;

  await prisma.aiProvider.upsert({
    where: { key },
    update: { label, provider, model, apiKeyRef, maxTokens, enabled },
    create: { key, label, provider, model, apiKeyRef, maxTokens: maxTokens ?? undefined, enabled },
  });

  revalidatePath("/admin/ai-providers");
}

export default async function AIProvidersPage() {
  await requireAdmin("admin.ai");

  const providers = await prisma.aiProvider.findMany({ orderBy: { createdAt: "asc" } });
  const providerMap = new Map(providers.map((p) => [p.key, p]));

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">AI Providers</h1>
        <p className="mt-1 text-sm text-slate-600">
          Register and enable providers used by the analysis pipeline.
        </p>
      </div>
        <div className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-900">
          Register and enable AI provider credentials. Each provider must have its API key configured
          in Platform Settings before it can serve analysis requests.
        </div>

        {KNOWN_PROVIDERS.map((preset) => {
          const existing = providerMap.get(preset.key);
          return (
            <section
              key={preset.key}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-900">{preset.label}</h2>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    existing?.enabled
                      ? "bg-green-100 text-green-700"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {existing?.enabled ? "Enabled" : existing ? "Disabled" : "Not registered"}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Provider: <strong>{preset.provider}</strong> · Model:{" "}
                <code className="text-xs">{existing?.model ?? preset.model}</code> · API key env:{" "}
                <code className="text-xs">{preset.apiKeyRef}</code>
              </p>
              <form action={saveProvider} className="mt-4 grid grid-cols-2 gap-3">
                <input type="hidden" name="key" value={preset.key} />
                <input type="hidden" name="provider" value={preset.provider} />
                <input type="hidden" name="apiKeyRef" value={preset.apiKeyRef} />
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-medium text-slate-700 mb-1">Label</label>
                  <input
                    name="label"
                    defaultValue={existing?.label ?? preset.label}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-orange-500 focus:outline-none"
                  />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-medium text-slate-700 mb-1">Model ID</label>
                  <input
                    name="model"
                    defaultValue={existing?.model ?? preset.model}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-orange-500 focus:outline-none"
                  />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Max Tokens (optional)
                  </label>
                  <input
                    name="maxTokens"
                    type="number"
                    defaultValue={existing?.maxTokens ?? ""}
                    placeholder="e.g. 4096"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-orange-500 focus:outline-none"
                  />
                </div>
                <div className="col-span-2 sm:col-span-1 flex items-center gap-2 pt-4">
                  <input
                    id={`enabled-${preset.key}`}
                    name="enabled"
                    type="checkbox"
                    defaultChecked={existing?.enabled ?? true}
                    className="h-4 w-4 rounded border-slate-300 text-orange-600"
                  />
                  <label
                    htmlFor={`enabled-${preset.key}`}
                    className="text-sm font-medium text-slate-700"
                  >
                    Enable this provider
                  </label>
                </div>
                <div className="col-span-2">
                  <button
                    type="submit"
                    className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700"
                  >
                    Save
                  </button>
                </div>
              </form>
            </section>
          );
        })}
    </div>
  );
}
