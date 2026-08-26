import { presentationFromSnapshot, type CustomerFacingSnapshot } from "@/lib/admin-reanalysis-compare";

export function StaffSharedReanalysis({ snapshot }: { snapshot: CustomerFacingSnapshot }) {
  const presentation = presentationFromSnapshot(snapshot);
  const findingTitles = (presentation?.findings?.length
    ? presentation.findings.map((item) => item.title)
    : snapshot.issues.map((item) => item.title)
  ).filter(Boolean);
  return (
    <section className="rounded-2xl border border-lime-300 bg-lime-50 p-5">
      <p className="text-xs font-bold uppercase tracking-wide text-lime-700">Updated review from staff</p>
      <p className="mt-1 text-sm text-lime-900">
        An admin shared a new re-analysis. This is not your live output until they choose to replace it.
      </p>
      <p className="mt-3 text-sm font-semibold text-slate-900">
        {presentation?.hero.current_posture || snapshot.case.status.replace(/_/g, " ")}
      </p>
      {presentation?.hero.next_best_action?.title && (
        <p className="mt-1 text-sm text-slate-700">Next: {presentation.hero.next_best_action.title}</p>
      )}
      {presentation?.what_this_means.summary && (
        <p className="mt-2 text-sm leading-relaxed text-slate-700">{presentation.what_this_means.summary}</p>
      )}
      {findingTitles.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm text-slate-800">
          {findingTitles.slice(0, 5).map((title, index) => (
            <li key={`${title}-${index}`}>{title}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
