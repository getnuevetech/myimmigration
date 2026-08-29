"use client";

import { useActionState, useRef, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { askQuestionAction } from "@/actions/user";
import { createOptionsCaseFromQaAction } from "@/actions/case";
import { qaConversationCanSaveAsOptionsCase } from "@/lib/goal-suggestions";
import type { QaChatAccess } from "@/lib/qa-access";
import { AssistantMessageText } from "@/components/assistant-reply";
import { decisionFocusLabel } from "@/lib/conversation/assistant-composer";

export type { QaChatAccess } from "@/lib/qa-access";

const STARTER_PROMPTS = [
  "Can my U.S. citizen wife file for me? We are married.",
  "I came through Mexico, have been here 3 years, wife is USC — what are my options?",
  "What is an I-862 / Notice to Appear?",
  "What documents do I need for a marriage green card?",
];

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-xl bg-lime-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-lime-700 disabled:opacity-50"
    >
      {pending ? "Thinking…" : "Ask"}
    </button>
  );
}

function SaveOptionsCase() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-lime-800 ring-1 ring-lime-300 hover:bg-lime-100 disabled:opacity-50"
    >
      {pending ? "Saving…" : "Keep these answers as my options review"}
    </button>
  );
}

function ConversionLinks({
  access,
  caseId,
  registerHref,
  upgradeHref,
}: {
  access: QaChatAccess;
  caseId?: string;
  registerHref: string;
  upgradeHref: string;
}) {
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {access.showRegisterCta && (
        <Link href={registerHref} className="rounded-lg bg-lime-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-lime-700">
          Create a free account
        </Link>
      )}
      {access.showUpgradeCta && (
        <Link
          href={upgradeHref}
          className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-lime-800 ring-1 ring-lime-300 hover:bg-lime-100"
        >
          See paid plans
        </Link>
      )}
      {access.showConsultantCta && (
        <Link
          href={access.audience === "guest" ? registerHref : access.audience === "pro" ? (caseId ? `/app/consultants?case=${caseId}` : "/app/consultants") : upgradeHref}
          className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50"
        >
          {access.audience === "pro" ? "Request a professional match" : "Talk with a licensed professional"}
        </Link>
      )}
    </div>
  );
}

export function QaChat({
  threadId,
  caseId = "",
  messages,
  access,
  focusLabel,
  interpretedQuestion,
  defaultQuestion = "",
}: {
  threadId: string;
  caseId?: string;
  messages: { id: string; role: string; content: string }[];
  access?: QaChatAccess;
  /** Customer-facing decision focus from Question Contract. */
  focusLabel?: string | null;
  interpretedQuestion?: string | null;
  /** Prefill from guide / deep link (`?q=`). */
  defaultQuestion?: string;
}) {
  const [state, formAction] = useActionState(askQuestionAction, null);
  const [saveState, saveAction] = useActionState(createOptionsCaseFromQaAction, null);
  const [draft, setDraft] = useState(defaultQuestion);
  const formRef = useRef<HTMLFormElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const canSave = Boolean(threadId) && Boolean(access?.allowSaveOptionsCase) && qaConversationCanSaveAsOptionsCase(messages, caseId);
  const showGuestKeep = Boolean(threadId) && Boolean(access?.showRegisterCta) && !caseId && messages.some((m) => m.role === "assistant");
  const blocked = Boolean(access?.blocked);
  const showPromoteCase =
    Boolean(threadId) &&
    !caseId &&
    !access?.showRegisterCta &&
    messages.some((m) => m.role === "assistant");
  const narrativeForCase = messages
    .filter((m) => m.role === "user")
    .map((m) => m.content)
    .join("\n\n")
    .slice(0, 500);
  const caseHref = `/app/cases/new?prefill=${encodeURIComponent(narrativeForCase || draft || "")}&forceCase=1`;
  const registerHref = threadId
    ? `/register?next=${encodeURIComponent(`/app/qa/${threadId}`)}`
    : "/register";
  const upgradeHref = threadId
    ? `/app/billing?returnTo=${encodeURIComponent(`/app/qa/${threadId}`)}`
    : "/pricing";
  const resolvedFocus = focusLabel || (interpretedQuestion ? decisionFocusLabel("answer_user_question") : null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    if (state?.ok) {
      formRef.current?.reset();
      setDraft("");
    }
  }, [messages.length, state]);

  return (
    <div className="flex flex-col rounded-2xl border border-slate-200 bg-white shadow-sm">
      {resolvedFocus && messages.length > 0 && (
        <div className="border-b border-emerald-100 bg-gradient-to-r from-emerald-50/90 to-white px-4 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-800/80">Working on</p>
          <p className="text-sm font-medium text-slate-900">{resolvedFocus}</p>
          {interpretedQuestion ? (
            <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{interpretedQuestion}</p>
          ) : null}
        </div>
      )}
      <div className="max-h-[55vh] min-h-[200px] space-y-4 overflow-y-auto p-5">
        {messages.length === 0 && (
          <div className="py-6 text-center">
            <p className="text-sm font-medium text-slate-600">Try a question like these:</p>
            <div className="mt-3 flex flex-col gap-2">
              {STARTER_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => setDraft(prompt)}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm text-slate-700 transition hover:border-lime-300 hover:bg-lime-50/60"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                m.role === "user" ? "bg-lime-600 text-white" : "bg-slate-100 text-slate-800"
              }`}
            >
              {m.role === "assistant" ? (
                <AssistantMessageText content={m.content} />
              ) : (
                <div className="whitespace-pre-wrap text-sm leading-relaxed">{m.content}</div>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      {access && (
        <div className="border-t border-slate-100 bg-slate-50 px-4 py-3">
          <p className="text-sm text-slate-700">
            {blocked
              ? access.blockReason
              : access.remaining === null
                ? access.audience === "pro"
                  ? access.consultantName
                    ? `Personalized answers are included on your plan. A matching professional on ImmigrationOnMe: ${access.consultantName}.`
                    : "Personalized answers are included on your plan. Pro can match you with a licensed attorney or accredited representative on this platform."
                  : access.audience === "free" && access.linkedCase
                    ? access.filed
                      ? "Questions about this case do not use your general Q&A allowance. Upgrade to Plus for personalized general follow-ups, or Pro to add a matched professional."
                      : "Questions about this situation do not use your general Q&A allowance. Upgrade to Plus for personalized general follow-ups, or Pro to add a matched professional."
                    : "Personalized official follow-ups are included on your plan. A licensed professional on ImmigrationOnMe can go deeper on Pro."
                : access.remaining === 1
                  ? "1 general question left at this access level."
                  : `${access.remaining} general questions left at this access level.`}
          </p>
          <ConversionLinks access={access} caseId={caseId} registerHref={registerHref} upgradeHref={upgradeHref} />
        </div>
      )}
      {canSave && (
        <form action={saveAction} className="border-t border-lime-100 bg-lime-50 px-4 py-3">
          {saveState?.error && (
            <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{saveState.error}</p>
          )}
          <input type="hidden" name="threadId" value={threadId} />
          <p className="text-sm text-lime-900">
            Official follow-ups you already answered are saved as facts for this goal. Keep them on an options review so the next questions are only the ones still open.
          </p>
          <div className="mt-2">
            <SaveOptionsCase />
          </div>
        </form>
      )}
      {showGuestKeep && !canSave && (
        <div className="border-t border-lime-100 bg-lime-50 px-4 py-3">
          <p className="text-sm text-lime-900">
            Create a free account to keep these answers on a personalized options review. Paid plans continue official follow-ups, and Pro can match you with a licensed attorney or accredited representative.
          </p>
          <div className="mt-2">
            <Link href={registerHref} className="rounded-lg bg-lime-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-lime-700">
              Create a free account to keep this review
            </Link>
          </div>
        </div>
      )}
      {showPromoteCase && (
        <div className="border-t border-slate-100 bg-white px-4 py-3">
          <p className="text-sm text-slate-700">
            Need filings, risks, and a complete next-action plan? Start a full case review — uploads alone never open a case.
          </p>
          <div className="mt-2">
            <Link
              href={caseHref}
              className="inline-flex rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
            >
              Start a full case review
            </Link>
          </div>
        </div>
      )}
      <form ref={formRef} action={formAction} className="border-t border-slate-200 p-4">
        {state?.error && (
          <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
        )}
        <input type="hidden" name="threadId" value={threadId} />
        <input type="hidden" name="caseId" value={caseId} />
        {!blocked && (
          <div className="flex gap-2">
            <input
              name="question"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={messages.some((m) => m.role === "assistant") ? "Answer the follow-up, or ask something else…" : "Type your immigration question…"}
              autoComplete="off"
              className="flex-1 rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-lime-500 focus:outline-none focus:ring-2 focus:ring-lime-100"
            />
            <Submit />
          </div>
        )}
      </form>
    </div>
  );
}
