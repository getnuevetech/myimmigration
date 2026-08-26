import type { PresentationContract } from "./case-presentation-contract";
import { formatPresentationDate, presentationActionStatus } from "./case-presentation-ui";
import { thisSurfacePhrase, type FiledSurfaceInput } from "./goal-notices";

export type PresentationBrief = {
  text: string;
  supportedText: string;
};

export type NoticeNextStep = { title: string; description: string };

export function buildPresentationBrief(contract: PresentationContract): PresentationBrief {
  const nextAction = contract.hero.next_best_action
    ? `${contract.hero.next_best_action.title} (${contract.hero.next_best_action.action_key})`
    : "No action is ready yet";
  const deadline = contract.hero.nearest_deadline
    ? `${contract.hero.nearest_deadline.title} (${formatPresentationDate(contract.hero.nearest_deadline.due_date)})`
    : "No open deadline is on file";
  const lines = [
    "Where you stand:",
    `- Current posture: ${contract.hero.current_posture}`,
    `- Next best action: ${nextAction}`,
    `- Nearest deadline: ${deadline}`,
    `- Evidence strength: ${contract.hero.evidence_strength}`,
    `- Professional review recommended: ${contract.hero.professional_review_recommended ? "yes" : "no"}`,
    "",
    "What this means:",
    contract.what_this_means.summary || "The case is still being organized.",
    `- Unresolved items: ${contract.what_this_means.unresolved_count}`,
    ...(contract.what_this_means.pending_actions.length
      ? ["Pending actions:", ...contract.what_this_means.pending_actions.map((item) => `- ${item}`)]
      : ["Pending actions: none on the approved presentation."]),
    ...(contract.what_this_means.unknowns.length
      ? ["Still needs:", ...contract.what_this_means.unknowns.map((item) => `- ${item}`)]
      : []),
    ...(contract.what_this_means.conflicts.length
      ? [
          "Information conflicts:",
          ...contract.what_this_means.conflicts.map(
            (conflict) => `- ${conflict.topic}: ${conflict.description}${conflict.resolution ? ` ${conflict.resolution}` : ""}`,
          ),
        ]
      : []),
    "",
    `Findings (${contract.findings.length}):`,
    ...(contract.findings.length
      ? contract.findings.map(
          (finding) =>
            `- ${finding.title} [${finding.state}; ${finding.evidence_status}; ${finding.evidence_strength}]${finding.conclusion ? `: ${finding.conclusion}` : ""}${finding.next_action ? `; next ${finding.next_action}` : ""}`,
        )
      : ["- None on the approved presentation."]),
    "",
    "Timeline:",
    ...(contract.timeline.length
      ? contract.timeline.map((event) => `- ${[event.dateText, event.title].filter(Boolean).join(": ") || "Event"}`)
      : ["- None on the approved presentation."]),
    "",
    "Your next steps:",
    ...(contract.actions.length
      ? contract.actions.map((action) => `- ${action.title} [${presentationActionStatus(action.status).label}] (${action.action_key})`)
      : ["- None on the approved presentation."]),
    "",
    "Deadlines:",
    ...(contract.deadlines.length
      ? contract.deadlines.map((item) => `- ${item.title} (${formatPresentationDate(item.due_date)}; ${item.source})`)
      : ["- None on the approved presentation."]),
  ];
  const text = lines.join("\n");
  const supportedParts = [
    contract.hero.current_posture,
    contract.hero.next_best_action?.title,
    contract.hero.next_best_action?.action_key,
    contract.hero.nearest_deadline?.title,
    contract.hero.nearest_deadline?.due_date ? formatPresentationDate(contract.hero.nearest_deadline.due_date) : null,
    contract.what_this_means.summary,
    ...contract.what_this_means.pending_actions,
    ...contract.what_this_means.unknowns,
    ...contract.findings.flatMap((finding) => [finding.title, finding.conclusion, finding.next_action]),
    ...contract.timeline.flatMap((event) => [event.title, event.dateText]),
    ...contract.actions.map((action) => action.title),
    ...contract.deadlines.flatMap((item) => [item.title, formatPresentationDate(item.due_date)]),
  ].filter(Boolean);
  return { text, supportedText: supportedParts.join("\n").toUpperCase() };
}

export function presentationGroundingBlock(brief: PresentationBrief | null, evidenceText?: string | null): string {
  const parts: string[] = [];
  if (brief) {
    parts.push(
      `APPROVED CASE PRESENTATION:\n${brief.text}\n\nPresentation lockdown: use these blocks as the customer-facing posture, next action, findings, deadlines, and next steps. Do not contradict them with reconstruction text or invent a different case plan.`,
    );
  }
  if (evidenceText) {
    parts.push(`COMPILED CASE EVIDENCE BRIEF:\n${evidenceText}`);
  }
  return parts.join("\n\n");
}

export function mergeSupportedText(...parts: (string | null | undefined)[]): string {
  return parts.filter(Boolean).join("\n");
}

export function presentationNoticeStepDescription(posture: string, input: FiledSurfaceInput = {}): string {
  return `Approved next step for ${thisSurfacePhrase(input)} (${posture}).`;
}

export function withPresentationNoticeSteps(
  steps: NoticeNextStep[],
  contract: PresentationContract | null,
  input: FiledSurfaceInput = {},
): NoticeNextStep[] {
  const next = contract?.hero.next_best_action;
  if (!contract || !next?.title) return steps;
  if (steps.some((step) => step.title.toLowerCase() === next.title.toLowerCase())) return steps;
  return [
    {
      title: next.title,
      description: presentationNoticeStepDescription(contract.hero.current_posture, input),
    },
    ...steps,
  ];
}
