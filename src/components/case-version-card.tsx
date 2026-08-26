import { Card, CardBody, Badge } from "@/components/ui";
import { canonicalStateSummary, parseCanonicalApprovedState, versionReasonLabel, type CanonicalApprovedState } from "@/lib/canonical-case-state";
import { resolveVersionChrome, type VersionMatchInput } from "@/lib/goal-versions";

export function CaseVersionCard({
  version,
  versions = [],
  approvedStateJson,
  match,
}: {
  version: {
    version: number;
    reason: string;
    status: string;
    createdAt: Date;
    completedAt: Date | null;
    pipelineConfigVersion: string;
  } | null;
  versions?: {
    version: number;
    reason: string;
    status: string;
    createdAt: Date;
  }[];
  approvedStateJson?: string | null;
  match?: VersionMatchInput;
}) {
  if (!version) return null;
  const approved = version.status === "complete";
  const chrome = resolveVersionChrome(match);
  return (
    <Card>
      <CardBody>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{chrome.recordHeading}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-slate-800">Version {version.version}</p>
          <Badge color={approved ? "green" : version.status === "failed" ? "red" : "slate"}>
            {approved ? "Approved" : version.status.replace(/_/g, " ")}
          </Badge>
        </div>
        <p className="mt-1 text-sm text-slate-600">
          {versionReasonLabel(version.reason, match)} · {version.createdAt.toLocaleDateString("en-US")}
        </p>
        {version.pipelineConfigVersion ? (
          <p className="mt-1 text-xs text-slate-400">Review pipeline {version.pipelineConfigVersion}</p>
        ) : null}
        <p className="mt-1 text-xs text-slate-500">
          {chrome.laterVersions}
        </p>
        {approvedStateJson ? <CanonicalStateDetails stateJson={approvedStateJson} match={match} /> : null}
        {versions.length > 1 && (
          <ol className="mt-3 space-y-1 text-xs text-slate-500">
            {versions.slice(0, 5).map((item) => (
              <li key={item.version}>
                v{item.version} · {versionReasonLabel(item.reason, match)} · {item.createdAt.toLocaleDateString("en-US")} · {item.status}
              </li>
            ))}
          </ol>
        )}
      </CardBody>
    </Card>
  );
}

export function CanonicalStateDetails({ stateJson, match }: { stateJson: string; match?: VersionMatchInput }) {
  const state = parseCanonicalApprovedState(stateJson);
  if (!state) return null;
  const summary = canonicalStateSummary(state, match);
  return (
    <p className="mt-2 text-sm text-slate-600">
      {summary.versionLabel}
      {summary.posture ? ` · ${summary.posture}` : ""}
      {summary.nextAction ? ` · Next: ${summary.nextAction}` : ""}
    </p>
  );
}

export type { CanonicalApprovedState };
