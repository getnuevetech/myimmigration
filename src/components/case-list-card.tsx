import Link from "next/link";
import { Card, CardBody, Badge, ProgressBar } from "@/components/ui";
import { formatCaseNumber } from "@/lib/case-number";
import { caseListActionLine, caseListEvidenceLine, caseListVersionLine, type CaseListSummary } from "@/lib/case-presentation-list";

export function CasePresentationContextCard({
  heading = "Approved case presentation",
  summary,
}: {
  heading?: string;
  summary: CaseListSummary;
}) {
  return (
    <Card className="mb-6">
      <CardBody>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{heading}</p>
        <CaseListSummaryDetails summary={summary} />
      </CardBody>
    </Card>
  );
}

export function CaseListSummaryDetails({
  summary,
  showMeaning = true,
}: {
  summary: CaseListSummary;
  showMeaning?: boolean;
}) {
  return (
    <>
      <p className="mt-1 text-sm font-medium text-slate-800">{summary.posture}</p>
      {caseListVersionLine(summary) ? (
        <p className="mt-1 text-xs font-medium text-slate-500">{caseListVersionLine(summary)}</p>
      ) : null}
      <p className="mt-1 text-sm text-slate-600">{caseListActionLine(summary)}</p>
      <p className="mt-1 text-xs text-slate-500">{caseListEvidenceLine(summary)}</p>
      {showMeaning && summary.meaning && (
        <p className="mt-2 line-clamp-2 text-sm text-slate-500">{summary.meaning}</p>
      )}
    </>
  );
}

export function CaseListCard({
  href,
  number,
  title,
  status,
  readinessScore,
  summary,
  compact = false,
  readinessLabel = "Case readiness",
}: {
  href: string;
  number: number;
  title: string;
  status: string;
  readinessScore: number;
  summary: CaseListSummary;
  compact?: boolean;
  readinessLabel?: string;
}) {
  const statusColor = status === "analyzed" ? "green" : status === "consultant_recommended" ? "lime" : "slate";
  return (
    <Link href={href} className="block">
      <Card className="transition hover:border-lime-300">
        <CardBody className={compact ? "flex items-start justify-between gap-3" : undefined}>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold text-slate-900">
                <span className="mr-2 font-mono text-xs text-lime-600">{formatCaseNumber(number)}</span>
                {title}
              </p>
              <Badge color={statusColor}>{status.replace(/_/g, " ")}</Badge>
            </div>
            <CaseListSummaryDetails summary={summary} showMeaning={!compact} />
            {!compact && (
              <div className="mt-3 max-w-sm">
                <ProgressBar value={readinessScore} label={readinessLabel} />
              </div>
            )}
          </div>
          {compact && (
            <div className="hidden w-28 shrink-0 sm:block">
              <ProgressBar value={readinessScore} />
            </div>
          )}
        </CardBody>
      </Card>
    </Link>
  );
}
