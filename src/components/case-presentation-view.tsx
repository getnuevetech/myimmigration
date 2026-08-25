import Link from "next/link";
import { Card, CardBody, StateMark, ProgressBar, Badge, EvidenceStatusBadge, EvidenceStrengthLine, ItemKindBadge } from "@/components/ui";
import { isVerifiable, VERIFIABLE_ACTIONS } from "@/lib/case-progress";
import { completePathStepAction, checkCaseProgressAction } from "@/actions/case";
import { startFormAction } from "@/actions/forms";
import { InlineUpload } from "@/components/inline-upload";
import { CaseUpload } from "@/components/case-upload";
import type { PresentationContract } from "@/lib/case-presentation-contract";
import { formatPresentationDate, presentationActionStatus, presentationEvidenceGateLabel, presentationStepCta } from "@/lib/case-presentation-ui";
import { limitSuggestionItems, suggestionConsultantCopy, type SuggestionChatAccess } from "@/lib/suggestion-access";
import { formCatalogHref, formNumberForStep, formStartLabel } from "@/lib/goal-forms";
import { letterCatalogHref, letterComposerHref, letterKindDef, letterKindForStep, letterStartLabel } from "@/lib/goal-letters";
import { documentCatalogHref, documentKindDef, documentStartLabel } from "@/lib/goal-documents";

type CaseViewer = { role: "customer" | "consultant" | "admin"; userId: string; fullResults?: boolean };

type IssueRow = {
  id: string;
  title: string;
  description: string;
  caseYear: number | null;
  itemKind: string;
  state: string;
  evidenceStatus: string;
  evidenceStrength: string;
  conclusion: string;
  nextAction: string;
  altAction: string;
  uscisBasis: string;
  unclearJson: string;
  explanationsJson: string;
  evidenceJson: string;
};

type PathStepRow = {
  id: string;
  title: string;
  description: string;
  actionKey: string;
  status: string;
};

type DocumentRow = {
  id: string;
  fileName: string;
  mimeType: string;
  extractedJson: string;
  docKind: string;
  documentType: string | null;
  processingStatus: string;
};

export function CasePresentationView({
  caseId,
  viewer,
  interactive,
  fullAccess,
  presentation,
  goal,
  readinessScore,
  evidenceAvailableScore,
  evidenceProcessedScore,
  actionReadinessScore,
  issues,
  pathSteps,
  documents,
  neededDocs,
  matchingFormId,
  matchingFormNumber,
  canStartForm,
  matchingLetterKind,
  canGenerateLetter,
  matchingDocumentKind,
  documentKinds,
  suggestionAccess,
}: {
  caseId: string;
  viewer: CaseViewer;
  interactive: boolean;
  fullAccess: boolean;
  presentation: PresentationContract;
  goal: string;
  readinessScore: number;
  evidenceAvailableScore: number;
  evidenceProcessedScore: number;
  actionReadinessScore: number;
  issues: IssueRow[];
  pathSteps: PathStepRow[];
  documents: DocumentRow[];
  neededDocs: { kind: string; label: string; hint: string }[];
  matchingFormId: string | null;
  matchingFormNumber: string | null;
  canStartForm: boolean;
  matchingLetterKind: string | null;
  canGenerateLetter: boolean;
  matchingDocumentKind: string | null;
  documentKinds: { kind: string; name: string }[];
  suggestionAccess?: SuggestionChatAccess;
}) {
  const issueById = new Map(issues.map((issue) => [issue.id, issue]));
  const stepByAction = new Map(pathSteps.map((step) => [step.actionKey.toUpperCase(), step]));
  const visibleFindings = fullAccess ? presentation.findings : presentation.findings.slice(0, 1);
  const haveKinds = new Set(documents.map((doc) => doc.docKind));
  const gateLabel = presentationEvidenceGateLabel(presentation.what_this_means.evidence_gate_status);
  const formFor = (actionKey: string, title?: string | null) =>
    formNumberForStep({ actionKey, title, matchingForm: matchingFormNumber });
  const letterFor = (actionKey: string, title?: string | null) =>
    letterKindForStep({ actionKey, title, matchingLetter: matchingLetterKind });
  const stepCta = (actionKey: string, title?: string | null) =>
    presentationStepCta(actionKey, caseId, formFor(actionKey, title), letterFor(actionKey, title));
  const isFormAction = (actionKey: string) => {
    const key = actionKey.toUpperCase();
    return key === "COMPLETE_FORM_I485" || key === "PREPARE_FORM";
  };
  const nextActionCta = presentation.hero.next_best_action
    ? stepCta(presentation.hero.next_best_action.action_key, presentation.hero.next_best_action.title)
    : null;
  const actions = presentation.actions.length > 0
    ? presentation.actions
    : pathSteps.map((step, index) => ({
        id: step.id,
        title: step.title,
        action_key: step.actionKey,
        status: step.status === "done" ? "COMPLETED" : step.status === "current" ? "READY" : "BLOCKED",
        priority: index + 1,
      }));
  const visibleActions = limitSuggestionItems(actions, suggestionAccess?.maxPathSteps ?? null);
  const pendingActions = limitSuggestionItems(
    presentation.what_this_means.pending_actions,
    suggestionAccess?.maxPathSteps ?? null,
  );
  const consultantCopy = suggestionAccess
    ? suggestionConsultantCopy(
        {
          audience: suggestionAccess.audience,
          maxPathSteps: suggestionAccess.maxPathSteps,
          maxClarifyAnswers: suggestionAccess.limit,
          personalized: suggestionAccess.personalized,
          consultantReferral: suggestionAccess.consultantReferral,
          showRegisterCta: suggestionAccess.showRegisterCta,
          showUpgradeCta: suggestionAccess.showUpgradeCta,
          showConsultantCta: suggestionAccess.showConsultantCta,
        },
        suggestionAccess.consultantName ? { name: suggestionAccess.consultantName, credentialLabel: "" } : null,
        presentation.hero.professional_review_recommended,
      )
    : "";

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-lime-200 bg-gradient-to-br from-lime-50 to-white p-6 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wider text-lime-700">Where you stand</p>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <h2 className="max-w-3xl text-2xl font-bold tracking-tight text-slate-900">{presentation.hero.current_posture}</h2>
          <div className="flex flex-wrap gap-2">
            <Badge color={presentation.hero.evidence_strength === "Strong" ? "green" : presentation.hero.evidence_strength === "Moderate" ? "lime" : "slate"}>
              {`Evidence ${presentation.hero.evidence_strength.toLowerCase()}`}
            </Badge>
            {gateLabel && (
              <Badge color={presentation.what_this_means.evidence_gate_status === "pass" ? "green" : "lime"}>
                {gateLabel}
              </Badge>
            )}
          </div>
        </div>
        {presentation.hero.professional_review_recommended && !consultantCopy && (
          <p className="mt-3 rounded-xl border border-lime-300 bg-white px-4 py-3 text-sm text-lime-900">
            <span className="font-semibold">Professional review recommended.</span> A licensed professional should look at this case
            {interactive && (
              <>
                {" "}
                <Link href="/app/consultants" className="font-semibold underline">Find a consultant →</Link>
              </>
            )}
          </p>
        )}
        {consultantCopy && (
          <div className="mt-3 rounded-xl border border-lime-300 bg-white px-4 py-3 text-sm text-lime-900">
            <p>{consultantCopy}</p>
            {interactive && suggestionAccess && (
              <div className="mt-2 flex flex-wrap gap-2">
                {suggestionAccess.showRegisterCta && (
                  <Link href="/register" className="rounded-lg bg-lime-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-lime-700">
                    Create a free account
                  </Link>
                )}
                {suggestionAccess.showUpgradeCta && (
                  <Link href="/pricing" className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-lime-800 ring-1 ring-lime-300 hover:bg-lime-100">
                    See paid plans
                  </Link>
                )}
                {suggestionAccess.showConsultantCta && (
                  <Link
                    href={suggestionAccess.audience === "pro" ? `/app/consultants?case=${caseId}` : suggestionAccess.audience === "guest" ? "/register" : "/pricing"}
                    className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50"
                  >
                    {suggestionAccess.audience === "pro" ? "Request a professional match" : "Talk with a licensed professional"}
                  </Link>
                )}
              </div>
            )}
          </div>
        )}
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-lime-200 bg-white p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-lime-600">Next best action</p>
            <p className="mt-1 text-base font-semibold text-slate-900">{presentation.hero.next_best_action?.title || "No action is ready yet"}</p>
            {interactive && nextActionCta && (
              <a href={nextActionCta.href} className="mt-3 inline-flex rounded-lg bg-lime-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-lime-700">
                {nextActionCta.label} →
              </a>
            )}
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Nearest deadline</p>
            {presentation.hero.nearest_deadline ? (
              <>
                <p className="mt-1 text-base font-semibold text-slate-900">{presentation.hero.nearest_deadline.title}</p>
                <p className="mt-1 text-sm text-slate-500">{formatPresentationDate(presentation.hero.nearest_deadline.due_date)}</p>
              </>
            ) : (
              <p className="mt-1 text-sm text-slate-500">No open deadline is on file.</p>
            )}
          </div>
        </div>
        {matchingFormNumber && interactive && (
          <div className="mt-3 rounded-xl border border-lime-200 bg-white px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-wide text-lime-600">Matching USCIS form</p>
            <p className="mt-1 text-sm text-slate-700">
              Official material for this case points to Form {matchingFormNumber} first
              {matchingFormNumber !== "I-485" ? ", not Form I-485." : "."}
            </p>
            {canStartForm && matchingFormId ? (
              <form action={startFormAction.bind(null, matchingFormId)} className="mt-3">
                <button className="rounded-lg bg-lime-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-lime-700">
                  {formStartLabel(matchingFormNumber)} →
                </button>
              </form>
            ) : (
              <a
                href={formCatalogHref(matchingFormNumber)}
                className="mt-3 inline-flex rounded-lg bg-lime-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-lime-700"
              >
                {canStartForm ? `${formStartLabel(matchingFormNumber)} →` : `See matching Form ${matchingFormNumber} →`}
              </a>
            )}
          </div>
        )}
        {matchingLetterKind && interactive && (
          <div className="mt-3 rounded-xl border border-lime-200 bg-white px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-wide text-lime-600">Matching USCIS letter</p>
            <p className="mt-1 text-sm text-slate-700">
              Official material for this case points to {letterKindDef(matchingLetterKind)?.title ?? "a matching letter"} first
              {matchingLetterKind !== "rfe_response" ? ", not an RFE response." : "."}
            </p>
            <a
              href={canGenerateLetter ? letterComposerHref({ caseId, kind: matchingLetterKind }) : letterCatalogHref(matchingLetterKind)}
              className="mt-3 inline-flex rounded-lg bg-lime-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-lime-700"
            >
              {canGenerateLetter ? `${letterStartLabel(matchingLetterKind)} →` : `See matching ${letterKindDef(matchingLetterKind)?.title ?? "letter"} →`}
            </a>
          </div>
        )}
        {matchingDocumentKind && interactive && (
          <div className="mt-3 rounded-xl border border-lime-200 bg-white px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-wide text-lime-600">Matching evidence</p>
            <p className="mt-1 text-sm text-slate-700">
              Official material for this case points to {documentKindDef(matchingDocumentKind)?.name ?? "matching documents"} first
              {documentKindDef(matchingDocumentKind)?.isFiledCase ? "." : ", not a USCIS receipt."}
            </p>
            <a
              href={documentCatalogHref(matchingDocumentKind)}
              className="mt-3 inline-flex rounded-lg bg-lime-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-lime-700"
            >
              {documentStartLabel(matchingDocumentKind)} →
            </a>
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section>
            <h2 className="mb-3 text-base font-semibold text-slate-900">What this means</h2>
            <Card>
              <CardBody>
                <p className="text-sm leading-relaxed text-slate-700">{presentation.what_this_means.summary}</p>
                <p className="mt-3 text-sm text-slate-500">
                  {presentation.what_this_means.unresolved_count} open item{presentation.what_this_means.unresolved_count === 1 ? "" : "s"} still need attention.
                </p>
                {presentation.what_this_means.conflicts.map((conflict, index) => (
                  <div key={`${conflict.topic}-${index}`} className="mt-3 rounded-xl border border-lime-300 bg-lime-50 px-4 py-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-lime-700">Information conflict — {conflict.topic}</p>
                    <p className="mt-1 text-sm text-lime-900">{conflict.description}</p>
                    {conflict.resolution && <p className="mt-1 text-xs text-lime-700">{conflict.resolution}</p>}
                  </div>
                ))}
                {pendingActions.visible.length > 0 && (
                  <div className="mt-4">
                    <p className="mb-2 text-xs font-bold uppercase tracking-wide text-lime-600">What to do from the records</p>
                    <ul className="space-y-1">
                      {pendingActions.visible.map((action, index) => (
                        <li key={`${action}-${index}`} className="flex items-start gap-2 text-sm text-slate-700">
                          <span className="mt-0.5 font-bold text-lime-500">→</span>
                          <span>{action}</span>
                        </li>
                      ))}
                    </ul>
                    {pendingActions.hidden > 0 && interactive && suggestionAccess?.showUpgradeCta && (
                      <p className="mt-2 text-xs text-lime-700">
                        {pendingActions.hidden} more official next step{pendingActions.hidden === 1 ? "" : "s"} stay on Plus.
                      </p>
                    )}
                  </div>
                )}
                {presentation.what_this_means.unknowns.length > 0 && (
                  <div className="mt-4">
                    <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Still needs</p>
                    <ul className="space-y-1">
                      {presentation.what_this_means.unknowns.map((question, index) => (
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

          {presentation.timeline.length > 0 && (
            <section>
              <h2 className="mb-3 text-base font-semibold text-slate-900">Timeline</h2>
              <Card>
                <CardBody>
                  <ol className="space-y-2">
                    {presentation.timeline.slice(0, 8).map((event, index) => (
                      <li key={`${event.title}-${index}`} className="flex gap-3 rounded-lg bg-slate-50 px-3 py-2">
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
                </CardBody>
              </Card>
            </section>
          )}

          <section>
            <h2 className="mb-3 text-base font-semibold text-slate-900">Findings</h2>
            <div className="space-y-4">
              {visibleFindings.length === 0 && (
                <Card><CardBody className="text-sm text-slate-500">The analysis is still in progress or found nothing actionable yet.</CardBody></Card>
              )}
              {visibleFindings.map((finding) => {
                const issue = issueById.get(finding.id);
                let unclear: string[] = [];
                let explanations: { title: string; detail: string; likelihood?: string }[] = [];
                let outline: { heading: string; detail: string; source?: string }[] = [];
                try {
                  const parsed = JSON.parse(issue?.unclearJson || "[]");
                  if (Array.isArray(parsed)) unclear = parsed.map(String).filter(Boolean);
                } catch { /* legacy issues */ }
                try {
                  const parsed = JSON.parse(issue?.explanationsJson || "[]");
                  if (Array.isArray(parsed)) explanations = parsed.filter((item) => item?.title && item?.detail);
                } catch { /* legacy issues */ }
                try {
                  const parsed = JSON.parse(issue?.evidenceJson || "[]");
                  if (Array.isArray(parsed)) outline = parsed.filter((item) => item?.heading && item?.detail);
                } catch { /* legacy issues */ }
                const nextAction = finding.next_action || issue?.nextAction || "";
                const cta = nextAction ? stepCta(nextAction, finding.title) : null;
                return (
                  <Card key={finding.id}>
                    <CardBody>
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <ItemKindBadge kind={finding.group || issue?.itemKind || "issue"} />
                          <h3 className="mt-1.5 text-lg font-semibold text-slate-900">
                            {issue?.caseYear ? `${issue.caseYear} · ` : ""}{finding.title}
                          </h3>
                        </div>
                        <div className="flex gap-2">
                          <StateMark state={finding.state} />
                          <EvidenceStatusBadge status={finding.evidence_status} />
                        </div>
                      </div>
                      {(issue?.description || finding.conclusion) && (
                        <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-600">
                          {issue?.description || finding.conclusion}
                        </p>
                      )}
                      <div className="mt-2">
                        <EvidenceStrengthLine strength={finding.evidence_strength} />
                      </div>
                      {issue?.uscisBasis && <p className="mt-1 text-xs text-slate-400">USCIS basis: {issue.uscisBasis}</p>}
                      {explanations.length > 0 && (
                        <div className="mt-4">
                          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Most likely explanations</p>
                          <ol className="space-y-2">
                            {explanations.map((explanation, index) => (
                              <li key={index} className="rounded-lg bg-slate-50 px-3 py-2.5">
                                <p className="text-sm font-semibold text-slate-800">
                                  {index + 1}. {explanation.title}
                                  <span className="ml-2 rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 ring-1 ring-slate-200">{explanation.likelihood || "Possible"}</span>
                                </p>
                                <p className="mt-0.5 text-sm leading-relaxed text-slate-600">{explanation.detail}</p>
                              </li>
                            ))}
                          </ol>
                        </div>
                      )}
                      {outline.length > 0 && (
                        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                          <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-400">Why ImmigrationOnMe says this</p>
                          <ol className="space-y-3">
                            {outline.map((item, index) => (
                              <li key={index} className="grid gap-1 sm:grid-cols-[180px_1fr] sm:gap-4">
                                <p className="text-sm font-semibold text-slate-800">
                                  <span className="mr-1.5 font-mono text-xs text-lime-500">{String(index + 1).padStart(2, "0")}</span>
                                  {item.heading}
                                </p>
                                <div>
                                  <p className="text-sm leading-relaxed text-slate-600">{item.detail}</p>
                                  {item.source && <p className="mt-1 text-xs text-slate-400">Source: {item.source}</p>}
                                </div>
                              </li>
                            ))}
                          </ol>
                        </div>
                      )}
                      {unclear.length > 0 && finding.state !== "resolved" && (
                        <div className="mt-4">
                          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">What&apos;s still unclear</p>
                          <ul className="space-y-1">
                            {unclear.map((item, index) => (
                              <li key={index} className="flex items-start gap-2 text-sm text-slate-600">
                                <span className="mt-0.5 font-bold text-lime-500">?</span>
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {nextAction && finding.state !== "resolved" && (
                        <div className="mt-4 rounded-lg bg-lime-50 px-3 py-2.5">
                          <p className="text-xs font-bold uppercase tracking-wide text-lime-400">What you can do next</p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-3">
                            <p className="text-sm font-medium text-lime-800">
                              {nextAction.replace(/_/g, " ").toLowerCase().replace(/^./, (ch) => ch.toUpperCase())}
                            </p>
                            {interactive && finding.group === "missing_info" && (
                              <a href="#clarify" className="rounded-lg bg-lime-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-lime-700">
                                Answer a few questions →
                              </a>
                            )}
                            {interactive && nextAction.toUpperCase() === "UPLOAD_DOCUMENTS" && (
                              <InlineUpload caseId={caseId} docKind={matchingDocumentKind || "identity"} label="Upload for this item" />
                            )}
                            {interactive && nextAction.toUpperCase() !== "UPLOAD_DOCUMENTS" && cta && (
                              <a href={cta.href} className="rounded-lg bg-lime-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-lime-700">
                                {cta.label} →
                              </a>
                            )}
                          </div>
                          {issue?.altAction && (
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
              {interactive && !fullAccess && presentation.findings.length > 1 && (
                <div className="rounded-2xl border border-lime-200 bg-lime-50 p-6 text-center">
                  <p className="font-semibold text-lime-900">
                    {presentation.findings.length - 1} more finding{presentation.findings.length - 1 === 1 ? "" : "s"} in your full analysis
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
              <h2 className="text-base font-semibold text-slate-900">Your next steps</h2>
              {interactive && (
                <form action={checkCaseProgressAction.bind(null, caseId)}>
                  <button className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
                    ↻ Check my progress
                  </button>
                </form>
              )}
            </div>
            <Card>
              <CardBody className="space-y-1">
                {visibleActions.visible.map((action, index) => {
                  const status = presentationActionStatus(action.status);
                  const step = stepByAction.get(action.action_key.toUpperCase());
                  const verifiable = isVerifiable(action.action_key);
                  const isCurrent = status.tone === "ready";
                  const cta = stepCta(action.action_key, action.title);
                  return (
                    <div key={action.id} className={`flex items-start gap-3 rounded-xl p-3 ${isCurrent ? "bg-lime-50" : ""}`}>
                      <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                        status.tone === "done" ? "bg-emerald-100 text-emerald-700" : isCurrent ? "bg-lime-600 text-white" : "bg-slate-100 text-slate-400"
                      }`}>
                        {status.tone === "done" ? "✓" : index + 1}
                      </span>
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className={`font-medium ${status.tone === "done" || status.tone === "muted" ? "text-slate-400 line-through" : "text-slate-900"}`}>{action.title}</p>
                          <Badge color={status.tone === "done" ? "green" : status.tone === "ready" ? "lime" : "slate"}>{status.label}</Badge>
                        </div>
                        {step?.description && <p className="text-sm text-slate-500">{step.description}</p>}
                        {verifiable && status.tone !== "done" && (
                          <p className="mt-1 text-xs font-medium text-lime-600">
                            ◐ Verified automatically — {VERIFIABLE_ACTIONS[action.action_key.toUpperCase()].toLowerCase()}
                          </p>
                        )}
                        {verifiable && status.tone === "done" && (
                          <p className="mt-1 text-xs font-medium text-emerald-600">✓ Verified from case evidence</p>
                        )}
                        {interactive && status.tone !== "done" && status.tone !== "muted" && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {isFormAction(action.action_key) && matchingFormId && canStartForm ? (
                              <form action={startFormAction.bind(null, matchingFormId)}>
                                <button className="rounded-lg bg-lime-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-lime-700">
                                  {cta?.label ?? "Start the matching form"} →
                                </button>
                              </form>
                            ) : isFormAction(action.action_key) && cta ? (
                              <a href={cta.href} className="rounded-lg bg-lime-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-lime-700">
                                {cta.label} →
                              </a>
                            ) : action.action_key.toUpperCase() === "UPLOAD_DOCUMENTS" ? (
                              <InlineUpload caseId={caseId} docKind={matchingDocumentKind || "identity"} label="Upload documents" />
                            ) : cta ? (
                              <a href={cta.href} className="rounded-lg bg-lime-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-lime-700">
                                {cta.label} →
                              </a>
                            ) : null}
                          </div>
                        )}
                      </div>
                      {interactive && step && !verifiable && isCurrent && (
                        <form action={completePathStepAction.bind(null, step.id)}>
                          <button className="rounded-lg bg-lime-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-lime-700">
                            I&apos;ve done this ✓
                          </button>
                        </form>
                      )}
                    </div>
                  );
                })}
                {visibleActions.hidden > 0 && interactive && (
                  <div className="mt-3 rounded-xl border border-lime-200 bg-lime-50 px-4 py-3 text-center">
                    <p className="text-sm font-semibold text-lime-900">
                      {visibleActions.hidden} more official next step{visibleActions.hidden === 1 ? "" : "s"} on Plus
                    </p>
                    <p className="mt-1 text-xs text-lime-700">
                      Free keeps the next best action. Plus personalizes the full path from matching USCIS/DOJ material. Pro can match you with a licensed professional.
                    </p>
                    {suggestionAccess?.showUpgradeCta && (
                      <Link href="/pricing" className="mt-2 inline-block rounded-lg bg-lime-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-lime-700">
                        See paid plans
                      </Link>
                    )}
                  </div>
                )}
                {visibleActions.visible.length === 0 && <p className="p-3 text-sm text-slate-500">Steps appear after analysis completes.</p>}
              </CardBody>
            </Card>
          </section>
        </div>

        <div className="space-y-6">
          <Card>
            <CardBody>
              <ProgressBar value={readinessScore} label="Case readiness" />
              <p className="mt-2 text-xs text-slate-500">
                Computed from documents obtained, facts verified, USCIS source confirmation, and unresolved contradictions.
              </p>
              {(evidenceAvailableScore > 0 || evidenceProcessedScore > 0 || actionReadinessScore > 0) && (
                <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
                  <ProgressBar value={evidenceAvailableScore} label="Evidence provided" />
                  <ProgressBar value={evidenceProcessedScore} label="Evidence processed" />
                  <ProgressBar value={actionReadinessScore} label="Action readiness" />
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <h3 className="text-sm font-semibold text-slate-900">Goal</h3>
              <p className="mt-1 text-sm text-slate-600">{goal || "No goal recorded."}</p>
            </CardBody>
          </Card>

          {neededDocs.length > 0 && (
            <Card>
              <CardBody>
                <h3 className="mb-2 text-sm font-semibold text-slate-900">Documents we still need</h3>
                <ul className="space-y-2.5">
                  {neededDocs.map((doc) => {
                    const have = haveKinds.has(doc.kind);
                    return (
                      <li key={doc.kind} className="flex items-start gap-2.5">
                        <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${have ? "bg-emerald-100 text-emerald-700" : "border-2 border-dashed border-slate-300 text-transparent"}`}>
                          ✓
                        </span>
                        <div>
                          <p className={`text-sm font-medium ${have ? "text-slate-400 line-through" : "text-slate-800"}`}>{doc.label}</p>
                          {!have && <p className="text-xs text-slate-500">{doc.hint}</p>}
                        </div>
                      </li>
                    );
                  })}
                </ul>
                {interactive && neededDocs.some((doc) => !haveKinds.has(doc.kind)) && (
                  <div className="mt-3">
                    <InlineUpload caseId={caseId} docKind={matchingDocumentKind || neededDocs.find((doc) => !haveKinds.has(doc.kind))?.kind || "identity"} label="Upload now" />
                  </div>
                )}
              </CardBody>
            </Card>
          )}

          <Card id="case-documents">
            <CardBody>
              <h3 className="mb-2 text-sm font-semibold text-slate-900">Evidence ({documents.length} document{documents.length === 1 ? "" : "s"})</h3>
              <ul className="space-y-2">
                {(presentation.evidence.length > 0 ? presentation.evidence : documents.map((doc) => ({
                  id: doc.id,
                  file_name: doc.fileName,
                  document_type: doc.documentType || doc.docKind,
                  processing_status: doc.processingStatus,
                }))).map((doc) => {
                  const live = documents.find((item) => item.id === doc.id);
                  const verified = live
                    ? live.mimeType.startsWith("text/") || /\.(txt|csv|md|log)$/i.test(live.fileName) || live.extractedJson.length > 0
                    : doc.processing_status === "extracted";
                  return (
                    <li key={doc.id} className="flex items-start gap-2">
                      <span className={`mt-0.5 text-sm font-bold ${verified ? "text-emerald-600" : "text-lime-500"}`}>
                        {verified ? "✓" : "⚠"}
                      </span>
                      <div className="min-w-0">
                        <a href={`/api/files/${doc.id}`} target="_blank" className="break-words text-sm text-lime-600 underline">
                          {doc.file_name}
                        </a>{" "}
                        <Badge>{doc.document_type.replace(/_/g, " ")}</Badge>
                      </div>
                    </li>
                  );
                })}
                {documents.length === 0 && presentation.evidence.length === 0 && <li className="text-sm text-slate-400">None yet.</li>}
              </ul>
              {interactive && (
                <div className="mt-3">
                  <CaseUpload caseId={caseId} kinds={documentKinds} defaultKind={matchingDocumentKind || "identity"} />
                </div>
              )}
            </CardBody>
          </Card>
          {viewer.role !== "customer" && (
            <p className="text-[11px] text-slate-400">Staff view uses the same approved presentation the customer sees.</p>
          )}
        </div>
      </div>
    </div>
  );
}
