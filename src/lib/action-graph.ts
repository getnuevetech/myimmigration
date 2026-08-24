import "server-only";
import { db } from "./db";
import { getEvidenceActionState } from "./evidence/case-action-state";

function graphStatus(stepStatus: string, evidenceSatisfied: boolean, priorOpen: boolean): string {
  if (stepStatus === "done" || evidenceSatisfied) return "COMPLETED";
  if (stepStatus === "current") return "READY";
  return priorOpen ? "BLOCKED" : "READY";
}

export async function buildCaseActionGraph(caseId: string) {
  const [steps, issues] = await Promise.all([
    db.pathStep.findMany({ where: { caseId }, orderBy: { sortOrder: "asc" } }),
    db.issue.findMany({ where: { caseId }, select: { id: true, nextAction: true, issueType: true } }),
  ]);
  await db.caseActionNode.deleteMany({ where: { caseId } });

  const completedActionKeys = new Set<string>();
  const nodes = [];
  let priorOpen = false;
  for (const [index, step] of steps.entries()) {
    const evidence = step.actionKey ? await getEvidenceActionState(caseId, step.actionKey).catch(() => null) : null;
    const status = graphStatus(step.status, evidence?.satisfied === true, priorOpen);
    if (status !== "COMPLETED") priorOpen = true;
    if (status === "COMPLETED" && step.actionKey) completedActionKeys.add(step.actionKey.toUpperCase());
    const sourceFindingIds = issues.filter((issue) => issue.nextAction.toUpperCase() === step.actionKey.toUpperCase()).map((issue) => issue.id);
    nodes.push({
      caseId,
      actionKey: step.actionKey,
      title: step.title,
      description: step.description,
      priority: index + 1,
      dependsOnJson: JSON.stringify(index > 0 ? [steps[index - 1].id] : []),
      resolvesJson: JSON.stringify(sourceFindingIds),
      requiresJson: JSON.stringify(evidence?.supportingFacts ?? []),
      status,
      sourceFindingIdsJson: JSON.stringify(sourceFindingIds),
    });
  }

  // Collapse duplicated investigative actions that evidence or earlier steps
  // already completed.
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
