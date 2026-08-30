import type { ReactNode } from "react";
import type { V5CustomerPresentation } from "@/lib/v5-customer-presentation";
import { v5FactMarkerLabel } from "@/lib/v5-customer-presentation";

function Marker({ state }: { state: "verified" | "reported" | "unknown" }) {
  if (state === "verified") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700" title={v5FactMarkerLabel(state)}>
        <span aria-hidden>✓</span>
        <span className="sr-only">{v5FactMarkerLabel(state)}</span>
        <span className="hidden sm:inline">{v5FactMarkerLabel(state)}</span>
      </span>
    );
  }
  if (state === "reported") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500" title={v5FactMarkerLabel(state)}>
        <span aria-hidden>○</span>
        <span className="sr-only">{v5FactMarkerLabel(state)}</span>
        <span className="hidden sm:inline">{v5FactMarkerLabel(state)}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700" title={v5FactMarkerLabel(state)}>
      <span aria-hidden>?</span>
      <span className="sr-only">{v5FactMarkerLabel(state)}</span>
      <span className="hidden sm:inline">{v5FactMarkerLabel(state)}</span>
    </span>
  );
}

function Section({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      {eyebrow ? <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{eyebrow}</p> : null}
      <h2 className={`text-lg font-semibold tracking-tight text-slate-900 ${eyebrow ? "mt-1" : ""}`}>{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function V5CustomerPresentationView({
  presentation,
  caseMeta,
  /** Phase S5 — Situation vs government Case eyebrow. */
  surface = "situation",
}: {
  presentation: V5CustomerPresentation;
  caseMeta?: { primaryForm?: string | null; relatedProcess?: string | null };
  surface?: "situation" | "case";
}) {
  const primaryForm = caseMeta?.primaryForm ?? presentation.primaryForm;
  const relatedProcess = caseMeta?.relatedProcess ?? presentation.relatedProcess;
  const eyebrow =
    surface === "case" ? "Your USCIS case" : "Your immigration situation";

  return (
    <div className="space-y-5" data-v5-customer-presentation="1">
      <header className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-5 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{eyebrow}</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{presentation.caseType}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">
          {primaryForm ? (
            <>
              Primary matter: Form {primaryForm}
              {relatedProcess ? <> · Related: {relatedProcess}</> : null}
            </>
          ) : surface === "case" ? (
            "Organized from your situation, documents, and the filings already on record."
          ) : (
            "Organized from your situation and matching documents — a USCIS Case is not required yet."
          )}
        </p>
      </header>

      <Section title="Your situation">
        {presentation.yourSituation.length ? (
          <ul className="space-y-3">
            {presentation.yourSituation.map((item, index) => (
              <li key={`${item.state}-${index}`} className="flex flex-col gap-1 border-b border-slate-100 pb-3 last:border-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <p className="text-sm leading-relaxed text-slate-800">{item.text}</p>
                <div className="shrink-0 sm:pt-0.5">
                  <Marker state={item.state} />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">We are still reconstructing the one-fact situation list from your records.</p>
        )}
      </Section>

      <Section title={presentation.keyPoint.heading}>
        <div className="space-y-3">
          {presentation.keyPoint.body.map((paragraph, index) => (
            <p key={index} className="text-sm leading-relaxed text-slate-700">
              {paragraph}
            </p>
          ))}
        </div>
      </Section>

      <Section title="Current process">
        {presentation.currentProcess.length ? (
          <ol className="space-y-0">
            {presentation.currentProcess.map((step, index) => (
              <li key={`${step}-${index}`} className="relative flex gap-3 pb-4 last:pb-0">
                <div className="flex flex-col items-center">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-[11px] font-semibold text-white">
                    {index + 1}
                  </span>
                  {index < presentation.currentProcess.length - 1 ? (
                    <span className="mt-1 w-px flex-1 bg-slate-200" aria-hidden />
                  ) : null}
                </div>
                <p className="pt-0.5 text-sm leading-relaxed text-slate-800">{step}</p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-slate-500">No filing-order process steps are locked yet.</p>
        )}
      </Section>

      <Section title="What your documents tell us">
        {presentation.documentsTellUs.length ? (
          <ul className="space-y-4">
            {presentation.documentsTellUs.map((doc) => (
              <li key={`${doc.fileName}-${doc.documentType}`} className="rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3">
                <p className="text-sm font-semibold text-slate-900">{doc.label}</p>
                <p className="mt-0.5 text-xs text-slate-500">{doc.fileName}</p>
                <p className="mt-2 text-sm text-slate-700">
                  <span className="font-medium text-slate-800">What it confirms: </span>
                  {doc.confirms}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  <span className="font-medium text-slate-800">Why it matters: </span>
                  {doc.whyItMatters}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">No uploaded documents have been classified for this case yet.</p>
        )}
      </Section>

      <Section title="What we still need to confirm">
        {presentation.stillNeedToConfirm.length ? (
          <ul className="space-y-3">
            {presentation.stillNeedToConfirm.map((item, index) => (
              <li key={`${item.text}-${index}`} className="border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                <p className="text-sm font-medium text-slate-900">{item.text}</p>
                <p className="mt-1 text-sm text-slate-600">{item.why}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">No material confirmation gaps are listed right now.</p>
        )}
      </Section>

      <Section title="What to do next">
        <ol className="space-y-4">
          {presentation.whatToDoNext.map((action, index) => (
            <li key={`${action.what}-${index}`} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <p className="text-sm font-semibold text-slate-900">
                <span className="mr-2 text-slate-400">{index + 1}.</span>
                {action.what}
              </p>
              <dl className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Why it matters</dt>
                  <dd className="mt-0.5">{action.why}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Can it be done now?</dt>
                  <dd className="mt-0.5">{action.now}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">What changes after</dt>
                  <dd className="mt-0.5">{action.whatChanges}</dd>
                </div>
              </dl>
            </li>
          ))}
        </ol>
      </Section>
    </div>
  );
}
