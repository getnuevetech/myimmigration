import "server-only";
import { db } from "./db";

function materialityForUnknown(key: string): "HIGH" | "MEDIUM" | "LOW" {
  if (/deadline|response|appointment|conflict/i.test(key)) return "HIGH";
  if (/receipt|form|notice|status/i.test(key)) return "MEDIUM";
  return "LOW";
}

export async function planCaseQuestions(caseId: string) {
  const [unknowns, suppressed, answered] = await Promise.all([
    db.caseUnknown.findMany({ where: { caseId, status: "open" }, orderBy: { createdAt: "asc" } }),
    db.suppressedQuestion.findMany({ where: { caseId } }),
    db.caseClarifyMessage.findMany({ where: { caseId, role: "user" }, select: { questionKey: true } }),
  ]);
  const suppressedKeys = new Set(suppressed.map((item) => item.evidenceFactId || item.questionKey));
  const answeredKeys = new Set(answered.map((item) => item.questionKey));
  const plans = [];

  for (const [index, unknown] of unknowns.entries()) {
    const plannedKey = `evidence:${unknown.key}`;
    const isSuppressed = suppressedKeys.has(unknown.key);
    const isAnswered = answeredKeys.has(plannedKey);
    plans.push(await db.caseQuestionPlan.upsert({
      where: { caseId_unknownKey: { caseId, unknownKey: unknown.key } },
      update: {
        question: unknown.question,
        whyItMatters: unknown.reason,
        materiality: materialityForUnknown(unknown.key),
        canExistingEvidenceAnswer: isSuppressed,
        betterSourceAction: isSuppressed ? "Use existing evidence; do not ask the user again." : null,
        priority: index + 1,
        status: isAnswered ? "answered" : isSuppressed ? "suppressed" : "proposed",
      },
      create: {
        caseId,
        unknownKey: unknown.key,
        question: unknown.question,
        whyItMatters: unknown.reason,
        materiality: materialityForUnknown(unknown.key),
        canExistingEvidenceAnswer: isSuppressed,
        betterSourceAction: isSuppressed ? "Use existing evidence; do not ask the user again." : null,
        priority: index + 1,
        status: isAnswered ? "answered" : isSuppressed ? "suppressed" : "proposed",
      },
    }));
  }

  return plans;
}

export async function nextPlannedQuestion(caseId: string) {
  await planCaseQuestions(caseId);
  return db.caseQuestionPlan.findFirst({
    where: { caseId, status: "proposed" },
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
  });
}
