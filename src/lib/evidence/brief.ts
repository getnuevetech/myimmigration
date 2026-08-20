import "server-only";
import { getCaseEvidenceGateBrief } from "./case-gate";
import type { EvidenceGateBrief } from "./gate";

export type SharedEvidenceBrief = {
  status: EvidenceGateBrief["status"];
  currentPosition: string;
  summary: string;
  facts: EvidenceGateBrief["facts"];
  events: EvidenceGateBrief["events"];
  unknowns: EvidenceGateBrief["unknowns"];
  pendingActions: string[];
  text: string;
  supportedText: string;
};

export function buildSharedEvidenceBrief(gate: EvidenceGateBrief): SharedEvidenceBrief {
  const supportedParts = [
    gate.currentPosition,
    gate.summary,
    ...gate.pendingActions,
    ...gate.facts.flatMap((fact) => [fact.key, fact.value, fact.source]),
    ...gate.events.flatMap((event) => [event.eventType, event.title, event.dateText]),
  ].filter(Boolean);
  const text = [
    `Evidence status: ${gate.status}`,
    `Current position: ${gate.currentPosition}`,
    `Summary: ${gate.summary}`,
    gate.facts.length
      ? `Facts:\n${gate.facts.map((fact) => `- ${fact.key}: ${fact.value} (${fact.confidence}, source: ${fact.source})`).join("\n")}`
      : "Facts: none compiled yet.",
    gate.events.length
      ? `Events:\n${gate.events.map((event) => `- ${event.dateText ? `${event.dateText}: ` : ""}${event.title} [${event.eventType}]`).join("\n")}`
      : "Events: none compiled yet.",
    gate.unknowns.length
      ? `Unknowns:\n${gate.unknowns.map((item) => `- ${item.question}`).join("\n")}`
      : "Unknowns: none blocking.",
    gate.pendingActions.length
      ? `Pending actions:\n${gate.pendingActions.map((item) => `- ${item}`).join("\n")}`
      : "Pending actions: none from evidence.",
  ].join("\n");

  return {
    status: gate.status,
    currentPosition: gate.currentPosition,
    summary: gate.summary,
    facts: gate.facts,
    events: gate.events,
    unknowns: gate.unknowns,
    pendingActions: gate.pendingActions,
    text,
    supportedText: supportedParts.join("\n").toUpperCase(),
  };
}

export async function getCaseEvidenceBrief(caseId: string): Promise<SharedEvidenceBrief> {
  return buildSharedEvidenceBrief(await getCaseEvidenceGateBrief(caseId));
}
