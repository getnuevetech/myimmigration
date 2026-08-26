import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { guardAdminPage } from "@/lib/admin-guard";
import { PageHeader, Card, CardBody, Badge } from "@/components/ui";
import { AutoRefresh } from "@/components/auto-refresh";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { overrideAdminReanalysisAction, shareAdminReanalysisAction } from "@/actions/admin-reanalysis";
import {
  parseCustomerFacingSnapshot,
  parseReanalysisComparison,
  presentationFromSnapshot,
} from "@/lib/admin-reanalysis";
import { formatCaseNumber } from "@/lib/case-number";
import { recordRefLabel } from "@/lib/goal-chrome";
import { matchInputFromCase } from "@/lib/goal-versions";

function SnapshotColumn({
  title,
  snapshotJson,
}: {
  title: string;
  snapshotJson: string;
}) {
  const snapshot = parseCustomerFacingSnapshot(snapshotJson);
  const presentation = presentationFromSnapshot(snapshot);
  return (
    <Card>
      <CardBody>
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {!snapshot ? (
          <p className="mt-3 text-sm text-slate-500">No snapshot yet.</p>
        ) : (
          <div className="mt-3 space-y-3 text-sm text-slate-700">
            <p>
              <span className="text-xs font-bold uppercase tracking-wide text-slate-400">Posture</span>
              <span className="mt-0.5 block font-medium">
                {presentation?.hero.current_posture || snapshot.case.status.replace(/_/g, " ")}
              </span>
            </p>
            <p>
              <span className="text-xs font-bold uppercase tracking-wide text-slate-400">Next action</span>
              <span className="mt-0.5 block">
                {presentation?.hero.next_best_action?.title || "—"}
              </span>
            </p>
            <p>
              <span className="text-xs font-bold uppercase tracking-wide text-slate-400">Readiness</span>
              <span className="mt-0.5 block">{snapshot.case.readinessScore}%</span>
            </p>
            <p>
              <span className="text-xs font-bold uppercase tracking-wide text-slate-400">Summary</span>
              <span className="mt-0.5 block leading-relaxed">
                {presentation?.what_this_means.summary || "—"}
              </span>
            </p>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Findings</p>
              <ul className="mt-1 space-y-1">
                {(presentation?.findings?.length ? presentation.findings.map((item) => item.title) : snapshot.issues.map((item) => item.title))
                  .slice(0, 8)
                  .map((title, index) => (
                    <li key={`${title}-${index}`} className="rounded-lg bg-slate-50 px-2 py-1">
                      {title}
                    </li>
                  ))}
                {(presentation?.findings?.length ? presentation.findings : snapshot.issues).length === 0 && (
                  <li className="text-slate-400">None</li>
                )}
              </ul>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Path steps</p>
              <ol className="mt-1 list-decimal space-y-1 pl-4">
                {snapshot.pathSteps.map((step) => (
                  <li key={step.id}>{step.title}</li>
                ))}
                {snapshot.pathSteps.length === 0 && <li className="list-none text-slate-400">None</li>}
              </ol>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

export default async function AdminReanalysisDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await guardAdminPage("admin.cases");
  const row = await db.adminCaseReanalysis.findUnique({
    where: { id },
    include: {
      case: {
        select: {
          id: true,
          title: true,
          number: true,
          situation: true,
          goal: true,
          notices: { select: { noticeType: true } },
          user: { select: { email: true, firstName: true, lastName: true } },
        },
      },
      admin: { select: { email: true } },
    },
  });
  if (!row) notFound();
  const comparison = parseReanalysisComparison(row.comparisonJson);
  const running = row.status === "pending" || row.status === "running";
  const ready = ["completed", "shared"].includes(row.status) && !row.overriddenAt;
  const providerIds = (() => {
    try {
      const parsed = JSON.parse(row.providerIdsJson || "[]");
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [] as string[];
    }
  })();
  const providers = providerIds.length
    ? await db.aiProvider.findMany({ where: { id: { in: providerIds } }, select: { id: true, name: true, model: true } })
    : [];
  const match = matchInputFromCase(row.case);

  return (
    <div>
      {running && <AutoRefresh />}
      <PageHeader
        title={`Re-analysis · ${row.case.title}`}
        subtitle={`${recordRefLabel(match, row.case.number)} · ${
          row.case.user ? `${row.case.user.firstName} ${row.case.user.lastName} · ${row.case.user.email}` : "Guest"
        } · started ${row.createdAt.toLocaleString("en-US")}`}
        actions={
          <div className="flex gap-2">
            <Link
              href={`/admin/cases/${row.case.id}`}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Open case
            </Link>
            <Link
              href="/admin/reanalysis"
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              All re-reviews
            </Link>
          </div>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Badge color={row.status === "failed" ? "red" : row.status === "overridden" ? "green" : "lime"}>
          {row.status.replace(/_/g, " ")}
        </Badge>
        <Badge>{formatCaseNumber(row.case.number)}</Badge>
        <span className="text-xs text-slate-500">
          Models: {providers.length ? providers.map((p) => p.name).join(", ") : "default pipeline / rule-based fallback"}
        </span>
        <span className="text-xs text-slate-500">Admin {row.admin.email}</span>
      </div>

      {running && (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-lime-200 bg-lime-50 px-4 py-3 text-sm text-lime-900">
          <span className="h-3 w-3 shrink-0 animate-ping rounded-full bg-lime-500" />
          <span>
            <span className="font-semibold">Staff re-analysis in progress.</span> The live customer output is held at
            the snapshot taken before this run. This page refreshes until the comparison is ready.
          </span>
        </div>
      )}
      {row.status === "failed" && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          Re-analysis failed. The customer output was restored. {row.error}
        </div>
      )}
      {row.overriddenAt && (
        <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          This re-analysed output replaced the customer/user output on {row.overriddenAt.toLocaleString("en-US")}.
        </div>
      )}

      {comparison && (
        <Card className="mb-6">
          <CardBody>
            <h2 className="text-sm font-semibold text-slate-900">What changed</h2>
            <p className="mt-1 text-xs text-slate-500">
              {comparison.changed
                ? "The staff re-analysis differs from the live customer output."
                : "The staff re-analysis matches the live customer output on the compared fields."}
            </p>
            <dl className="mt-3 grid gap-3 sm:grid-cols-2 text-sm">
              <div>
                <dt className="text-xs font-bold uppercase tracking-wide text-slate-400">Posture</dt>
                <dd className={comparison.posture.changed ? "font-medium text-lime-800" : "text-slate-700"}>
                  {comparison.posture.current || "—"} → {comparison.posture.proposed || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase tracking-wide text-slate-400">Next action</dt>
                <dd className={comparison.nextAction.changed ? "font-medium text-lime-800" : "text-slate-700"}>
                  {comparison.nextAction.current || "—"} → {comparison.nextAction.proposed || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase tracking-wide text-slate-400">Readiness</dt>
                <dd className={comparison.readiness.changed ? "font-medium text-lime-800" : "text-slate-700"}>
                  {comparison.readiness.current}% → {comparison.readiness.proposed}%
                </dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase tracking-wide text-slate-400">Status</dt>
                <dd className={comparison.status.changed ? "font-medium text-lime-800" : "text-slate-700"}>
                  {comparison.status.current || "—"} → {comparison.status.proposed || "—"}
                </dd>
              </div>
            </dl>
            {(comparison.findingsAdded.length > 0 || comparison.findingsRemoved.length > 0) && (
              <p className="mt-3 text-xs text-slate-600">
                Findings added: {comparison.findingsAdded.join(", ") || "none"}. Removed:{" "}
                {comparison.findingsRemoved.join(", ") || "none"}.
              </p>
            )}
          </CardBody>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <SnapshotColumn title="Current output to the customer" snapshotJson={row.currentSnapshotJson} />
        <SnapshotColumn title="New admin re-analysed output" snapshotJson={row.proposedSnapshotJson} />
      </div>

      {ready && (
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <Card>
            <CardBody>
              <h2 className="text-sm font-semibold text-slate-900">Share the re-analysed output</h2>
              <p className="mt-1 text-xs text-slate-500">
                Sharing lets the customer and/or consultant see the new review beside their current output. It does not
                replace the live approved state.
              </p>
              <ActionForm action={shareAdminReanalysisAction} successMessage="Shared. They can now see the staff review.">
                <input type="hidden" name="id" value={row.id} />
                <label className="mt-3 flex items-center gap-2 text-sm text-slate-800">
                  <input
                    type="checkbox"
                    name="visibleToCustomer"
                    defaultChecked={row.visibleToCustomer}
                    className="rounded border-slate-300"
                  />
                  Share with customer
                </label>
                <label className="mt-2 flex items-center gap-2 text-sm text-slate-800">
                  <input
                    type="checkbox"
                    name="visibleToConsultant"
                    defaultChecked={row.visibleToConsultant}
                    className="rounded border-slate-300"
                  />
                  Share with consultant
                </label>
                <div className="mt-4">
                  <SubmitButton>Share with selected people</SubmitButton>
                </div>
              </ActionForm>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <h2 className="text-sm font-semibold text-slate-900">Replace the customer output</h2>
              <p className="mt-1 text-xs text-slate-500">
                Override writes the re-analysed result as the live output the customer and consultant see. This cannot
                be undone from this screen.
              </p>
              <ActionForm action={overrideAdminReanalysisAction} successMessage="Customer output replaced with the staff re-analysis.">
                <input type="hidden" name="id" value={row.id} />
                <div className="mt-4">
                  <SubmitButton className="bg-slate-900 hover:bg-slate-800">Override current customer output</SubmitButton>
                </div>
              </ActionForm>
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  );
}
