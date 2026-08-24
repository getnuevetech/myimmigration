import { Card, CardBody, Badge } from "@/components/ui";
import { canonicalStateSummary, parseCanonicalApprovedState, versionReasonLabel, type CanonicalApprovedState } from "@/lib/canonical-case-state";

export function CaseVersionCard({
  version,
  versions = [],
  approvedStateJson,
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
}) {
  if (!version) return null;
  const approved = version.status === "complete";
  return (
    <Card>
      <CardBody>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Case record version</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-slate-800">Version {version.version}</p>
          <Badge color={approved ? "green" : version.status === "failed" ? "red" : "slate"}>
            {approved ? "Approved" : version.status.replace(/_/g, " ")}
          </Badge>
        </div>
        <p className="mt-1 text-sm text-slate-600">
          {versionReasonLabel(version.reason)} · {version.createdAt.toLocaleDateString("en-US")}
        </p>
        {version.pipelineConfigVersion ? (
          <p className="mt-1 text-xs text-slate-400">Review pipeline {version.pipelineConfigVersion}</p>
        ) : null}
        <p className="mt-1 text-xs text-slate-500">
          Later document uploads or answers create a new version. This review used the records on file at that time.
        </p>
        {approvedStateJson ? <CanonicalStateDetails stateJson={approvedStateJson} /> : null}
        {versions.length > 1 && (
          <ol className="mt-3 space-y-1 text-xs text-slate-500">
            {versions.slice(0, 5).map((item) => (
              <li key={item.version}>
                v{item.version} · {versionReasonLabel(item.reason)} · {item.createdAt.toLocaleDateString("en-US")} · {item.status}
              </li>
            ))}
          </ol>
        )}
      </CardBody>
    </Card>
  );
}

export function CanonicalStateDetails({ stateJson }: { stateJson: string }) {
  const state = parseCanonicalApprovedState(stateJson);
  if (!state) return null;
  const summary = canonicalStateSummary(state);
  return (
    <p className="mt-2 text-sm text-slate-600">
      {summary.versionLabel}
      {summary.posture ? ` · ${summary.posture}` : ""}
      {summary.nextAction ? ` · Next: ${summary.nextAction}` : ""}
    </p>
  );
}

export type { CanonicalApprovedState };
