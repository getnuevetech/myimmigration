import "server-only";
import { db } from "./db";
import { getEvidenceActionState } from "./evidence/case-action-state";
import { buildLedgerDrivenActions } from "./action-priority";
import type { FactLedger } from "./evidence/fact-ledger";

function graphStatus(stepStatus: string, evidenceSatisfied: boolean, priorOpen: boolean): string {
  if (stepStatus === "done" || evidenceSatisfied) return "COMPLETED";
  if (stepStatus === "current") return "READY";
  return priorOpen ? "BLOCKED" : "READY";
}

function parseLedger(raw: string | null | undefined): FactLedger | null {
  try {
    const parsed = JSON.parse(raw || "{}");
    if (parsed && Array.isArray(parsed.facts)) return parsed as FactLedger;
  } catch {
    /* ignore */
  }
  return null;
}

export async function buildCaseActionGraph(caseId: string) {
  const [steps, issues, reconstruction] = await Promise.all([
    db.pathStep.findMany({ where: { caseId }, orderBy: { sortOrder: "asc" } }),
    db.issue.findMany({ where: { caseId }, select: { id: true, nextAction: true, issueType: true } }),
    db.caseReconstruction.findUnique({ where: { caseId }, select: { factLedgerJson: true } }),
  ]);
  await db.caseActionNode.deleteMany({ where: { caseId } });

  const ledger = parseLedger(reconstruction?.factLedgerJson);
  const ranked = buildLedgerDrivenActions({ ledger });
  const priorityByKey = new Map(ranked.map((a, index) => [a.action_id.toUpperCase(), index + 1]));

  const completedActionKeys = new Set<string>();
  const nodes = [];
  let priorOpen = false;
  for (const [index, step] of steps.entries()) {
    const evidence = step.actionKey ? await getEvidenceActionState(caseId, step.actionKey).catch(() => null) : null;
    const status = graphStatus(step.status, evidence?.satisfied === true, priorOpen);
    if (status !== "COMPLETED") priorOpen = true;
    if (status === "COMPLETED" && step.actionKey) completedActionKeys.add(step.actionKey.toUpperCase());
    const sourceFindingIds = issues
      .filter((issue) => issue.nextAction.toUpperCase() === step.actionKey.toUpperCase())
      .map((issue) => issue.id);
    const rankedPriority = priorityByKey.get(String(step.actionKey ?? "").toUpperCase());
    nodes.push({
      caseId,
      actionKey: step.actionKey,
      title: step.title,
      description: step.description,
      // Phase D: prefer deterministic ledger score order when the action is known.
      priority: rankedPriority ?? index + 1 + ranked.length,
      dependsOnJson: JSON.stringify(index > 0 ? [steps[index - 1].id] : []),
      resolvesJson: JSON.stringify(sourceFindingIds),
      requiresJson: JSON.stringify(evidence?.supportingFacts ?? []),
      status,
      sourceFindingIdsJson: JSON.stringify(sourceFindingIds),
    });
  }

  // Append ledger-driven gap actions that are not already path steps (customer only).
  const existingKeys = new Set(nodes.map((n) => String(n.actionKey ?? "").toUpperCase()).filter(Boolean));
  for (const action of ranked.filter((a) => a.actor === "customer")) {
    if (existingKeys.has(action.action_id.toUpperCase())) continue;
    nodes.push({
      caseId,
      actionKey: action.action_id,
      title: action.title,
      description: action.why,
      priority: priorityByKey.get(action.action_id.toUpperCase()) ?? nodes.length + 1,
      dependsOnJson: "[]",
      resolvesJson: JSON.stringify(action.effects),
      requiresJson: "[]",
      status: "READY",
      sourceFindingIdsJson: "[]",
    });
  }

  nodes.sort((a, b) => a.priority - b.priority);

  for (const node of nodes) {
    const key = node.actionKey.toUpperCase();
    if (key && node.status !== "COMPLETED" && completedActionKeys.has(key)) {
      node.status = "SUPERSEDED";
    }
  }

  if (nodes.length > 0) {
    await db.caseActionNode.createMany({ data: nodes });
  }
  return nodes.length;
}
