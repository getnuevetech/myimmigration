import { db } from "@/lib/db";
import { Card, CardBody, StateMark, ProgressBar, Badge, EvidenceStatusBadge, EvidenceStrengthLine, ItemKindBadge } from "@/components/ui";
import { isVerifiable } from "@/lib/case-progress";
import { completePathStepAction, checkCaseProgressAction } from "@/actions/case";
import { startFormAction } from "@/actions/forms";
import { InlineUpload } from "@/components/inline-upload";
import { CaseUpload } from "@/components/case-upload";
import { AutoRefresh } from "@/components/auto-refresh";
import { immigrationDocumentTypeLabel } from "@/domain/documents";
import { getLatestCaseVersion, listCaseVersions } from "@/lib/case-versioning";
import { resolveCasePresentation } from "@/lib/case-presentation";
import { CasePresentationView, MatchingUscisMaterials } from "@/components/case-presentation-view";
import { CaseAnalysisPlanCard } from "@/components/case-analysis-plan-card";
import { CaseVersionCard } from "@/components/case-version-card";
import Link from "next/link";
import { hasFeature } from "@/lib/access";
import { FEATURE_KEYS } from "@/lib/constants";
import { authorityQueriesForInquiry, classifyImmigrationInquiry } from "@/lib/immigration-inquiry";
import { formNumberForStep, formStartLabel, matchingFormNumber } from "@/lib/goal-forms";
import { letterKindForStep, matchingLetterKind } from "@/lib/goal-letters";
import {
  documentKindDef,
  neededDocumentsFromRanked,
  rankMatchingDocuments,
} from "@/lib/goal-documents";
import { shouldShowUscisAccountGuide } from "@/lib/goal-notices";
import { resolveReadinessCopy } from "@/lib/goal-readiness";
import { presentationStepCta } from "@/lib/case-presentation-ui";
import { presentationWhatThisMeansSummary } from "@/lib/case-presentation-contract";
import { parseSituationBrief } from "@/lib/situation-brief";
import { caseTypeLockFromBrief } from "@/lib/case-type-lock";
import { assembleV5CustomerPresentation } from "@/lib/v5-customer-presentation";
import { V5CustomerPresentationView } from "@/components/v5-customer-presentation-view";
import {
  analysisDocumentWalkthrough,
  closedReasonLabel,
  matchInputFromCase,
  resolveVersionChrome,
  verifiableActionCopy,
} from "@/lib/goal-versions";
import { resolveIntakeChrome } from "@/lib/goal-intake";
import { parseCanonicalApprovedState } from "@/lib/canonical-case-state";
import {
  getRunningReanalysis,
  getSharedReanalysisForViewer,
  parseCustomerFacingSnapshot,
  presentationFromSnapshot,
} from "@/lib/admin-reanalysis";
import { StaffSharedReanalysis } from "@/components/staff-shared-reanalysis";

export type CaseViewer = {
  role: "customer" | "consultant" | "admin";
  userId: string;
  fullResults?: boolean;
  suggestionAccess?: import("@/lib/suggestion-access").SuggestionChatAccess;
};

// The single source of truth for how a case analysis is presented. Customers,
// consultants, and admins all see EXACTLY this view — only the available
// functions differ (customers act; consultants/admins read and comment).
export async function CaseAnalysisView({ caseId, viewer }: { caseId: string; viewer: CaseViewer }) {
  const { getCurrentUser, isAdmin } = await import("@/lib/auth");
  const { canAccessCase } = await import("@/lib/case-access");
  const current = await getCurrentUser();
  if (!current || current.id !== viewer.userId) return null;
  if (!isAdmin(current)) {
    const access = await canAccessCase(caseId, { kind: "user", user: current });
    if (!access.allowed) return null;
  }

  const c = await db.case.findUnique({
    where: { id: caseId },
    include: {
      issues: { orderBy: [{ priority: "asc" }, { createdAt: "asc" }] },
      pathSteps: { orderBy: { sortOrder: "asc" } },
      documents: { where: { deletedAt: null, duplicateOfId: null } },
      notices: { select: { noticeType: true } },
      runs: { orderBy: { startedAt: "desc" }, include: { consensus: true }, take: 10 },
      reconstruction: true,
      evidenceAudits: { orderBy: { createdAt: "desc" }, take: 1 },
      unknowns: { orderBy: { createdAt: "asc" }, take: 8 },
    },
  });
  if (!c) return null;

  const runningReanalysis = await getRunningReanalysis(caseId).catch(() => null);
  const freeze = runningReanalysis ? parseCustomerFacingSnapshot(runningReanalysis.currentSnapshotJson) : null;
  if (freeze) {
    c.status = freeze.case.status;
    c.readinessScore = freeze.case.readinessScore;
    c.evidenceAvailableScore = freeze.case.evidenceAvailableScore;
    c.evidenceProcessedScore = freeze.case.evidenceProcessedScore;
    c.actionReadinessScore = freeze.case.actionReadinessScore;
    c.conflictsJson = freeze.case.conflictsJson;
    c.issues = freeze.issues as typeof c.issues;
    c.pathSteps = freeze.pathSteps as typeof c.pathSteps;
    if (freeze.reconstruction) {
      c.reconstruction = {
        ...(c.reconstruction ?? {
          id: "freeze",
          caseId,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
        ...freeze.reconstruction,
      } as typeof c.reconstruction;
    }
  }

  // Self-heal: if a background analysis was cut off (deploy/restart), don't
  // spin forever — recover to a stable status after 10 minutes.
  if (!freeze && c.status === "analyzing" && Date.now() - c.updatedAt.getTime() > 10 * 60000) {
    c.status = c.issues.length > 0 ? "analyzed" : "needs_info";
    await db.case.update({ where: { id: c.id }, data: { status: c.status } }).catch(() => null);
  }

  const interactive = viewer.role === "customer";
  const fullAccess = viewer.role !== "customer" ? true : (viewer.fullResults ?? true);
  const visibleIssues = fullAccess ? c.issues : c.issues.slice(0, 1);
  const verificationFlags = c.runs.filter((r) => r.consensus?.verificationRequired).length;
  const latestEvidenceAudit = c.evidenceAudits[0] ?? null;
  const canonicalState = freeze?.canonical
    ? { approvedStateJson: freeze.canonical.approvedStateJson }
    : await db.canonicalCaseState.findUnique({
        where: { caseId },
        select: { approvedStateJson: true },
      }).catch(() => null);
  const approvedState = parseCanonicalApprovedState(canonicalState?.approvedStateJson);
  const presentation =
    (freeze ? presentationFromSnapshot(freeze) : null) ?? (await resolveCasePresentation(caseId).catch(() => null));
  const sharedRow =
    viewer.role === "admin" ? null : await getSharedReanalysisForViewer(caseId, viewer.role).catch(() => null);
  const sharedSnapshot = sharedRow ? parseCustomerFacingSnapshot(sharedRow.proposedSnapshotJson) : null;
  const staffReviewBanner = (
    <>
      {runningReanalysis && viewer.role === "admin" && (
        <div className="rounded-xl border border-lime-200 bg-lime-50 px-4 py-3 text-sm text-lime-900">
          <span className="font-semibold">Staff re-analysis running.</span> Live customer output is held at the
          pre-run snapshot.{" "}
          <Link href={`/admin/reanalysis/${runningReanalysis.id}`} className="font-medium underline">
            Open comparison
          </Link>
        </div>
      )}
      {sharedSnapshot ? <StaffSharedReanalysis snapshot={sharedSnapshot} /> : null}
    </>
  );
  const latestVersion = await getLatestCaseVersion(caseId).catch(() => null);
  const versionHistory = viewer.role === "admin" ? await listCaseVersions(caseId, 8).catch(() => []) : [];
  const inquiry = classifyImmigrationInquiry({ situation: c.situation, goal: c.goal });
  const situationBrief = parseSituationBrief(c.reconstruction?.briefJson);
  const caseLock = caseTypeLockFromBrief(situationBrief);
  const versionMatch = matchInputFromCase({
    situation: c.situation,
    goal: c.goal,
    notices: c.notices,
    inquiryMode: inquiry.mode,
  });
  const versionChrome = resolveVersionChrome(versionMatch);
  const intake = resolveIntakeChrome(versionMatch);
  const versionCard = (
    <CaseVersionCard
      version={latestVersion}
      versions={viewer.role === "admin" ? versionHistory : []}
      approvedStateJson={viewer.role === "admin" ? canonicalState?.approvedStateJson : null}
      match={versionMatch}
    />
  );
  const analysisPlanRow = await db.caseAnalysisPlan.findFirst({
    where: { caseId },
    orderBy: { createdAt: "desc" },
    select: { planJson: true },
  }).catch(() => null);
  const analysisPlanJson = approvedState?.analysis_plan
    ? JSON.stringify(approvedState.analysis_plan)
    : analysisPlanRow?.planJson;
  let evidenceTimeline: { eventType?: string; title?: string; dateText?: string }[] = presentation?.timeline ?? [];
  let pendingEvidenceActions: string[] = presentation?.what_this_means.pending_actions ?? [];
  let conflicts: { topic: string; description: string; resolution?: string }[] =
    presentation?.what_this_means.conflicts ?? [];
  if (!presentation) {
    try {
      const parsed = JSON.parse(c.conflictsJson || "[]");
      if (Array.isArray(parsed)) conflicts = parsed.filter((x) => x?.topic && x?.description);
    } catch { /* legacy cases */ }
    try {
      const parsed = JSON.parse(c.reconstruction?.timelineJson || "[]");
      if (Array.isArray(parsed)) {
        evidenceTimeline = parsed
          .map((item) => ({
            eventType: typeof item?.eventType === "string" ? item.eventType : "",
            title: typeof item?.title === "string" ? item.title : "",
            dateText: typeof item?.dateText === "string" ? item.dateText : "",
          }))
          .filter((item) => item.title);
      }
    } catch { /* no reconstruction timeline yet */ }
    try {
      const parsed = JSON.parse(c.reconstruction?.pendingActionsJson || "[]");
      if (Array.isArray(parsed)) pendingEvidenceActions = parsed.map(String).filter(Boolean);
    } catch { /* no pending evidence actions yet */ }
  }
  const currentPosition =
    presentation?.hero.current_posture || c.reconstruction?.currentPosition || versionChrome.defaultPosture;
  const evidenceSummaryRaw =
    presentation?.what_this_means.summary ||
    c.reconstruction?.summary ||
    latestEvidenceAudit?.summary ||
    "";
  const evidenceSummary = evidenceSummaryRaw
    ? presentationWhatThisMeansSummary(evidenceSummaryRaw, versionMatch)
    : versionChrome.emptyEvidenceSummary;
  const evidenceGateStatus = presentation?.what_this_means.evidence_gate_status || latestEvidenceAudit?.status || null;
  const unknownQuestions = presentation?.what_this_means.unknowns.length
    ? presentation.what_this_means.unknowns
    : c.unknowns.map((unknown) => unknown.question);
  const professionalReviewRecommended =
    presentation?.hero.professional_review_recommended || c.status === "consultant_recommended";
  const nextBestAction = presentation?.hero.next_best_action ?? null;
  const nearestDeadline = presentation?.hero.nearest_deadline ?? null;

  const haveKinds = new Set(c.documents.map((d) => d.docKind));
  const readinessCopy = resolveReadinessCopy({
    themes: inquiry.themes,
    inquiryMode: inquiry.mode,
    query: `${c.situation} ${c.goal}`,
    noticeTypes: c.notices.map((notice) => notice.noticeType),
    caseLock,
  });
  const rankedDocuments = rankMatchingDocuments({
    themes: inquiry.themes,
    inquiryMode: inquiry.mode,
    query: `${c.situation} ${c.goal}`,
    authorityQueries: authorityQueriesForInquiry(inquiry, caseLock),
    sources: c.issues.map((issue) => ({
      reference: issue.uscisBasis,
      title: issue.title,
      content: issue.conclusion,
    })),
    noticeTypes: c.notices.map((notice) => notice.noticeType),
    caseLock,
  });
  const neededDocs = neededDocumentsFromRanked(rankedDocuments).map((item) => ({
    kind: item.kind,
    label: item.label,
    hint: item.hint,
  }));
  const matchingDocumentKind = rankedDocuments[0]?.kind ?? "identity";
  const showUscisAccountGuide = shouldShowUscisAccountGuide({
    inquiryMode: inquiry.mode,
    noticeTypes: c.notices.map((notice) => notice.noticeType),
  });
  const documentKinds = rankedDocuments.map((item) => ({
    kind: item.kind,
    name: documentKindDef(item.kind)?.name ?? item.label,
  }));
  const matchingNumber = matchingFormNumber({
    themes: inquiry.themes,
    inquiryMode: inquiry.mode,
    query: `${c.situation} ${c.goal}`,
    authorityQueries: authorityQueriesForInquiry(inquiry, caseLock),
    sources: c.issues.map((issue) => ({
      reference: issue.uscisBasis,
      title: issue.title,
      content: issue.conclusion,
    })),
    caseLock,
  });
  const matchingForm = matchingNumber
    ? await db.uscisFormTemplate.findFirst({
        where: { formNumber: matchingNumber, isPublished: true },
        select: { id: true, formNumber: true },
      })
    : null;
  const matchingFormNumberValue = matchingForm?.formNumber ?? matchingNumber;
  const canStartForm = Boolean(
    interactive && matchingForm && (viewer.role !== "customer" || (await hasFeature(viewer.userId, FEATURE_KEYS.FORMS))),
  );
  const matchingLetter = matchingLetterKind({
    themes: inquiry.themes,
    inquiryMode: inquiry.mode,
    query: `${c.situation} ${c.goal}`,
    authorityQueries: authorityQueriesForInquiry(inquiry, caseLock),
    sources: c.issues.map((issue) => ({
      reference: issue.uscisBasis,
      title: issue.title,
      content: issue.conclusion,
    })),
    noticeTypes: c.notices.map((notice) => notice.noticeType),
    caseLock,
  });
  const canGenerateLetter = Boolean(
    interactive && matchingLetter && (viewer.role !== "customer" || (await hasFeature(viewer.userId, FEATURE_KEYS.LETTERS))),
  );
  const matchingMaterials = (
    <MatchingUscisMaterials
      caseId={c.id}
      interactive={interactive}
      matchingFormId={matchingForm?.id ?? null}
      matchingFormNumber={matchingFormNumberValue}
      canStartForm={canStartForm}
      matchingLetterKind={matchingLetter}
      canGenerateLetter={canGenerateLetter}
      matchingDocumentKind={matchingDocumentKind}
      officialMaterialLead={intake.officialMaterialLead}
    />
  );

  const v5Presentation = assembleV5CustomerPresentation({
    brief: situationBrief,
    presentation,
    pathSteps: c.pathSteps.map((step) => ({
      title: step.title,
      description: step.description,
      actionKey: step.actionKey,
      status: step.status,
    })),
    documents: c.documents.map((doc) => ({
      id: doc.id,
      fileName: doc.fileName,
      documentType: doc.documentType,
      docKind: doc.docKind,
      processingStatus: doc.processingStatus,
      contentHash: doc.contentHash,
      duplicateOfId: doc.duplicateOfId,
    })),
    neededDocs,
  });
  const showStaffInternals = viewer.role !== "customer";

  if (presentation || situationBrief) {
    return (
      <div className="space-y-6">
        {staffReviewBanner}
        {c.status === "analyzing" && (
          <div className="flex items-center gap-3 rounded-xl border border-lime-200 bg-lime-50 px-4 py-3 text-sm text-lime-900">
            <span className="h-3 w-3 shrink-0 animate-ping rounded-full bg-lime-500" />
            <span>
              <span className="font-semibold">Analysis in progress…</span> Your findings update on this page automatically —
              a detailed review can take a couple of minutes.
            </span>
            <AutoRefresh />
          </div>
        )}
        {c.status === "closed" && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 text-slate-100">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
              {versionChrome.closedEyebrow(
                c.closedAt ? c.closedAt.toLocaleDateString("en-US") : "",
                closedReasonLabel(c.closedReason),
              )}
            </p>
            <h2 className="mt-1 text-lg font-semibold text-white">Final review & closing remarks</h2>
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-200">{c.closingRemarks || versionChrome.closedEmpty}</p>
          </div>
        )}
        <V5CustomerPresentationView
          presentation={v5Presentation}
          caseMeta={{
            primaryForm: situationBrief?.primaryForm ?? caseLock?.primaryForm ?? null,
            relatedProcess: situationBrief?.relatedProcess ?? null,
          }}
        />
        {showStaffInternals && presentation ? (
          <details className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <summary className="cursor-pointer text-sm font-semibold text-slate-800">Staff / audit presentation detail</summary>
            <div className="mt-4">
              <CasePresentationView
                caseId={c.id}
                viewer={viewer}
                interactive={interactive}
                fullAccess={fullAccess}
                presentation={presentation}
                goal={c.goal}
                readinessScore={c.readinessScore}
                evidenceAvailableScore={c.evidenceAvailableScore}
                evidenceProcessedScore={c.evidenceProcessedScore}
                actionReadinessScore={c.actionReadinessScore}
                issues={c.issues}
                pathSteps={c.pathSteps}
                documents={c.documents}
                neededDocs={neededDocs}
                matchingFormId={matchingForm?.id ?? null}
                matchingFormNumber={matchingFormNumberValue}
                canStartForm={canStartForm}
                matchingLetterKind={matchingLetter}
                canGenerateLetter={canGenerateLetter}
                matchingDocumentKind={matchingDocumentKind}
                documentKinds={documentKinds}
                inquiryMode={inquiry.mode}
                suggestionAccess={viewer.suggestionAccess}
              />
            </div>
          </details>
        ) : null}
        {showStaffInternals && analysisPlanJson ? <CaseAnalysisPlanCard planJson={analysisPlanJson} match={versionMatch} /> : null}
        {showStaffInternals ? versionCard : null}
        {matchingMaterials}
      </div>
    );
  }

  const stepCta = (actionKey: string, title?: string): { label: string; href: string } | null => {
    const formNumber = formNumberForStep({ actionKey, title, matchingForm: matchingFormNumberValue });
    const letterKind = letterKindForStep({ actionKey, title, matchingLetter });
    return presentationStepCta(actionKey, c.id, formNumber, letterKind, {
      inquiryMode: inquiry.mode,
      matchingDocumentKind,
      noticeTypes: c.notices.map((notice) => notice.noticeType),
    });
  };

  // Plain-English walkthrough of the latest analysis batch.
  const chronological = [...c.runs].reverse();
  const latestStart = c.runs[0]?.startedAt?.getTime() ?? 0;
  const latestBatch = chronological.filter((r) => latestStart - r.startedAt.getTime() < 5 * 60 * 1000);
  const describeRun = (run: (typeof latestBatch)[number]): string => {
    let merged: Record<string, unknown> = {};
    try {
      merged = JSON.parse(run.consensus?.mergedJson || "{}");
    } catch { /* empty */ }
    switch (run.stageKey) {
      case "summary": {
        const years = Array.isArray(merged.case_years)
          ? (merged.case_years as unknown[]).join(", ")
          : "";
        const notices = Array.isArray(merged.notices_received) ? (merged.notices_received as unknown[]).join(", ") : "";
        const parts = [
          years && `timeline year(s) ${years}`,
          notices && `notice ${notices}`,
          merged.current_status && `current status ${String(merged.current_status)}`,
          merged.receipt_numbers && `receipt numbers ${(merged.receipt_numbers as unknown[]).join(", ")}`,
        ].filter(Boolean);
        return parts.length
          ? `Read the summary and pulled out the facts: ${parts.join(" · ")}.`
          : "Read the summary and recorded the key facts.";
      }
      case "goal":
        return "Interpreted the goal so every recommendation points at the requested outcome.";
      case "document":
        return analysisDocumentWalkthrough(c.documents.length, versionMatch);
      case "situation":
        return "Weighed the verified facts against USCIS rules and procedures from the knowledge base.";
      case "presenter":
        return "Assembled everything into the findings and step-by-step plan on this page.";
      default:
        return `Completed the ${run.stageKey.replace(/_/g, " ")} check.`;
    }
  };

  return (
    <div className="space-y-6">
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        {staffReviewBanner}
        {c.status === "analyzing" && (
          <div className="flex items-center gap-3 rounded-xl border border-lime-200 bg-lime-50 px-4 py-3 text-sm text-lime-900">
            <span className="h-3 w-3 shrink-0 animate-ping rounded-full bg-lime-500" />
            <span>
              <span className="font-semibold">Analysis in progress…</span> Your findings update on this page automatically —
              a detailed review can take a couple of minutes.
            </span>
            <AutoRefresh />
          </div>
        )}
        {c.status === "closed" && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 text-slate-100">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
              {versionChrome.closedEyebrow(
                c.closedAt ? c.closedAt.toLocaleDateString("en-US") : "",
                closedReasonLabel(c.closedReason),
              )}
            </p>
            <h2 className="mt-1 text-lg font-semibold text-white">Final review & closing remarks</h2>
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-200">{c.closingRemarks || versionChrome.closedEmpty}</p>
          </div>
        )}
        {analysisPlanJson ? <CaseAnalysisPlanCard planJson={analysisPlanJson} match={versionMatch} /> : null}
        {versionCard}
        {professionalReviewRecommended && (
          <div className="rounded-xl border border-lime-300 bg-lime-50 px-4 py-3 text-sm text-lime-900">
            <span className="font-semibold">▲ Professional review recommended.</span> Based on the analysis, this {inquiry.mode === "open_options" ? "situation" : "case"} would benefit
            from a licensed professional.
          </div>
        )}
        {verificationFlags > 0 && (
          <div className="rounded-xl border border-lime-200 bg-lime-50 px-4 py-3 text-sm text-lime-900">
            <span className="font-semibold">◐ Verification required.</span> {intake.verificationHint}
          </div>
        )}
        {conflicts.map((cf, ci) => (
          <div key={ci} className="rounded-xl border border-lime-300 bg-lime-50 px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-wider text-lime-700">Information conflict — {cf.topic}</p>
            <p className="mt-1 text-sm text-lime-900">{cf.description}</p>
            {cf.resolution && <p className="mt-1 text-xs text-lime-700">{cf.resolution}</p>}
          </div>
        ))}

        {(c.reconstruction || latestEvidenceAudit || unknownQuestions.length > 0) && (
          <section>
            <h2 className="mb-3 text-base font-semibold text-slate-900">Current evidence position</h2>
            <Card>
              <CardBody>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Compiled from uploaded records</p>
                    <h3 className="mt-1 text-lg font-semibold text-slate-900">
                      {currentPosition}
                    </h3>
                  </div>
                  {evidenceGateStatus && (
                    <Badge color={evidenceGateStatus === "pass" ? "green" : evidenceGateStatus === "needs_review" ? "lime" : "slate"}>
                      {`Evidence gate: ${evidenceGateStatus.replace(/_/g, " ")}`}
                    </Badge>
                  )}
                </div>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">
                  {evidenceSummary}
                </p>

                {(nextBestAction || nearestDeadline) && (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {nextBestAction && (
                      <div className="rounded-xl bg-lime-50 p-3">
                        <p className="text-xs font-bold uppercase tracking-wide text-lime-500">Next best action</p>
                        <p className="mt-1 text-sm font-medium text-lime-900">{nextBestAction.title}</p>
                      </div>
                    )}
                    {nearestDeadline && (
                      <div className="rounded-xl bg-slate-50 p-3">
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Nearest deadline</p>
                        <p className="mt-1 text-sm font-medium text-slate-800">{nearestDeadline.title}</p>
                        <p className="text-xs text-slate-500">{new Date(nearestDeadline.due_date).toLocaleDateString("en-US")}</p>
                      </div>
                    )}
                  </div>
                )}

                {pendingEvidenceActions.length > 0 && (
                  <div className="mt-4 rounded-xl bg-lime-50 p-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-lime-500">Evidence-derived next actions</p>
                    <ul className="mt-2 space-y-1">
                      {pendingEvidenceActions.slice(0, 4).map((action, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-lime-900">
                          <span className="mt-0.5 font-bold text-lime-500">→</span>
                          <span>{action}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {evidenceTimeline.length > 0 && (
                  <div className="mt-4">
                    <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Evidence timeline</p>
                    <ol className="space-y-2">
                      {evidenceTimeline.slice(0, 6).map((event, i) => (
                        <li key={`${event.title}-${i}`} className="flex gap-3 rounded-lg bg-slate-50 px-3 py-2">
                          <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-lime-500" />
                          <div>
                            <p className="text-sm font-medium text-slate-800">{event.title}</p>
                            <p className="text-xs text-slate-500">
                              {[event.dateText, event.eventType?.replace(/_/g, " ")].filter(Boolean).join(" · ") || "Date not extracted"}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                {unknownQuestions.length > 0 && (
                  <div className="mt-4">
                    <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">What the evidence still needs</p>
                    <ul className="space-y-1">
                      {unknownQuestions.map((question, index) => (
                        <li key={`${question}-${index}`} className="flex items-start gap-2 text-sm text-slate-600">
                          <span className="mt-0.5 font-bold text-lime-500">?</span>
                          <span>{question}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardBody>
            </Card>
          </section>
        )}

        {showStaffInternals && latestBatch.length > 0 && (
          <section>
            <h2 className="mb-3 text-base font-semibold text-slate-900">{versionChrome.howAnalyzedHeading}</h2>
            <Card>
              <CardBody>
                <p className="mb-3 text-xs text-slate-500">
                  Last analyzed {c.runs[0].startedAt.toLocaleString("en-US")} · summary, goal, and{" "}
                  {c.documents.length} document{c.documents.length === 1 ? "" : "s"} examined. Every upload is checked against{" "}
                  <span className="font-medium">every</span> finding and re-runs the analysis automatically.
                </p>
                <ol className="space-y-3">
                  {latestBatch.map((run, i) => (
                    <li key={run.id} className="flex gap-3">
                      <span className="mt-1 flex h-2.5 w-2.5 shrink-0 rounded-full bg-lime-500" />
                      <div>
                        <p className="text-sm leading-relaxed text-slate-700">
                          <span className="font-semibold text-slate-900">{i + 1}.</span> {describeRun(run)}
                        </p>
                        {run.consensus?.verificationRequired && (
                          <p className="text-xs font-medium text-lime-600">◐ Some values disagreed — flagged for verification instead of guessing.</p>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
                <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  <span className="font-semibold">Result:</span> {c.issues.length} item{c.issues.length === 1 ? "" : "s"} below — each
                  classified, evidence-rated, and given a next move · {readinessCopy.overallLabel.toLowerCase()} {c.readinessScore}%.
                </p>
              </CardBody>
            </Card>
          </section>
        )}

        <section>
          <h2 className="mb-3 text-base font-semibold text-slate-900">What we found</h2>
          <div className="space-y-4">
            {visibleIssues.length === 0 && (
              <Card><CardBody className="text-sm text-slate-500">The analysis is still in progress or found nothing actionable yet.</CardBody></Card>
            )}
            {visibleIssues.map((issue) => {
              let unclear: string[] = [];
              try {
                const parsed = JSON.parse(issue.unclearJson || "[]");
                if (Array.isArray(parsed)) unclear = parsed.map(String).filter(Boolean);
              } catch { /* legacy issues */ }
              let explanations: { title: string; detail: string; likelihood?: string }[] = [];
              try {
                const parsed = JSON.parse(issue.explanationsJson || "[]");
                if (Array.isArray(parsed)) explanations = parsed.filter((x) => x?.title && x?.detail);
              } catch { /* legacy issues */ }
              let outline: { heading: string; detail: string; source?: string }[] = [];
              try {
                const parsed = JSON.parse(issue.evidenceJson || "[]");
                if (Array.isArray(parsed)) outline = parsed.filter((o) => o?.heading && o?.detail);
              } catch { /* legacy issues */ }

              return (
              <Card key={issue.id}>
                <CardBody>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <ItemKindBadge kind={issue.itemKind} />
                      <h3 className="mt-1.5 text-lg font-semibold text-slate-900">
                        {issue.caseYear ? `${issue.caseYear} · ` : ""}{issue.title}
                      </h3>
                    </div>
                    <div className="flex gap-2">
                      <StateMark state={issue.state} />
                      <EvidenceStatusBadge status={issue.evidenceStatus} />
                    </div>
                  </div>
                  <p className="mt-3 mb-1 text-xs font-bold uppercase tracking-wide text-slate-400">What we found</p>
                  <p className="whitespace-pre-line text-sm leading-relaxed text-slate-600">{issue.description}</p>
                  <div className="mt-2">
                    <EvidenceStrengthLine strength={issue.evidenceStrength} />
                  </div>
                  {issue.uscisBasis && <p className="mt-1 text-xs text-slate-400">USCIS basis: {issue.uscisBasis}</p>}

                  {showStaffInternals && explanations.length > 0 && (
                    <div className="mt-4">
                      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Most likely explanations</p>
                      <ol className="space-y-2">
                        {explanations.map((e, ei) => (
                          <li key={ei} className="rounded-lg bg-slate-50 px-3 py-2.5">
                            <p className="text-sm font-semibold text-slate-800">
                              {ei + 1}. {e.title}
                              <span className="ml-2 rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 ring-1 ring-slate-200">{e.likelihood || "Possible"}</span>
                            </p>
                            <p className="mt-0.5 text-sm leading-relaxed text-slate-600">{e.detail}</p>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}

                  {showStaffInternals && outline.length > 0 && (
                    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                      <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-400">Why ImmigrationOnMe says this</p>
                      <ol className="space-y-3">
                        {outline.map((o, oi) => (
                          <li key={oi} className="grid gap-1 sm:grid-cols-[180px_1fr] sm:gap-4">
                            <p className="text-sm font-semibold text-slate-800">
                              <span className="mr-1.5 font-mono text-xs text-lime-500">{String(oi + 1).padStart(2, "0")}</span>
                              {o.heading}
                            </p>
                            <div>
                              <p className="text-sm leading-relaxed text-slate-600">{o.detail}</p>
                              {o.source && <p className="mt-1 text-xs text-slate-400">Source: {o.source}</p>}
                            </div>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}

                  {unclear.length > 0 && issue.state !== "resolved" && (
                    <div className="mt-4">
                      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">What&apos;s still unclear</p>
                      <ul className="space-y-1">
                        {unclear.map((u, ui) => (
                          <li key={ui} className="flex items-start gap-2 text-sm text-slate-600">
                            <span className="mt-0.5 font-bold text-lime-500">?</span>
                            <span>{u}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {issue.nextAction && issue.state !== "resolved" && (
                    <div className="mt-4 rounded-lg bg-lime-50 px-3 py-2.5">
                      <p className="text-xs font-bold uppercase tracking-wide text-lime-400">What you can do next</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-3">
                        <p className="text-sm font-medium text-lime-800">
                          {issue.nextAction.replace(/_/g, " ").toLowerCase().replace(/^./, (ch) => ch.toUpperCase())}
                        </p>
                        {interactive && ["missing_info"].includes(issue.itemKind) && (
                          <a href="#clarify" className="rounded-lg bg-lime-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-lime-700">
                            Answer a few questions →
                          </a>
                        )}
                        {interactive && (
                          issue.nextAction.toUpperCase() === "UPLOAD_DOCUMENTS" ? (
                            <InlineUpload caseId={c.id} docKind={matchingDocumentKind} label="Upload for this item" />
                          ) : (
                            <>
                              {stepCta(issue.nextAction) && (
                                <a href={stepCta(issue.nextAction)!.href} className="rounded-lg bg-lime-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-lime-700">
                                  {stepCta(issue.nextAction)!.label} →
                                </a>
                              )}
                              {["GET_CASE_RECORD", "GET_ACCOUNT_RECORD"].includes(issue.nextAction.toUpperCase()) && (
                                <>
                                  {showUscisAccountGuide && (
                                    <a href="/app/uscis-account" className="rounded-lg border border-lime-200 bg-white px-3 py-1.5 text-xs font-medium text-lime-700 hover:bg-lime-50">
                                      Open USCIS account guide →
                                    </a>
                                  )}
                                  <InlineUpload caseId={c.id} docKind={showUscisAccountGuide ? "case_record" : matchingDocumentKind} label={showUscisAccountGuide ? "Have it? Upload case record" : "Upload matching documents"} />
                                </>
                              )}
                            </>
                          )
                        )}
                      </div>
                      {issue.altAction && (
                        <p className="mt-1.5 text-xs text-lime-700">
                          <span className="font-semibold">Alternative:</span> {issue.altAction}
                          {interactive && /professional/i.test(issue.altAction) && (
                            <>
                              {" "}<Link href="/app/consultants" className="font-semibold underline">My consultant →</Link>
                            </>
                          )}
                        </p>
                      )}
                    </div>
                  )}
                </CardBody>
              </Card>
              );
            })}
            {interactive && !fullAccess && c.issues.length > 1 && (
              <div className="rounded-2xl border border-lime-200 bg-lime-50 p-6 text-center">
                <p className="font-semibold text-lime-900">
                  {c.issues.length - 1} more finding{c.issues.length - 1 === 1 ? "" : "s"} in your full analysis
                </p>
                <p className="mt-1 text-sm text-lime-700">Upgrade your plan to unlock every finding, evidence detail, and step.</p>
                <div className="mt-4">
                  <Link href="/app/billing" className="inline-block rounded-lg bg-lime-600 px-4 py-2 text-sm font-semibold text-white hover:bg-lime-700">See plans →</Link>
                </div>
              </div>
            )}
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">Path forward</h2>
            {interactive && (
              <form action={checkCaseProgressAction.bind(null, c.id)}>
                <button className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
                  ↻ Check my progress
                </button>
              </form>
            )}
          </div>
          <Card>
            <CardBody className="space-y-1">
              {c.pathSteps.map((step, i) => {
                const verifiable = isVerifiable(step.actionKey);
                const isCurrent = nextBestAction?.action_key
                  ? step.actionKey.toUpperCase() === nextBestAction.action_key.toUpperCase() && step.status !== "done"
                  : step.status === "current";
                return (
                  <div key={step.id} className={`flex items-start gap-3 rounded-xl p-3 ${isCurrent ? "bg-lime-50" : ""}`}>
                    <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                      step.status === "done" ? "bg-emerald-100 text-emerald-700" : isCurrent ? "bg-lime-600 text-white" : "bg-slate-100 text-slate-400"
                    }`}>
                      {step.status === "done" ? "✓" : i + 1}
                    </span>
                    <div className="flex-1">
                      <p className={`font-medium ${step.status === "done" ? "text-slate-400 line-through" : "text-slate-900"}`}>{step.title}</p>
                      <p className="text-sm text-slate-500">{step.description}</p>
                      {verifiable && step.status !== "done" && (
                        <p className="mt-1 text-xs font-medium text-lime-600">
                          ◐ Verified automatically — {verifiableActionCopy(step.actionKey, versionMatch).toLowerCase()}
                        </p>
                      )}
                      {verifiable && step.status === "done" && (
                        <p className="mt-1 text-xs font-medium text-emerald-600">✓ {versionChrome.verifiedDone}</p>
                      )}
                      {interactive && step.status !== "done" && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {["COMPLETE_FORM_I485", "PREPARE_FORM"].includes(step.actionKey.toUpperCase()) && matchingForm && canStartForm ? (
                            <form action={startFormAction.bind(null, matchingForm.id)}>
                              <button className="rounded-lg bg-lime-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-lime-700">
                                {formStartLabel(matchingForm.formNumber)} →
                              </button>
                            </form>
                          ) : ["COMPLETE_FORM_I485", "PREPARE_FORM"].includes(step.actionKey.toUpperCase()) && stepCta(step.actionKey, step.title) ? (
                            <a href={stepCta(step.actionKey, step.title)!.href} className="rounded-lg bg-lime-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-lime-700">
                              {stepCta(step.actionKey, step.title)!.label} →
                            </a>
                          ) : step.actionKey.toUpperCase() === "UPLOAD_DOCUMENTS" ? (
                            <InlineUpload caseId={c.id} docKind={matchingDocumentKind} label="Upload documents" />
                          ) : stepCta(step.actionKey, step.title) ? (
                            <a href={stepCta(step.actionKey, step.title)!.href} className="rounded-lg bg-lime-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-lime-700">
                              {stepCta(step.actionKey, step.title)!.label} →
                            </a>
                          ) : null}
                          {["GET_CASE_RECORD", "GET_ACCOUNT_RECORD"].includes(step.actionKey.toUpperCase()) && showUscisAccountGuide && (
                            <a href="/app/uscis-account" className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
                              Open USCIS account guide →
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                    {interactive && !verifiable && isCurrent && (
                      <form action={completePathStepAction.bind(null, step.id)}>
                        <button className="rounded-lg bg-lime-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-lime-700">
                          I&apos;ve done this ✓
                        </button>
                      </form>
                    )}
                  </div>
                );
              })}
              {c.pathSteps.length === 0 && <p className="p-3 text-sm text-slate-500">Steps appear after analysis completes.</p>}
            </CardBody>
          </Card>
        </section>
      </div>

      <div className="space-y-6">
        {showStaffInternals && (
          <Card>
            <CardBody>
              <ProgressBar value={c.readinessScore} label={readinessCopy.overallLabel} />
              <p className="mt-2 text-xs text-slate-500">
                {readinessCopy.overallHint}
              </p>
              {(c.evidenceAvailableScore > 0 || c.evidenceProcessedScore > 0 || c.actionReadinessScore > 0) && (
                <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
                  <ProgressBar value={c.evidenceAvailableScore} label={readinessCopy.availableLabel} />
                  <ProgressBar value={c.evidenceProcessedScore} label={readinessCopy.processedLabel} />
                  <ProgressBar value={c.actionReadinessScore} label={readinessCopy.actionLabel} />
                  <p className="text-[11px] leading-relaxed text-slate-500">
                    {readinessCopy.splitHint}
                  </p>
                </div>
              )}
            </CardBody>
          </Card>
        )}

        <Card>
          <CardBody>
            <h3 className="text-sm font-semibold text-slate-900">Goal</h3>
            <p className="mt-1 text-sm text-slate-600">{c.goal || "No goal recorded."}</p>
          </CardBody>
        </Card>

        {neededDocs.length > 0 && (
          <Card>
            <CardBody>
              <h3 className="mb-2 text-sm font-semibold text-slate-900">Documents we still need</h3>
              <ul className="space-y-2.5">
                {neededDocs.map((d) => {
                  const have = haveKinds.has(d.kind);
                  return (
                    <li key={d.kind} className="flex items-start gap-2.5">
                      <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${have ? "bg-emerald-100 text-emerald-700" : "border-2 border-dashed border-slate-300 text-transparent"}`}>
                        ✓
                      </span>
                      <div>
                        <p className={`text-sm font-medium ${have ? "text-slate-400 line-through" : "text-slate-800"}`}>{d.label}</p>
                        {!have && <p className="text-xs text-slate-500">{d.hint}</p>}
                      </div>
                    </li>
                  );
                })}
              </ul>
              {interactive && neededDocs.some((d) => !haveKinds.has(d.kind)) && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <InlineUpload caseId={c.id} docKind={matchingDocumentKind} label="Upload now" />
                  {neededDocs.some((d) => d.kind === "case_record" && !haveKinds.has("case_record")) && (
                    <a href="/app/uscis-account" className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
                      Case record guide →
                    </a>
                  )}
                </div>
              )}
              <p className="mt-2 text-[10px] text-slate-400">Every document added is checked against all findings automatically.</p>
            </CardBody>
          </Card>
        )}

        <Card id="case-documents">
          <CardBody>
            <h3 className="mb-2 text-sm font-semibold text-slate-900">Evidence ({c.documents.length} document{c.documents.length === 1 ? "" : "s"})</h3>
            <ul className="space-y-2">
              {c.documents.map((d) => {
                const verified =
                  d.mimeType.startsWith("text/") ||
                  /\.(txt|csv|md|log)$/i.test(d.fileName) ||
                  d.extractedJson.length > 0;
                return (
                  <li key={d.id} className="flex items-start gap-2">
                    <span className={`mt-0.5 text-sm font-bold ${verified ? "text-emerald-600" : "text-lime-500"}`}>
                      {verified ? "✓" : "⚠"}
                    </span>
                    <div className="min-w-0">
                      <a href={`/api/files/${d.id}`} target="_blank" className="break-words text-sm text-lime-600 underline">
                        {d.fileName}
                      </a>{" "}
                      <Badge>{d.docKind}</Badge>
                      {d.documentType && <Badge color="lime">{immigrationDocumentTypeLabel(d.documentType)}</Badge>}
                      {d.processingStatus && d.processingStatus !== "uploaded" && (
                        <Badge color={d.processingStatus === "extracted" ? "green" : d.processingStatus === "failed" ? "red" : "slate"}>
                          {d.processingStatus.replace(/_/g, " ")}
                        </Badge>
                      )}
                      {!verified && <p className="text-[11px] text-lime-600">Verification needed — on file, details not yet confirmed</p>}
                    </div>
                  </li>
                );
              })}
              {c.documents.length === 0 && <li className="text-sm text-slate-400">None yet.</li>}
            </ul>
            {interactive && (
              <div className="mt-3">
                <CaseUpload caseId={c.id} kinds={documentKinds} defaultKind={matchingDocumentKind} />
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
    {matchingMaterials}
    </div>
  );
}
