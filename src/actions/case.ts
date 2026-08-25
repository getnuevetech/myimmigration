"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, requireUser } from "@/lib/auth";
import { getOrCreateGuestSession } from "@/lib/guest";
import { runCaseAnalysis } from "@/lib/ai/orchestrator";
import { verifyCaseProgress, isVerifiable } from "@/lib/case-progress";
import { saveUpload, validateUploadFile } from "@/lib/uploads";
import { processDocumentsEvidence } from "@/lib/evidence/document-processing";
import { recordSuggestionsForCase } from "@/lib/goal-suggestion-store";
import { suggestionQuestionKey } from "@/lib/goal-suggestions";
import type { ActionState } from "./auth";

// Guest-friendly intake: situation + goal + documents, no account required.
export async function startIntakeAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const situation = String(formData.get("situation") ?? "").trim();
  const goal = String(formData.get("goal") ?? "").trim();
  if (situation.length < 20) return { error: "Tell us a bit more about what happened (at least a few sentences)." };
  if (goal.length < 5) return { error: "Tell us what you'd like to achieve." };

  // Validate uploaded files before creating any records.
  const files = formData.getAll("documents").filter((f): f is File => f instanceof File && f.size > 0);
  for (const file of files.slice(0, 10)) {
    const validationError = validateUploadFile(file);
    if (validationError) return { error: validationError };
  }

  const user = await getCurrentUser();
  // Capture the guest session once so all documents reference the same session.
  const guest = user ? null : await getOrCreateGuestSession();
  let caseId: string;
  if (user) {
    const c = await db.case.create({
      data: { userId: user.id, title: situation.slice(0, 80), situation, goal },
    });
    caseId = c.id;
  } else {
    await db.guestSession.update({ where: { id: guest!.id }, data: { situation, goal } });
    const c = await db.case.create({
      data: { guestSessionId: guest!.id, title: situation.slice(0, 80), situation, goal },
    });
    caseId = c.id;
  }

  // Attach uploaded documents.
  const documentIds: string[] = [];
  for (const file of files.slice(0, 10)) {
    const { filePath, sizeBytes } = await saveUpload(file);
    const doc = await db.document.create({
      data: {
        userId: user?.id ?? null,
        guestSessionId: user ? null : guest!.id,
        caseId,
        fileName: file.name,
        filePath,
        mimeType: file.type || "application/octet-stream",
        sizeBytes,
      },
    });
    documentIds.push(doc.id);
  }

  await db.case.update({ where: { id: caseId }, data: { status: "analyzing" } });
  after(async () => {
    const { logSystem } = await import("@/lib/syslog");
    try {
      await processDocumentsEvidence(documentIds);
    } catch (err) {
      await logSystem("error", "evidence", "Background intake evidence processing failed", String(err));
    }
    try {
      await runCaseAnalysis(caseId);
    } catch (err) {
      await logSystem("error", "analysis", "Background intake analysis failed", String(err));
    }
  });
  redirect(user ? `/app/cases/${caseId}` : `/start/result?case=${caseId}`);
}

export async function createCaseAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const situation = String(formData.get("situation") ?? "").trim();
  const goal = String(formData.get("goal") ?? "").trim();
  if (situation.length < 20) return { error: "Describe your situation in a few sentences." };
  const c = await db.case.create({
    data: { userId: user.id, title: situation.slice(0, 80), situation, goal, status: "analyzing" },
  });
  after(() => runCaseAnalysis(c.id).catch(async (err) => {
    const { logSystem } = await import("@/lib/syslog");
    await logSystem("error", "analysis", "Background case analysis failed", String(err));
  }));
  redirect(`/app/cases/${c.id}`);
}

export async function reanalyzeCaseAction(caseId: string) {
  const user = await requireUser();
  const c = await db.case.findUnique({ where: { id: caseId } });
  if (!c || c.userId !== user.id) return;
  await db.case.update({ where: { id: caseId }, data: { status: "analyzing" } });
  after(async () => {
    try {
      await runCaseAnalysis(caseId);
    } catch (err) {
      const { logSystem } = await import("@/lib/syslog");
      await logSystem("error", "analysis", "Background re-analysis failed", String(err));
      await db.case.update({ where: { id: caseId }, data: { status: "analyzed" } }).catch(() => null);
    }
  });
  revalidatePath(`/app/cases/${caseId}`);
}

// Clarifying interview: store the Q&A, fold the answer into the case
// narrative in extraction-friendly phrasing, and re-run the analysis so the
// customer immediately sees sharper findings.
export async function clarifyAnswerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const caseId = String(formData.get("caseId") ?? "");
  const answer = String(formData.get("answer") ?? "").trim();
  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  const c = await db.case.findUnique({ where: { id: caseId } });
  if (!c || c.userId !== user.id) return { error: "Case not found." };
  if (!answer && files.length === 0) return { error: "Type an answer (or attach a file) first." };
  const { loadSuggestionAccess } = await import("@/lib/suggestion-quota");
  const suggestionAccess = await loadSuggestionAccess({ userId: user.id, caseId });
  if (suggestionAccess.usage.blocked) return { error: suggestionAccess.usage.blockReason };
  for (const f of files) {
    const validationError = validateUploadFile(f);
    if (validationError) return { error: validationError };
  }

  const { nextClarifyQuestion, situationLine } = await import("@/lib/clarify");
  const q = await nextClarifyQuestion(caseId);
  if (!q) return { error: "All questions are already answered — the analysis is up to date." };

  // Attached files go straight into the customer's vault as case documents,
  // where the re-analysis below picks them up as evidence.
  const attachedNames: string[] = [];
  const documentIds: string[] = [];
  for (const file of files.slice(0, 10)) {
    const { filePath, sizeBytes } = await saveUpload(file);
    const doc = await db.document.create({
      data: {
        userId: user.id,
        caseId,
        fileName: file.name,
        filePath,
        mimeType: file.type || "application/octet-stream",
        sizeBytes,
        docKind: "other",
      },
    });
    attachedNames.push(file.name);
    documentIds.push(doc.id);
  }
  const answerWithFiles = [answer, attachedNames.length ? `(attached: ${attachedNames.join(", ")})` : ""]
    .filter(Boolean)
    .join(" ");

  await db.caseClarifyMessage.create({
    data: { caseId, role: "assistant", questionKey: q.key, content: q.text },
  });
  await db.caseClarifyMessage.create({
    data: { caseId, role: "user", questionKey: q.key, content: answerWithFiles.slice(0, 2000) },
  });
  await recordSuggestionsForCase(caseId, ["ADD_CASE_DETAILS", suggestionQuestionKey(q.key)].filter(Boolean), "completed");
  await db.case.update({
    where: { id: caseId },
    data: {
      situation: `${c.situation}\n\n${situationLine(q.key, q.text, answerWithFiles)}`,
      status: "analyzing",
    },
  });
  // The multi-model re-analysis can take minutes — never block the button on
  // it. The answer is saved instantly; the analysis runs after the response
  // and the case page live-refreshes while status is "analyzing".
  after(async () => {
    const { logSystem } = await import("@/lib/syslog");
    try {
      await processDocumentsEvidence(documentIds);
    } catch (err) {
      await logSystem("error", "evidence", "Background clarify evidence processing failed", String(err));
    }
    try {
      await runCaseAnalysis(caseId);
    } catch (err) {
      await logSystem("error", "analysis", "Background re-analysis after a clarify answer failed", String(err));
      await db.case.update({ where: { id: caseId }, data: { status: "analyzed" } }).catch(() => null);
    }
  });
  revalidatePath(`/app/cases/${caseId}`);
  return { ok: true };
}

export async function createOptionsCaseFromQaAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const threadId = String(formData.get("threadId") ?? "");
  if (!threadId) return { error: "Conversation not found." };
  const user = await getCurrentUser();
  const guest = user ? null : await getOrCreateGuestSession();
  const thread = await db.qaThread.findUnique({
    where: { id: threadId },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!thread) return { error: "Conversation not found." };
  if (user ? thread.userId !== user.id : thread.guestSessionId !== guest?.id) {
    return { error: "Conversation not found." };
  }
  if (!user) {
    return { error: "Create a free account to keep these answers as a personalized options review. Paid plans continue the official follow-ups, and Pro can match you with a licensed professional on ImmigrationOnMe." };
  }
  if (thread.caseId) {
    redirect(user ? `/app/cases/${thread.caseId}` : `/start/result?case=${thread.caseId}`);
  }

  const { classifyImmigrationInquiry, INQUIRY_MODES } = await import("@/lib/immigration-inquiry");
  const {
    answeredOfficialPairs,
    conversationNarrative,
    qaConversationCanSaveAsOptionsCase,
    suggestionQuestionKey,
    workingQaNarrative,
  } = await import("@/lib/goal-suggestions");
  const history = thread.messages.map((item) => ({ role: item.role, content: item.content }));
  if (!qaConversationCanSaveAsOptionsCase(history, thread.caseId)) {
    return { error: "Answer at least one official follow-up first so those facts can go on the options review." };
  }
  const userNarrative = conversationNarrative(history);
  const inquiry = classifyImmigrationInquiry({ situation: userNarrative, goal: userNarrative });
  if (inquiry.mode !== INQUIRY_MODES.OPEN_OPTIONS) {
    return { error: "This conversation is about a filed case. Start from that notice instead of an options review." };
  }

  const firstQuestion = history.find((item) => item.role === "user")?.content.trim() || userNarrative;
  const situation = workingQaNarrative(history) || firstQuestion;
  const c = await db.case.create({
    data: {
      userId: user?.id ?? null,
      guestSessionId: user ? null : guest!.id,
      title: firstQuestion.slice(0, 80),
      situation,
      goal: firstQuestion.slice(0, 500),
      status: "analyzing",
    },
  });
  const pairs = answeredOfficialPairs(history);
  for (const pair of pairs) {
    const key = `evidence:${pair.key}`;
    await db.caseClarifyMessage.create({
      data: { caseId: c.id, role: "assistant", questionKey: key, content: pair.question },
    });
    await db.caseClarifyMessage.create({
      data: { caseId: c.id, role: "user", questionKey: key, content: pair.answer.slice(0, 2000) },
    });
  }
  await db.qaThread.update({ where: { id: thread.id }, data: { caseId: c.id } });
  await recordSuggestionsForCase(
    c.id,
    ["ADD_CASE_DETAILS", ...pairs.map((pair) => suggestionQuestionKey(pair.key))].filter(Boolean),
    "completed",
  );
  after(async () => {
    const { logSystem } = await import("@/lib/syslog");
    try {
      await runCaseAnalysis(c.id);
    } catch (err) {
      await logSystem("error", "analysis", "Background options-review analysis from Q&A failed", String(err));
      await db.case.update({ where: { id: c.id }, data: { status: "analyzed" } }).catch(() => null);
    }
  });
  redirect(user ? `/app/cases/${c.id}` : `/start/result?case=${c.id}`);
}

export async function completePathStepAction(stepId: string) {
  const user = await requireUser();
  const step = await db.pathStep.findUnique({ where: { id: stepId }, include: { case: true } });
  if (!step || step.case.userId !== user.id) return;
  // Verifiable steps can never be checked off blindly — they complete only
  // when the evidence exists, which the verifier below re-checks.
  if (!isVerifiable(step.actionKey)) {
    await db.pathStep.update({ where: { id: stepId }, data: { status: "done" } });
  }
  if (step.actionKey) await recordSuggestionsForCase(step.caseId, [step.actionKey], "completed");
  await verifyCaseProgress(step.caseId);
  revalidatePath(`/app/cases/${step.caseId}`);
}

// "Check my progress" — re-evaluates every step against real evidence.
export async function checkCaseProgressAction(caseId: string) {
  const user = await requireUser();
  const c = await db.case.findUnique({ where: { id: caseId } });
  if (!c || c.userId !== user.id) return;
  await verifyCaseProgress(caseId);
  revalidatePath(`/app/cases/${caseId}`);
}
