import Link from "next/link";
import { revalidatePath } from "next/cache";
import { Badge, Card, CardBody, PageHeader } from "@/components/admin-ui";
import { prisma } from "@/lib/db/prisma";
import { AnalysisStage, StageRole } from "@prisma/client";
import { requireAdmin } from "@/lib/auth";

const STAGE_LABELS: Record<AnalysisStage, string> = {
  SUMMARY: "Summary (Case Reconstruction)",
  GOAL: "Goal (Immigration Research)",
  DOCUMENT: "Document (Intelligence Extraction)",
  SITUATION: "Situation (Case Analysis)",
  PRESENTATION: "Presentation (Explanation Engine)",
};

const ROLE_LABELS: Record<StageRole, string> = {
  FACT_EXTRACTOR: "Fact Extractor — objective facts only",
  INTERPRETER: "Interpreter — meaning and implications",
  SKEPTIC: "Skeptic — stress-test assumptions",
  VERIFIER: "Verifier — consistency and completeness",
  PRESENTER: "Presenter — user-facing plain language",
};

const STAGES = Object.keys(STAGE_LABELS) as AnalysisStage[];

async function toggleStageStep(formData: FormData) {
  "use server";

  await requireAdmin("admin.pipelines", true);

  const stepId = String(formData.get("stepId") ?? "").trim();
  const enabled = formData.get("enabled") === "true";

  if (!stepId) return;

  await prisma.pipelineStep.update({
    where: { id: stepId },
    data: { enabled },
  });

  revalidatePath("/admin/ai-pipelines");
}

export default async function AIPipelinesPage() {
  await requireAdmin("admin.pipelines");

  const [stages, providers] = await Promise.all([
    prisma.pipelineStage.findMany({
      orderBy: { key: "asc" },
      include: {
        steps: {
          orderBy: { orderIndex: "asc" },
          include: { provider: true },
        },
      },
    }),
    prisma.aiProvider.findMany({ where: { enabled: true }, orderBy: { label: "asc" } }),
  ]);

  const stagesWithSteps = new Set(stages.map((s) => s.key));
  const missingStages = STAGES.filter((s) => !stagesWithSteps.has(s));

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader
        title="AI Pipelines"
        subtitle="Configure which providers participate in each analysis stage."
      />
      <div className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-900">
          Each analysis stage runs multiple AI models in assigned roles. When models disagree, a
          SYNTHESIZER step merges their outputs into a single result. Enable or disable steps to
          control which providers participate. Register providers in{" "}
          <Link href="/admin/ai-providers" className="underline font-medium">
            AI Providers
          </Link>{" "}
          first.
      </div>

        {providers.length === 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            No enabled AI providers found. Go to{" "}
            <Link href="/admin/ai-providers" className="underline font-medium">
              AI Providers
            </Link>{" "}
            to register and enable providers before configuring pipeline steps.
          </div>
        )}

        {missingStages.length > 0 && (
          <Card>
            <CardBody className="p-4">
            <p className="text-sm font-semibold text-slate-900">Stages using default configuration</p>
            <p className="mt-1 text-xs text-slate-500">
              These stages have no database overrides and will use the built-in default pipeline
              (multi-provider per role). Database entries are created when you save overrides.
            </p>
            <ul className="mt-2 space-y-1">
              {missingStages.map((s) => (
                <li key={s} className="text-xs text-slate-600">
                  <span className="font-mono">{s}</span> — {STAGE_LABELS[s]}
                </li>
              ))}
            </ul>
            </CardBody>
          </Card>
        )}

        {stages.map((stage) => (
          <Card key={stage.id}>
            <CardBody>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">{STAGE_LABELS[stage.key]}</h2>
              <Badge color={stage.enabled ? "green" : "slate"}>{stage.enabled ? "Active" : "Disabled"}</Badge>
            </div>
            {stage.description && (
              <p className="mt-1 text-xs text-slate-500">{stage.description}</p>
            )}

            <div className="mt-4 divide-y divide-slate-100">
              {stage.steps.length === 0 ? (
                <p className="py-2 text-xs text-slate-400">No steps configured for this stage.</p>
              ) : (
                stage.steps.map((step) => (
                  <div key={step.id} className="flex items-center justify-between py-2.5">
                    <div>
                      <p className="text-sm font-medium text-slate-800">
                        {step.provider.label}
                        <span className="ml-2 font-normal text-slate-500">
                          ({step.provider.model})
                        </span>
                      </p>
                      <p className="text-xs text-slate-500">
                        Role: {ROLE_LABELS[step.stageRole]} · Order: {step.orderIndex}
                      </p>
                    </div>
                    <form action={toggleStageStep} className="flex items-center gap-2">
                      <input type="hidden" name="stepId" value={step.id} />
                      <input type="hidden" name="enabled" value={step.enabled ? "false" : "true"} />
                      <button
                        type="submit"
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                          step.enabled
                            ? "bg-slate-100 text-slate-700 hover:bg-red-50 hover:text-red-700"
                            : "bg-green-50 text-green-700 hover:bg-green-100"
                        }`}
                      >
                        {step.enabled ? "Disable" : "Enable"}
                      </button>
                    </form>
                  </div>
                ))
              )}
            </div>
            </CardBody>
          </Card>
        ))}
    </div>
  );
}
