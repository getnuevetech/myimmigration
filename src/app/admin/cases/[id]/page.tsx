import Link from "next/link";
import { notFound } from "next/navigation";
import { reanalyzeCaseAction } from "@/actions/case";
import { db } from "@/lib/db";
import { guardAdminPage } from "@/lib/admin-guard";
import { PageHeader, Card, CardBody, Badge } from "@/components/ui";
import { CaseAnalysisView } from "@/components/case-analysis-view";
import { CaseComments } from "@/components/case-comments";
import { recordRefLabel, resolveReportChrome } from "@/lib/goal-chrome";
import { listCaseVersions } from "@/lib/case-versioning";
import { parseCanonicalApprovedState, versionReasonLabel } from "@/lib/canonical-case-state";
import { matchInputFromCase, resolveVersionChrome } from "@/lib/goal-versions";

// Admins see EXACTLY what the customer sees, plus the case discussion (with
// internal comments) and the technical pipeline diagnostics collapsed below.
export default async function AdminCaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = await guardAdminPage("admin.cases");
  const c = await db.case.findUnique({
    where: { id },
    include: {
      user: { select: { email: true, firstName: true, lastName: true } },
      notices: { select: { noticeType: true } },
      logicalAnalyses: {
        orderBy: { startedAt: "desc" },
        take: 12,
        select: {
          id: true,
          status: true,
          trigger: true,
          modelCallCount: true,
          failedCallCount: true,
          wallClockMs: true,
          skipReason: true,
          coalescePending: true,
          startedAt: true,
          finishedAt: true,
          caseVersionId: true,
          parentId: true,
        },
      },
      runs: {
        orderBy: { startedAt: "desc" },
        include: {
          consensus: true,
          stepResults: { include: { provider: { select: { name: true } } } },
        },
      },
    },
  });
  if (!c) notFound();
  const usedAi = c.runs.some((r) => r.stepResults.length > 0);
  const failedCalls = c.runs.flatMap((r) => r.stepResults).filter((sr) => sr.status === "failed");
  const versions = await listCaseVersions(id, 8).catch(() => []);
  const canonical = await db.canonicalCaseState.findUnique({
    where: { caseId: id },
    select: { approvedStateJson: true, evidenceSnapshotHash: true, updatedAt: true, gateResultJson: true },
  }).catch(() => null);
  const approved = parseCanonicalApprovedState(canonical?.approvedStateJson);
  let gateResult: string | null = null;
  let gateRules: string[] = [];
  try {
    const gate = approved?.approval_gate
      ?? (canonical?.gateResultJson ? JSON.parse(canonical.gateResultJson) : null);
    if (gate?.gate_result) {
      gateResult = String(gate.gate_result);
      gateRules = Array.isArray(gate.rule_ids) ? gate.rule_ids.map(String) : [];
    }
  } catch {
    gateResult = null;
  }

  const versionMatch = matchInputFromCase(c);
  const reportChrome = resolveReportChrome(versionMatch);
  const versionChrome = resolveVersionChrome(versionMatch);

  return (
    <div>
      <PageHeader
        title={c.title}
        subtitle={`${recordRefLabel(versionMatch, c.number)} · ${c.user ? `${c.user.firstName} ${c.user.lastName} · ${c.user.email}` : "Guest intake (unclaimed)"} · created ${c.createdAt.toLocaleString("en-US")} — you are seeing the same analysis as the customer`}
        actions={
          <div className="flex gap-2">
            <form action={reanalyzeCaseAction.bind(null, c.id)}>
              <button
                type="submit"
                className="rounded-lg bg-lime-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-lime-700"
              >
                Re-run analysis
              </button>
            </form>
            <Link
              href={`/admin/reanalysis?caseId=${c.id}`}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Re-analyse and compare
            </Link>
            <a
              href={`/api/cases/${c.id}/report`}
              target="_blank"
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              {reportChrome.documentTitle} ↗
            </a>
          </div>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Badge color={usedAi ? "green" : "lime"}>{usedAi ? "AI pipeline" : "rule-based fallback"}</Badge>
        {gateResult === "BLOCK" && (
          <Badge color="red">Approval gate BLOCK{gateRules.length ? `: ${gateRules.slice(0, 3).join(", ")}` : ""}</Badge>
        )}
        {gateResult === "WARN" && (
          <Badge color="amber">Approval gate WARN{gateRules.length ? `: ${gateRules.slice(0, 3).join(", ")}` : ""}</Badge>
        )}
        {gateResult === "PASS" && <Badge color="green">Approval gate PASS</Badge>}
        {failedCalls.length > 0 && (
          <Badge color="red">{failedCalls.length} failed model call{failedCalls.length === 1 ? "" : "s"} — see diagnostics below</Badge>
        )}
      </div>

      <CaseAnalysisView caseId={c.id} viewer={{ role: "admin", userId: admin.id }} />
      <CaseComments caseId={c.id} viewer={{ role: "admin", userId: admin.id }} />

      {/* Staff-only engineering view: raw model calls and consensus data. */}
      <section className="mt-8">
        <Card>
          <CardBody>
            <details>
              <summary className="cursor-pointer text-sm font-semibold text-slate-700">
                ⚙ Technical diagnostics — analysis runs ({c.runs.length}), model calls, and consensus data (staff only)
              </summary>
              <div className="mt-4 space-y-3">
                {(versions.length > 0 || approved) && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                    <p className="font-semibold text-slate-800">{versionChrome.recordListHeading}</p>
                    {approved && (
                      <p className="mt-1 text-xs text-slate-500">
                        v{approved.version} · {versionReasonLabel(approved.reason, versionMatch)} · posture {approved.presentation?.hero.current_posture || "not stored"}
                        {canonical?.evidenceSnapshotHash ? ` · snapshot ${canonical.evidenceSnapshotHash.slice(0, 12)}` : ""}
                      </p>
                    )}
                    {versions.length > 0 && (
                      <ol className="mt-2 space-y-1 text-xs text-slate-500">
                        {versions.map((item) => (
                          <li key={item.id}>
                            v{item.version} · {versionReasonLabel(item.reason, versionMatch)} · {item.status} · {item.createdAt.toLocaleString("en-US")}
                            {item.evidenceSnapshot?.hash ? ` · ${item.evidenceSnapshot.hash.slice(0, 12)}` : ""}
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                )}
                {c.logicalAnalyses.length > 0 && (
                  <div className="rounded-xl border border-slate-200 p-3">
                    <p className="font-semibold text-slate-800">Logical analyses (Phase F)</p>
                    <ol className="mt-2 space-y-1 text-xs text-slate-600">
                      {c.logicalAnalyses.map((la) => (
                        <li key={la.id}>
                          <span className="font-medium text-slate-800">{la.status}</span>
                          {" · "}
                          {la.trigger}
                          {" · "}
                          {la.modelCallCount} calls
                          {la.failedCallCount > 0 ? ` (${la.failedCallCount} failed)` : ""}
                          {la.wallClockMs ? ` · ${Math.round(la.wallClockMs / 1000)}s` : ""}
                          {la.skipReason ? ` · ${la.skipReason}` : ""}
                          {la.parentId ? " · child" : ""}
                          {" · "}
                          {la.startedAt.toLocaleString("en-US")}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
                {c.runs.map((r) => (
                  <details key={r.id} className="rounded-xl border border-slate-200 p-3">
                    <summary className="flex cursor-pointer flex-wrap items-center gap-2 text-sm">
                      <span className="font-semibold text-slate-800">{r.stageKey}</span>
                      <Badge color={r.status === "complete" ? "green" : r.status === "failed" ? "red" : "slate"}>{r.status}</Badge>
                      <Badge color={r.stepResults.length > 0 ? "lime" : "lime"}>
                        {r.stepResults.length > 0 ? `${r.stepResults.length} model calls` : "no AI (fallback)"}
                      </Badge>
                      {r.consensus?.verificationRequired && <Badge color="red">verification required</Badge>}
                      <span className="text-xs text-slate-400">{r.startedAt.toLocaleString("en-US")}</span>
                    </summary>
                    <div className="mt-3 space-y-2">
                      {r.stepResults.map((sr) => (
                        <div key={sr.id} className={`rounded-lg p-3 text-xs ${sr.status === "failed" ? "bg-red-50" : "bg-slate-50"}`}>
                          <p className={`font-medium ${sr.status === "failed" ? "text-red-700" : "text-slate-700"}`}>
                            {sr.provider?.name ?? "(provider removed)"} · {sr.roleKey} · {sr.status} · {sr.latencyMs}ms
                          </p>
                          {sr.rawText && (
                            <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap text-slate-500">{sr.rawText.slice(0, 1500)}</pre>
                          )}
                        </div>
                      ))}
                      {r.consensus && (
                        <div className="rounded-lg bg-lime-50 p-3 text-xs">
                          <p className="font-medium text-lime-800">Consensus</p>
                          <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap text-lime-700">
                            {JSON.stringify({ merged: JSON.parse(r.consensus.mergedJson || "{}"), conflicts: JSON.parse(r.consensus.conflictsJson || "[]") }, null, 2).slice(0, 2000)}
                          </pre>
                        </div>
                      )}
                    </div>
                  </details>
                ))}
              </div>
            </details>
          </CardBody>
        </Card>
      </section>
    </div>
  );
}
