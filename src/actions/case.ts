"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, requireUser, isAdmin, hasAdminArea } from "@/lib/auth";
import { getOrCreateGuestSession } from "@/lib/guest";
import { runCaseAnalysis } from "@/lib/ai/orchestrator";
import { verifyCaseProgress, isVerifiable } from "@/lib/case-progress";
import { saveUpload, validateUploadFile } from "@/lib/uploads";
import { processDocumentsEvidence } from "@/lib/evidence/document-processing";
import { recordSuggestionsForCase } from "@/lib/goal-suggestion-store";
import { suggestionQuestionKey } from "@/lib/goal-suggestions";
import { matchingDocumentKind } from "@/lib/goal-documents";
import { authorityQueriesForInquiry, classifyImmigrationInquiry } from "@/lib/immigration-inquiry";
import type { ActionState } from "./auth";

function matchingKindForNarrative(situation: string, goal: string, noticeTypes?: string[]): string {
  const inquiry = classifyImmigrationInquiry({ situation, goal });
  return matchingDocumentKind({
    themes: inquiry.themes,
    inquiryMode: inquiry.mode,
    query: `${situation} ${goal}`,
    authorityQueries: authorityQueriesForInquiry(inquiry),
    noticeTypes,
  }) ?? "identity";
}

// Guest-friendly intake: Phase −1 routes question-shaped messages to Assistant (Pipeline A),
// not the Case engine — unless the Conversation Router selects case development.
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
  if (user && files.length) {
    const { documentQuotaError } = await import("@/actions/documents");
    const quotaError = await documentQuotaError(user.id, files.length);
    if (quotaError) return { error: quotaError };
  }
  const guest = user ? null : await getOrCreateGuestSession();

  const { runConversationIntelligence, composeAssistantReply } = await import("@/lib/conversation");
  const intel = runConversationIntelligence({
    message: situation,
    goal,
    documentCount: files.length,
    documentHints: files.map((f) => f.name),
    // Customer forceCase removed — admin diagnostic only if explicitly posted by staff tools.
    forceCase: false,
  });

  // Phase S: response_mode controls Case engine; workspace selects persistence.
  // Situation / question paths never run V5.1.
  if (!intel.route.invokes_case_engine) {
    let answer = composeAssistantReply(intel, [situation, goal ? `Goal: ${goal}` : ""].filter(Boolean).join("\n\n"));
    try {
      const { runQaChat } = await import("@/lib/ai/orchestrator");
      const { loadQaAccess } = await import("@/lib/qa-quota");
      const access = await loadQaAccess({ userId: user?.id, guestSessionId: guest?.id });
      if (
        !intel.strategy.branch_before_clarify &&
        !["petition_eligibility_overview", "explain_document_or_notice", "document_checklist"].includes(
          intel.question_contract.decision_target,
        )
      ) {
        if (access.entitlement.qaEnabled) {
          const opening = [situation, goal ? `Goal: ${goal}` : ""].filter(Boolean).join("\n\n");
          answer = await runQaChat([{ role: "user", content: opening }], {
            entitlement: access.entitlement,
          });
          if (intel.strategy.ask_now[0] && !answer.includes(intel.strategy.ask_now[0].question.slice(0, 40))) {
            answer = `${answer}\n\nTo determine which path applies: ${intel.strategy.ask_now[0].question}`;
          }
        }
      }
    } catch {
      /* keep composed answer */
    }

    if (intel.route.workspace === "situation" || intel.route.workspace === "filing_plan") {
      const { createSituationFromIntelligence } = await import("@/lib/situation-create");
      const created = await createSituationFromIntelligence({
        situation,
        goal,
        intel,
        assistantReply: answer,
        files,
      });
      const { trackTikTokEventBeforeRedirect } = await import("@/lib/tiktok-events");
      await trackTikTokEventBeforeRedirect({
        event: "Lead",
        eventId: `sit-${created.id}`,
        email: user?.email,
        externalId: user?.id,
        contentId: "situation_start",
        contentName: "Situation intake",
        contentType: "product",
      });
      redirect(created.userId ? `/app/situations/${created.id}` : `/start/situation?id=${created.id}`);
    }

    // question_only (and existing_case + answer without case_review) → QaThread
    const opening = [situation, goal ? `Goal: ${goal}` : ""].filter(Boolean).join("\n\n");
    const thread = await db.qaThread.create({
      data: {
        userId: user?.id ?? null,
        guestSessionId: user ? null : guest!.id,
        title: (intel.question_contract.explicit_question || situation).slice(0, 60),
        kind: "qa",
        intelligenceJson: JSON.stringify(intel),
      },
    });
    const docKind = matchingKindForNarrative(situation, goal);
    for (const file of files.slice(0, 10)) {
      const { filePath, sizeBytes } = await saveUpload(file);
      await db.document.create({
        data: {
          userId: user?.id ?? null,
          guestSessionId: user ? null : guest!.id,
          fileName: file.name,
          filePath,
          mimeType: file.type || "application/octet-stream",
          sizeBytes,
          docKind,
        },
      });
    }
    await db.qaMessage.create({ data: { threadId: thread.id, role: "user", content: opening } });
    await db.qaMessage.create({ data: { threadId: thread.id, role: "assistant", content: answer } });
    redirect(user ? `/app/qa/${thread.id}` : `/start/qa?thread=${thread.id}`);
  }

  // response_mode = case_review → V5.1 Case engine only
  let caseId: string;
  const intelligenceJson = JSON.stringify(intel);
  const { detectGovernmentMatter } = await import("@/lib/conversation");
  const { primaryGovernmentSystem } = await import("@/lib/situation-reclassify");
  const matter = detectGovernmentMatter([situation, goal].join("\n"), files.map((f) => f.name));
  const governmentSystem = primaryGovernmentSystem(matter.systems) || (matter.existing_government_case ? "uscis" : "");
  if (user) {
    const c = await db.case.create({
      data: {
        userId: user.id,
        title: situation.slice(0, 80),
        situation,
        goal,
        intelligenceJson,
        governmentSystem,
      },
    });
    caseId = c.id;
  } else {
    await db.guestSession.update({ where: { id: guest!.id }, data: { situation, goal } });
    const c = await db.case.create({
      data: {
        guestSessionId: guest!.id,
        title: situation.slice(0, 80),
        situation,
        goal,
        intelligenceJson,
        governmentSystem,
      },
    });
    caseId = c.id;
  }

  const documentIds: string[] = [];
  const docKind = matchingKindForNarrative(situation, goal);
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
        docKind,
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

  const { runConversationIntelligence, composeAssistantReply } = await import("@/lib/conversation");
  const intel = runConversationIntelligence({
    message: situation,
    goal,
    forceCase: false,
  });

  if (!intel.route.invokes_case_engine) {
    const opening = [situation, goal ? `Goal: ${goal}` : ""].filter(Boolean).join("\n\n");
    const answer = composeAssistantReply(intel, opening);
    if (intel.route.workspace === "situation" || intel.route.workspace === "filing_plan") {
      const { createSituationFromIntelligence } = await import("@/lib/situation-create");
      const created = await createSituationFromIntelligence({
        situation,
        goal,
        intel,
        assistantReply: answer,
      });
      redirect(`/app/situations/${created.id}`);
    }
    const thread = await db.qaThread.create({
      data: {
        userId: user.id,
        title: (intel.question_contract.explicit_question || situation).slice(0, 60),
        intelligenceJson: JSON.stringify(intel),
      },
    });
    await db.qaMessage.create({ data: { threadId: thread.id, role: "user", content: opening } });
    await db.qaMessage.create({
      data: { threadId: thread.id, role: "assistant", content: answer },
    });
    redirect(`/app/qa/${thread.id}`);
  }

  const { detectGovernmentMatter } = await import("@/lib/conversation");
  const { primaryGovernmentSystem } = await import("@/lib/situation-reclassify");
  const matter = detectGovernmentMatter([situation, goal].join("\n"));
  const c = await db.case.create({
    data: {
      userId: user.id,
      title: situation.slice(0, 80),
      situation,
      goal,
      status: "analyzing",
      intelligenceJson: JSON.stringify(intel),
      governmentSystem:
        primaryGovernmentSystem(matter.systems) || (matter.existing_government_case ? "uscis" : ""),
    },
  });
  after(() => runCaseAnalysis(c.id).catch(async (err) => {
    const { logSystem } = await import("@/lib/syslog");
    await logSystem("error", "analysis", "Background case analysis failed", String(err));
  }));
  redirect(`/app/cases/${c.id}`);
}

/** Admin-only: live re-analysis of the case (writes customer-facing output). Does not open the compare lab. */
export async function reanalyzeCaseAction(caseId: string) {
  const user = await requireUser();
  if (!isAdmin(user) || !hasAdminArea(user, "admin.cases")) return;
  const c = await db.case.findUnique({ where: { id: caseId }, select: { id: true } });
  if (!c) return;
  await db.case.update({ where: { id: caseId }, data: { status: "analyzing" } });
  after(() =>
    runCaseAnalysis(caseId).catch(async (err) => {
      const { logSystem } = await import("@/lib/syslog");
      await logSystem("error", "analysis", "Admin re-run analysis failed", String(err));
    }),
  );
  revalidatePath(`/admin/cases/${caseId}`);
  revalidatePath(`/app/cases/${caseId}`);
  redirect(`/admin/cases/${caseId}`);
}

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
  if (files.length) {
    const { documentQuotaError } = await import("@/actions/documents");
    const quotaError = await documentQuotaError(user.id, files.length);
    if (quotaError) return { error: quotaError };
  }

  const { nextClarifyQuestion } = await import("@/lib/clarify");
  const q = await nextClarifyQuestion(caseId);
  if (!q) return { error: "All questions are already answered — the analysis is up to date." };

  // Attached files go straight into the customer's vault as case documents,
  // where the re-analysis below picks them up as evidence.
  const attachedNames: string[] = [];
  const documentIds: string[] = [];
  const docKind = matchingKindForNarrative(c.situation, c.goal);
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
        docKind,
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
  const { reportedFactsFromAnswer } = await import("@/lib/situation-brief");
  const reported = reportedFactsFromAnswer(answerWithFiles);
  if (reported.length) {
    const existing = await db.evidenceFact.findMany({
      where: { caseId, provenance: "USER_REPORTED" },
      select: { key: true, value: true },
    });
    const have = new Set(existing.map((item) => `${item.key}:${item.value}`));
    const fresh = reported.filter((item) => !have.has(`${item.key}:${item.value}`));
    if (fresh.length) {
      await db.evidenceFact.createMany({
        data: fresh.map((item) => ({
          caseId,
          key: item.key,
          value: item.value,
          confidence: "needs_verification",
          provenance: "USER_REPORTED",
          verificationState: "EXTRACTED",
          sourceText: answerWithFiles.slice(0, 500),
        })),
      });
    }
  }
  await db.case.update({
    where: { id: caseId },
    data: { status: "analyzing" },
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

  const { mayPromoteAssistantToCase, runConversationIntelligence } = await import("@/lib/conversation");
  const { classifyImmigrationInquiry, INQUIRY_MODES } = await import("@/lib/immigration-inquiry");
  const {
    answeredOfficialPairs,
    conversationNarrative,
    qaConversationCanSaveAsOptionsCase,
    suggestionQuestionKey,
    workingQaNarrative,
  } = await import("@/lib/goal-suggestions");
  const history = thread.messages.map((item) => ({ role: item.role, content: item.content }));
  const userNarrative = conversationNarrative(history);
  const intel = runConversationIntelligence({ message: userNarrative, history });
  // This action is only reachable via an explicit "save / develop as case" CTA — never auto-promoted from upload.
  const promotion = mayPromoteAssistantToCase({
    contract: { ...intel.question_contract, requires_case_development: true },
    userExplicitlyRequestsCase: true,
    documentCount: 0,
  });
  if (!promotion.allowed) {
    return { error: promotion.reason };
  }
  if (!qaConversationCanSaveAsOptionsCase(history, thread.caseId) && formData.get("forceCase") !== "on") {
    return { error: "Answer at least one official follow-up first so those facts can go on the options review." };
  }
  const inquiry = classifyImmigrationInquiry({ situation: userNarrative, goal: userNarrative });
  if (inquiry.mode !== INQUIRY_MODES.OPEN_OPTIONS && formData.get("forceCase") !== "on") {
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
      intelligenceJson: JSON.stringify({ ...intel, question_contract: { ...intel.question_contract, requires_case_development: true } }),
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
  const { trackTikTokEventBeforeRedirect } = await import("@/lib/tiktok-events");
  await trackTikTokEventBeforeRedirect({
    event: "AddToWishlist",
    eventId: `opts-${c.id}`,
    email: user.email,
    externalId: user.id,
    contentId: "options_review_save",
    contentName: "Saved options review",
    contentType: "product",
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
