import "server-only";
import { db } from "./db";
import { classifyImmigrationInquiry, INQUIRY_MODES } from "./immigration-inquiry";
import { loadBoostsForNarrative } from "./goal-suggestion-store";
import {
  CASE_FILE_QUESTION_KEYS,
  PINNED_QUESTION_KEYS,
  rankFollowUpQuestions,
} from "./goal-suggestions";

function materialityForUnknown(key: string, openOptions: boolean): "HIGH" | "MEDIUM" | "LOW" {
  if (openOptions) {
    return (PINNED_QUESTION_KEYS as readonly string[]).includes(key) ? "HIGH" : "MEDIUM";
  }
  if (/deadline|response|appointment|conflict/i.test(key)) return "HIGH";
  if (/receipt|form|notice|status/i.test(key)) return "MEDIUM";
  return "LOW";
}

export async function planCaseQuestions(caseId: string) {
  const caseRow = await db.case.findUnique({
    where: { id: caseId },
    select: { situation: true, goal: true },
  });
  const inquiry = classifyImmigrationInquiry({ situation: caseRow?.situation, goal: caseRow?.goal });
  const openOptions = inquiry.mode === INQUIRY_MODES.OPEN_OPTIONS;
  const { boosts } = openOptions
    ? await loadBoostsForNarrative(caseRow?.situation ?? "", caseRow?.goal ?? "")
    : { boosts: {} };
  const [unknowns, suppressed, answered] = await Promise.all([
    db.caseUnknown.findMany({ where: { caseId, status: "open" }, orderBy: { createdAt: "asc" } }),
    db.suppressedQuestion.findMany({ where: { caseId } }),
    db.caseClarifyMessage.findMany({ where: { caseId, role: "user" }, select: { questionKey: true } }),
  ]);
  const suppressedKeys = new Set(suppressed.map((item) => item.evidenceFactId || item.questionKey));
  const answeredKeys = new Set(answered.map((item) => item.questionKey));
  const usable = openOptions
    ? unknowns.filter((item) => !CASE_FILE_QUESTION_KEYS.has(item.key))
    : unknowns;
  const ranked = rankFollowUpQuestions(usable, boosts, { openOptions });
  const rankedKeys = new Set(ranked.map((item) => item.key));
  const plans = [];

  if (openOptions) {
    await db.caseQuestionPlan.updateMany({
      where: rankedKeys.size
        ? { caseId, unknownKey: { notIn: [...rankedKeys] }, status: "proposed" }
        : { caseId, status: "proposed" },
      data: { status: "suppressed" },
    });
  }

  for (const [index, unknown] of ranked.entries()) {
    const plannedKey = `evidence:${unknown.key}`;
    const isSuppressed = suppressedKeys.has(unknown.key);
    const isAnswered = answeredKeys.has(plannedKey) || answeredKeys.has(unknown.key) || answeredKeys.has(`question:${unknown.key}`);
    plans.push(await db.caseQuestionPlan.upsert({
      where: { caseId_unknownKey: { caseId, unknownKey: unknown.key } },
      update: {
        question: unknown.question,
        whyItMatters: unknown.reason,
        materiality: materialityForUnknown(unknown.key, openOptions),
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
        materiality: materialityForUnknown(unknown.key, openOptions),
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
