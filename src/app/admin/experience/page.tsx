import Link from "next/link";
import { guardAdminPage } from "@/lib/admin-guard";
import { PageHeader, Card, CardBody, Badge } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/action-form";
import {
  clearExperiencePatternStaleAction,
  invalidateExperiencePatternsForAuthorityAction,
  markExperiencePatternStaleAction,
  promoteExperiencePatternAction,
  recordExperiencePatternFeedbackAction,
} from "@/actions/experience-registry";
import {
  countRegistryByLevel,
  listRegistryEntries,
  PROMOTION_LABELS,
  PROMOTION_LEVELS,
  type PromotionLevel,
  isPromotionLevel,
} from "@/lib/experience/registry";

export const metadata = { title: "Pattern Registry" };

function levelColor(level: number): "slate" | "lime" | "green" | "amber" | "red" {
  if (level === 4) return "green";
  if (level === 3) return "lime";
  if (level === 2) return "amber";
  if (level === 1) return "slate";
  return "slate";
}

export default async function AdminExperienceRegistryPage({
  searchParams,
}: {
  searchParams?: Promise<{ level?: string }>;
}) {
  await guardAdminPage("admin.experience");
  const params = (await searchParams) ?? {};
  const levelParam = params.level;
  const filterLevel =
    levelParam === "all" || levelParam == null
      ? "all"
      : isPromotionLevel(Number(levelParam))
        ? (Number(levelParam) as PromotionLevel)
        : "all";

  const [entries, counts] = await Promise.all([
    listRegistryEntries({ level: filterLevel, limit: 100 }),
    countRegistryByLevel(),
  ]);

  return (
    <div>
      <PageHeader
        title="Pattern Registry"
        subtitle="Promote de-identified experience toward Production (level 4). Mark help/harm and stale patterns. Stale production patterns are excluded from Sol Experience Search. Outcome ≠ law."
      />

      <Card className="mb-6">
        <CardBody className="space-y-2">
          <p className="text-sm font-semibold text-slate-800">Authority invalidation</p>
          <p className="text-xs text-slate-500">
            When an AuthoritySource catalog key changes, mark linked production patterns stale so they leave Experience
            Search until reviewed.
          </p>
          <ActionForm action={invalidateExperiencePatternsForAuthorityAction} className="flex flex-wrap items-end gap-2">
            <label className="text-xs font-medium text-slate-600">
              Authority key
              <input
                name="authority_key"
                placeholder="uscis_policy_manual"
                className="mt-1 block w-64 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
              />
            </label>
            <SubmitButton className="!bg-slate-800 hover:!bg-slate-700">Invalidate linked patterns</SubmitButton>
          </ActionForm>
        </CardBody>
      </Card>

      <div className="mb-6 flex flex-wrap gap-2">
        <Link
          href="/admin/experience?level=all"
          className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
            filterLevel === "all" ? "bg-slate-900 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200"
          }`}
        >
          All ({Object.values(counts).reduce((a, b) => a + b, 0)})
        </Link>
        {PROMOTION_LEVELS.map((level) => (
          <Link
            key={level}
            href={`/admin/experience?level=${level}`}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              filterLevel === level ? "bg-slate-900 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200"
            }`}
          >
            {level} · {PROMOTION_LABELS[level]} ({counts[level]})
          </Link>
        ))}
      </div>

      {entries.length === 0 ? (
        <Card>
          <CardBody className="text-sm text-slate-500">
            No pattern observations at this level yet. Situation turns publish level 0; consultant corrections and
            government outcomes publish level 1 candidates.
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => {
            const anon = entry.anon;
            const origin = anon.origin ?? "turn";
            const stale = Boolean(entry.staleAt);
            return (
              <Card key={entry.id}>
                <CardBody className="space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-slate-900">{entry.decisionTarget || "untitled decision"}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {entry.workspace} · {origin.replace(/_/g, " ")} · {entry.createdAt.toLocaleString("en-US")}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      <Badge color={levelColor(entry.promotionLevel)}>
                        {entry.promotionLevel} · {PROMOTION_LABELS[entry.promotionLevel]}
                      </Badge>
                      {stale ? <Badge color="red">stale</Badge> : null}
                      <Badge color="slate">
                        help {entry.helpCount} · harm {entry.harmCount}
                      </Badge>
                    </div>
                  </div>

                  <dl className="grid gap-2 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Decision-changing</dt>
                      <dd className="text-slate-700">
                        {(anon.decision_changing_facts || []).join(", ") || "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Discarded</dt>
                      <dd className="text-slate-700">{(anon.facts_discarded || []).slice(0, 6).join(", ") || "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Negative lessons</dt>
                      <dd className="text-slate-700">{(anon.negative_lesson_ids || []).join(", ") || "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Telemetry</dt>
                      <dd className="text-slate-700">
                        {stale
                          ? `stale: ${entry.staleReason || "unspecified"}`
                          : entry.lastServedAt
                            ? `last served ${entry.lastServedAt.toLocaleString("en-US")}`
                            : "not served yet"}
                      </dd>
                    </div>
                  </dl>

                  <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                    <span className="text-xs font-medium text-slate-500">Set level:</span>
                    {PROMOTION_LEVELS.map((level) => (
                      <ActionForm
                        key={`${entry.id}-${level}`}
                        action={promoteExperiencePatternAction}
                        className="inline"
                        successMessage={`Set to ${PROMOTION_LABELS[level]}.`}
                      >
                        <input type="hidden" name="observationId" value={entry.id} />
                        <input type="hidden" name="toLevel" value={String(level)} />
                        <SubmitButton
                          className={`!px-2.5 !py-1 !text-xs ${
                            level === entry.promotionLevel
                              ? "!bg-slate-300 !text-slate-600 hover:!bg-slate-300"
                              : level === 4
                                ? ""
                                : "!bg-slate-800 hover:!bg-slate-700"
                          }`}
                        >
                          {level}
                        </SubmitButton>
                      </ActionForm>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium text-slate-500">Feedback:</span>
                    <ActionForm action={recordExperiencePatternFeedbackAction} className="inline">
                      <input type="hidden" name="observationId" value={entry.id} />
                      <input type="hidden" name="verdict" value="help" />
                      <input type="hidden" name="reason_key" value="helped_answer" />
                      <SubmitButton className="!bg-emerald-700 !px-2.5 !py-1 !text-xs hover:!bg-emerald-800">
                        Help
                      </SubmitButton>
                    </ActionForm>
                    <ActionForm action={recordExperiencePatternFeedbackAction} className="inline">
                      <input type="hidden" name="observationId" value={entry.id} />
                      <input type="hidden" name="verdict" value="harm" />
                      <input type="hidden" name="reason_key" value="harmed_answer" />
                      <SubmitButton className="!bg-red-700 !px-2.5 !py-1 !text-xs hover:!bg-red-800">
                        Harm
                      </SubmitButton>
                    </ActionForm>
                    {stale ? (
                      <ActionForm action={clearExperiencePatternStaleAction} className="inline">
                        <input type="hidden" name="observationId" value={entry.id} />
                        <SubmitButton className="!bg-slate-700 !px-2.5 !py-1 !text-xs hover:!bg-slate-800">
                          Clear stale
                        </SubmitButton>
                      </ActionForm>
                    ) : (
                      <ActionForm action={markExperiencePatternStaleAction} className="inline">
                        <input type="hidden" name="observationId" value={entry.id} />
                        <input type="hidden" name="reason_key" value="admin_marked_stale" />
                        <SubmitButton className="!bg-slate-700 !px-2.5 !py-1 !text-xs hover:!bg-slate-800">
                          Mark stale
                        </SubmitButton>
                      </ActionForm>
                    )}
                    <span className="ml-auto font-mono text-[10px] text-slate-400">{entry.id}</span>
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
