import { db } from "@/lib/db";
import { isAdmin, requireUser } from "@/lib/auth";
import { getActivePlan, hasFeature } from "@/lib/access";
import { FEATURE_KEYS } from "@/lib/constants";
import { PageHeader, Card, CardBody, Badge, ProgressBar, EmptyState } from "@/components/ui";
import { startFormAction, deleteFormSubmissionAction } from "@/actions/forms";
import Link from "next/link";
import { authorityQueriesForInquiry, classifyImmigrationInquiry } from "@/lib/immigration-inquiry";
import {
  rankFormCatalog,
  rankMatchingForms,
  resolveFormCatalogEntitlement,
} from "@/lib/goal-forms";

export const metadata = { title: "USCIS forms" };

export default async function FormsPage({
  searchParams,
}: {
  searchParams: Promise<{ form?: string; case?: string }>;
}) {
  const { form: requestedForm, case: caseId } = await searchParams;
  const user = await requireUser();
  const plan = await getActivePlan(user.id);
  const staff = isAdmin(user);
  const hasWizard = staff || (await hasFeature(user.id, FEATURE_KEYS.FORMS));
  const entitlement = resolveFormCatalogEntitlement({
    isStaff: staff,
    planKey: plan?.key,
    hasWizard,
  });

  const [templates, submissions, scopedCase] = await Promise.all([
    db.uscisFormTemplate.findMany({ where: { isPublished: true }, orderBy: { sortOrder: "asc" } }),
    db.formSubmission.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      include: { template: true },
    }),
    caseId
      ? db.case.findFirst({
          where: { id: caseId, userId: user.id },
          select: { id: true, situation: true, goal: true, issues: { select: { title: true, uscisBasis: true, conclusion: true } } },
        })
      : db.case.findFirst({
          where: { userId: user.id },
          orderBy: { updatedAt: "desc" },
          select: { id: true, situation: true, goal: true, issues: { select: { title: true, uscisBasis: true, conclusion: true } } },
        }),
  ]);

  const inquiry = scopedCase
    ? classifyImmigrationInquiry({ situation: scopedCase.situation, goal: scopedCase.goal })
    : null;
  const ranked = inquiry
    ? rankMatchingForms({
        themes: inquiry.themes,
        inquiryMode: inquiry.mode,
        query: `${scopedCase?.situation ?? ""} ${scopedCase?.goal ?? ""}`,
        authorityQueries: authorityQueriesForInquiry(inquiry),
        sources: (scopedCase?.issues ?? []).map((issue) => ({
          reference: issue.uscisBasis,
          title: issue.title,
          content: issue.conclusion,
        })),
      })
    : [];
  const bestMatch = requestedForm?.toUpperCase() || ranked[0]?.formNumber;
  const catalog = rankFormCatalog(templates, ranked);

  return (
    <div>
      <PageHeader
        title="USCIS forms, minus the headache"
        subtitle="Answer simple questions one at a time — like a quiz — and we assemble the real form for you. Matching forms come from the official material on your latest case, not a generic I-485 default."
      />

      {entitlement.showUpgradeCta && (
        <div className="mb-6 rounded-xl border border-lime-200 bg-lime-50 px-4 py-3 text-sm text-lime-900">
          The matching form is highlighted. Filling it with the guided wizard is included in Plus.{" "}
          <Link href="/app/billing?upgrade=forms" className="font-semibold underline">Upgrade to Plus →</Link>
        </div>
      )}

      {submissions.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-base font-semibold text-slate-900">Continue where you left off</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {submissions.map((s) => (
              <Card key={s.id}>
                <CardBody>
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-slate-900">Form {s.template.formNumber}</p>
                    <Badge color={s.status === "completed" ? "green" : "lime"}>
                      {s.status === "completed" ? "Completed" : `${s.progressPct}% done`}
                    </Badge>
                  </div>
                  <p className="text-sm text-slate-500">{s.template.title}</p>
                  <div className="mt-3"><ProgressBar value={s.progressPct} /></div>
                  <div className="mt-3 flex items-center justify-between">
                    <Link
                      href={`/app/forms/fill/${s.id}${s.status === "completed" ? "?done=1" : ""}`}
                      className="text-sm font-semibold text-lime-600 hover:text-lime-800"
                    >
                      {s.status === "completed" ? "View completed form →" : "Continue →"}
                    </Link>
                    <form action={deleteFormSubmissionAction.bind(null, s.id)}>
                      <button className="text-xs text-slate-400 hover:text-red-600">Delete</button>
                    </form>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        </section>
      )}

      <h2 className="mb-3 text-base font-semibold text-slate-900">Available forms</h2>
      {catalog.length === 0 ? (
        <EmptyState title="No forms available yet" body="The team is preparing simplified versions of the most common USCIS forms." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {catalog.map((t) => {
            const steps = JSON.parse(t.stepsJson || "[]") as unknown[];
            const isBest = bestMatch != null && t.formNumber.toUpperCase() === String(bestMatch).toUpperCase();
            return (
              <Card key={t.id} className={`transition ${isBest ? "border-lime-400 ring-1 ring-lime-200" : "hover:border-lime-300"}`}>
                <CardBody>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-lg font-bold text-slate-900">Form {t.formNumber}</p>
                    <div className="flex flex-wrap justify-end gap-1">
                      {isBest && <Badge color="lime">Best match</Badge>}
                      <Badge>{steps.length} quick steps</Badge>
                    </div>
                  </div>
                  <p className="font-medium text-slate-700">{t.title}</p>
                  <p className="mt-1 text-sm text-slate-500">{t.description}</p>
                  {entitlement.canStartWizard ? (
                    <form action={startFormAction.bind(null, t.id)} className="mt-4">
                      <button className="w-full rounded-lg bg-lime-600 px-4 py-2 text-sm font-semibold text-white hover:bg-lime-700">
                        {isBest ? `Start Form ${t.formNumber} →` : "Start — it's like a quiz →"}
                      </button>
                    </form>
                  ) : (
                    <Link
                      href="/app/billing?upgrade=forms"
                      className="mt-4 block w-full rounded-lg bg-slate-800 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-slate-900"
                    >
                      {isBest ? `Unlock Form ${t.formNumber} with Plus →` : "Unlock with Plus →"}
                    </Link>
                  )}
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
