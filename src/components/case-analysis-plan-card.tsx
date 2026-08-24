import { Card, CardBody, Badge } from "@/components/ui";
import { analysisPlanSummary, parseAnalysisPlan } from "@/lib/case-analysis-plan";

export function CaseAnalysisPlanCard({ planJson }: { planJson: string }) {
  const plan = parseAnalysisPlan(planJson);
  if (!plan) return null;
  const summary = analysisPlanSummary(plan);
  return (
    <Card>
      <CardBody>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">How this case was analyzed</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-slate-800">{summary.complexityLabel}</p>
          {summary.stopped && <Badge color="slate">Analysis stopped</Badge>}
          {summary.blocked && <Badge color="red">Evidence blocked</Badge>}
        </div>
        {summary.executedLabels.length > 0 && (
          <ul className="mt-3 space-y-1 text-sm text-slate-700">
            {summary.executedLabels.map((label) => (
              <li key={label}>• {label}</li>
            ))}
          </ul>
        )}
        {summary.runtimeLabels.length > 0 && (
          <div className="mt-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Added during analysis</p>
            <ul className="mt-1 space-y-1 text-sm text-slate-700">
              {summary.runtimeLabels.map((item) => (
                <li key={item.label}>• {item.label}: {item.reason}</li>
              ))}
            </ul>
          </div>
        )}
        {summary.skippedLabels.length > 0 && (
          <div className="mt-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Skipped</p>
            <ul className="mt-1 space-y-1 text-sm text-slate-500">
              {summary.skippedLabels.map((item) => (
                <li key={item.label}>• {item.label} — {item.reason}</li>
              ))}
            </ul>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
