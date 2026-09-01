import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { createFilingPlanAction } from "@/actions/filing-plan";
import { composeAssistantView, parseStoredIntelligence, type AssistantViewSection } from "@/lib/conversation";
import { situationRefLabel } from "@/lib/situation";
import { parsePathwaysJson } from "@/lib/filing-plan";
import { SituationIntelligenceInterview } from "@/components/situation-intelligence-interview";
import { echoFactsFromSet, factSetForSituationRow, peekSituationInterview } from "@/lib/situation-intelligence";

function SectionBlock({ section }: { section: AssistantViewSection }) {
  if (section.type === "paragraph" || section.type === "disclaimer") {
    return <p className="text-slate-700 leading-relaxed">{section.text}</p>;
  }
  if (section.type === "ask") {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">One fact that changes the path</p>
        <p className="mt-1 font-medium text-slate-900">{section.question}</p>
        <p className="mt-1 text-sm text-slate-600">{section.reason}</p>
      </div>
    );
  }
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{section.intro}</p>
      <ul className="mt-3 space-y-3">
        {section.branches.map((b) => (
          <li key={b.id} className="border-l-2 border-lime-500 pl-3">
            <p className="font-medium text-slate-900">{b.condition}</p>
            <p className="text-sm text-slate-600">{b.explanation}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SituationWorkspaceView(props: {
  id: string;
  number: number;
  title: string;
  originalNarrative: string;
  goal: string;
  assistantReply: string;
  intelligenceJson: string;
  currentPathwaysJson: string;
  knownFactsJson: string;
  createdAt: Date;
  existingFilingPlanId?: string | null;
  isGuest?: boolean;
  /** Phase Billing — false on Free / guests without Plus; when over monthly Plus cap. */
  canBuildFilingPlan?: boolean;
  filingPlanBlockedReason?: "upgrade" | "limit" | "guest" | null;
}) {
  const intel = parseStoredIntelligence(props.intelligenceJson);
  const allSections =
    intel != null
      ? composeAssistantView(intel, props.originalNarrative)
      : [{ type: "paragraph" as const, text: props.assistantReply }];

  const factSet = factSetForSituationRow({
    knownFactsJson: props.knownFactsJson,
    originalNarrative: props.originalNarrative,
    goal: props.goal,
  });
  const director = peekSituationInterview({
    knownFactsJson: props.knownFactsJson,
    originalNarrative: props.originalNarrative,
    goal: props.goal,
  });
  const interviewActive = Boolean(director.next) && !director.ready_for_analysis;
  const readyForAnalysis = director.ready_for_analysis || !director.next;

  // Phase SI-3: do not present pathway branches / legacy single-ask before fact orientation.
  const sections = interviewActive
    ? allSections.filter((s) => s.type === "paragraph" || s.type === "disclaimer")
    : allSections;

  const asked =
    intel?.question_contract.explicit_question ||
    intel?.question_contract.interpreted_question ||
    props.goal ||
    "What are my options?";

  const pathways = parsePathwaysJson(props.currentPathwaysJson);
  const defaultPathway = pathways[0]?.id ?? "";
  const echoFacts = echoFactsFromSet(factSet);
  const initialQuestion = director.next
    ? {
        candidate: director.next.candidate,
        customer_wording: director.next.customer_wording,
        reason: director.next.reason,
        level: director.next.level,
      }
    : null;

  return (
    <div className="max-w-3xl space-y-8">
      <header>
        <p className="text-sm font-medium text-lime-700">Your Immigration Situation</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{props.title}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {situationRefLabel(props.number)} · Opened {props.createdAt.toLocaleDateString("en-US")}
        </p>
      </header>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">What you asked</h2>
        <p className="text-slate-800 leading-relaxed whitespace-pre-wrap">{props.originalNarrative}</p>
        {props.goal ? <p className="text-sm text-slate-600">Goal: {props.goal}</p> : null}
        <p className="text-sm italic text-slate-500">{asked}</p>
      </section>

      <SituationIntelligenceInterview
        situationId={props.id}
        echoFacts={echoFacts}
        initialQuestion={initialQuestion}
        askedCount={director.interview.asked_count}
        readyForAnalysis={readyForAnalysis && !interviewActive}
      />

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          {interviewActive ? "While we orient the facts" : "What this may mean"}
        </h2>
        {interviewActive ? (
          <p className="text-slate-700 leading-relaxed">
            We heard your story. After a few orientation details, we can research options that fit — without jumping to a pathway you did not describe.
          </p>
        ) : (
          sections.map((section, i) => <SectionBlock key={i} section={section} />)
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
        <h2 className="text-sm font-semibold text-slate-800">When you&apos;re ready</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {props.existingFilingPlanId ? (
            <Link
              href={
                props.isGuest
                  ? `/start/filing-plan?id=${props.existingFilingPlanId}`
                  : `/app/filing-plans/${props.existingFilingPlanId}`
              }
              className="rounded-lg bg-lime-600 px-3 py-2 text-sm font-semibold text-white hover:bg-lime-700"
            >
              View my filing plan
            </Link>
          ) : props.canBuildFilingPlan === false || props.filingPlanBlockedReason ? (
            <Link
              href={
                props.filingPlanBlockedReason === "guest"
                  ? "/register?next=/app/billing"
                  : props.filingPlanBlockedReason === "limit"
                    ? "/app/billing?upgrade=filing_plan_limit"
                    : "/app/billing?upgrade=filing_plan"
              }
              className="rounded-lg bg-lime-600 px-3 py-2 text-sm font-semibold text-white hover:bg-lime-700"
            >
              {props.filingPlanBlockedReason === "guest"
                ? "Create an account to build a Filing Plan"
                : props.filingPlanBlockedReason === "limit"
                  ? "Upgrade to Pro for more Filing Plans"
                  : "Upgrade to Plus to build a Filing Plan"}
            </Link>
          ) : interviewActive ? (
            <span className="rounded-lg bg-slate-200 px-3 py-2 text-sm font-medium text-slate-500">
              Finish a few orientation details first
            </span>
          ) : (
            <ActionForm action={createFilingPlanAction} className="inline">
              <input type="hidden" name="situationId" value={props.id} />
              <input type="hidden" name="selectedPathway" value={defaultPathway} />
              <SubmitButton className="rounded-lg px-3 py-2 text-sm">Build my filing plan</SubmitButton>
            </ActionForm>
          )}
          <Link
            href="/app/consultants"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100"
          >
            Talk to an immigration professional
          </Link>
          <Link
            href="/app/qa"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100"
          >
            Ask another question
          </Link>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          This is not a USCIS Case. A Filing Plan prepares a path; a Case appears only when something is actually before the government.
        </p>
      </section>
    </div>
  );
}
