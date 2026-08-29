"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser, isAdmin, requireUser } from "@/lib/auth";
import { getOrCreateGuestSession } from "@/lib/guest";
import { saveUpload, validateAvatarFile } from "@/lib/uploads";
import { runQaChat, generateLetterDraft } from "@/lib/ai/orchestrator";
import { verifyUserCasesProgress } from "@/lib/case-progress";
import { featureLimit, hasFeature } from "@/lib/access";
import { FEATURE_KEYS } from "@/lib/constants";
import { loadQaAccess } from "@/lib/qa-quota";
import { classifyImmigrationInquiry, authorityQueriesForInquiry } from "@/lib/immigration-inquiry";
import {
  letterGenerationAllowed,
  letterKindFromNoticeType,
  letterTitleForKind,
  matchingLetterKind,
  normalizeLetterKind,
} from "@/lib/goal-letters";
import { conversationNarrative } from "@/lib/goal-suggestions";
import { previewBestConsultantForThemes } from "@/lib/matching";
import type { ActionState } from "./auth";

// ---------- Profile ----------

export async function updateProfileAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const avatar = formData.get("avatar");
  let avatarPath = user.avatarPath;
  if (avatar instanceof File && avatar.size > 0) {
    const validationError = validateAvatarFile(avatar);
    if (validationError) return { error: validationError };
    const saved = await saveUpload(avatar);
    avatarPath = saved.filePath;
  }
  await db.user.update({
    where: { id: user.id },
    data: {
      firstName: String(formData.get("firstName") ?? user.firstName),
      lastName: String(formData.get("lastName") ?? user.lastName),
      phone: String(formData.get("phone") ?? user.phone),
      address: String(formData.get("address") ?? user.address),
      idNumber: String(formData.get("idNumber") ?? user.idNumber),
      bio: String(formData.get("bio") ?? user.bio),
      avatarPath,
    },
  });
  revalidatePath("/app/profile");
  return { ok: true };
}

// ---------- Q&A ----------

export async function askQuestionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const question = String(formData.get("question") ?? "").trim();
  if (!question) return { error: "Type a question first." };
  const threadId = String(formData.get("threadId") ?? "");
  const requestedCaseId = String(formData.get("caseId") ?? "") || null;
  const user = await getCurrentUser();
  const guest = user ? null : await getOrCreateGuestSession();

  let thread;
  if (threadId) {
    thread = await db.qaThread.findUnique({ where: { id: threadId }, include: { messages: { orderBy: { createdAt: "asc" } } } });
    if (!thread) return { error: "Conversation not found." };
    if (user ? thread.userId !== user.id : true) {
      if (thread.guestSessionId !== guest?.id) return { error: "Conversation not found." };
    }
  }

  let ownedCaseId: string | null = null;
  if (user && requestedCaseId) {
    const c = await db.case.findFirst({ where: { id: requestedCaseId, userId: user.id }, select: { id: true } });
    ownedCaseId = c?.id ?? null;
  }
  const linkedCase = Boolean(thread?.caseId || ownedCaseId);
  const access = await loadQaAccess({ userId: user?.id, guestSessionId: guest?.id });
  if (!access.entitlement.qaEnabled) {
    return { error: "Immigration Q&A is not included in this plan. Upgrade to keep asking." };
  }
  if (!linkedCase && access.usage.blocked) return { error: access.usage.blockReason };

  const {
    runConversationIntelligence,
    composeAssistantReply,
    priorContractFromStored,
    enrichIntelligenceWithReasoningModel,
  } = await import("@/lib/conversation");
  const prior = thread?.messages.map((m) => ({ role: m.role, content: m.content })) ?? [];
  const priorContract = priorContractFromStored(thread?.intelligenceJson);
  const intelInput = {
    message: question,
    history: prior,
    documentCount: 0,
    priorContract,
  };
  let intel = runConversationIntelligence(intelInput);
  // Phase −1.7: optional Sol enrichment when heuristic routing confidence is low.
  intel = await enrichIntelligenceWithReasoningModel(intel, intelInput);

  // If the router selects case on an explicit comprehensive ask from Q&A, still answer in-thread
  // unless the user uses the promote CTA — keep A first-class.
  if (!thread) {
    thread = await db.qaThread.create({
      data: {
        userId: user?.id ?? null,
        guestSessionId: guest?.id ?? null,
        caseId: ownedCaseId,
        title: question.slice(0, 60),
        intelligenceJson: JSON.stringify(intel),
      },
      include: { messages: true },
    });
  } else {
    await db.qaThread.update({
      where: { id: thread.id },
      data: { intelligenceJson: JSON.stringify(intel) },
    });
  }

  await db.qaMessage.create({ data: { threadId: thread.id, role: "user", content: question } });
  const history = [...thread.messages.map((m) => ({ role: m.role, content: m.content })), { role: "user", content: question }];
  const narrative = conversationNarrative(history) || question;
  const inquiry = classifyImmigrationInquiry({ situation: narrative, goal: narrative });
  const consultant = access.entitlement.consultantReferral
    ? await previewBestConsultantForThemes(inquiry.themes).catch(() => null)
    : null;

  let answer: string;
  const useScaffold =
    intel.strategy.branch_before_clarify ||
    ["petition_eligibility_overview", "explain_document_or_notice", "document_checklist"].includes(
      intel.question_contract.decision_target,
    );
  if (useScaffold) {
    answer = composeAssistantReply(intel, question);
  } else {
    answer = await runQaChat(history, {
      caseId: thread.caseId,
      entitlement: access.entitlement,
      consultant,
    });
    if (intel.strategy.ask_now[0] && !/upload (your|the) (notice|document)/i.test(intel.strategy.ask_now[0].question)) {
      const tip = intel.strategy.ask_now[0].question;
      if (!answer.toLowerCase().includes(tip.slice(0, 32).toLowerCase())) {
        answer = `${answer}\n\nTo narrow this: ${tip}`;
      }
    }
  }

  await db.qaMessage.create({ data: { threadId: thread.id, role: "assistant", content: answer } });

  if (!threadId) redirect(user ? `/app/qa/${thread.id}` : `/start/qa?thread=${thread.id}`);
  revalidatePath(`/app/qa/${thread.id}`);
  revalidatePath("/app/qa");
  revalidatePath("/start/qa");
  return { ok: true };
}

// ---------- Deadlines ----------

export async function addDeadlineAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const title = String(formData.get("title") ?? "").trim();
  const dueDate = String(formData.get("dueDate") ?? "");
  if (!title || !dueDate) return { error: "Title and date are required." };
  await db.deadline.create({
    data: {
      userId: user.id,
      title,
      dueDate: new Date(dueDate),
      remindDaysBefore: Number(formData.get("remindDaysBefore") ?? 7) || 7,
    },
  });
  revalidatePath("/app/deadlines");
  return { ok: true };
}

export async function setDeadlineStatusAction(id: string, status: "open" | "done") {
  const user = await requireUser();
  const d = await db.deadline.findUnique({ where: { id } });
  if (!d || d.userId !== user.id) return;
  await db.deadline.update({ where: { id }, data: { status } });
  revalidatePath("/app/deadlines");
}

// ---------- Response letters ----------

export async function generateLetterAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const staff = isAdmin(user);
  const enabled = staff || (await hasFeature(user.id, FEATURE_KEYS.LETTERS));
  const limit = staff ? null : await featureLimit(user.id, FEATURE_KEYS.LETTERS);
  const used = await db.responseLetter.count({ where: { userId: user.id } });
  const quota = letterGenerationAllowed({
    canGenerate: enabled,
    used,
    limit: enabled ? limit : 0,
  });
  if (!quota.allowed) {
    if (!enabled) return { error: "USCIS letters are not included in your plan. Upgrade to Plus to generate letters." };
    return { error: "You've used all letters included in Plus. Upgrade to Pro for unlimited letters." };
  }
  const context = String(formData.get("context") ?? "").trim();
  const noticeId = String(formData.get("noticeId") ?? "") || null;
  let caseId = String(formData.get("caseId") ?? "") || null;
  let kind = normalizeLetterKind(String(formData.get("kind") ?? ""));
  if (context.length < 20) return { error: "Describe what the letter should address (a few sentences)." };

  let noticeContext = "";
  let noticeType: string | null = null;
  if (noticeId) {
    const notice = await db.notice.findUnique({ where: { id: noticeId } });
    if (notice && notice.userId === user.id) {
      noticeType = notice.noticeType;
      noticeContext = `Notice type: ${notice.noticeType}. Matter year: ${notice.caseYear ?? "unknown"}. Explanation: ${notice.explanation}`;
      caseId = caseId ?? notice.caseId;
    }
  }
  const scopedCase = caseId
    ? await db.case.findFirst({
        where: { id: caseId, userId: user.id },
        select: {
          id: true,
          situation: true,
          goal: true,
          issues: { select: { title: true, uscisBasis: true, conclusion: true } },
        },
      })
    : null;
  if (caseId && !scopedCase) caseId = null;
  if (!kind && scopedCase) {
    const inquiry = classifyImmigrationInquiry({ situation: scopedCase.situation, goal: scopedCase.goal });
    kind = matchingLetterKind({
      themes: inquiry.themes,
      inquiryMode: inquiry.mode,
      query: `${scopedCase.situation} ${scopedCase.goal}`,
      authorityQueries: authorityQueriesForInquiry(inquiry),
      sources: scopedCase.issues.map((issue) => ({
        reference: issue.uscisBasis,
        title: issue.title,
        content: issue.conclusion,
      })),
      noticeTypes: noticeType ? [noticeType] : [],
    });
  }
  if (!kind && noticeType) kind = letterKindFromNoticeType(noticeType);

  const body = await generateLetterDraft([noticeContext, context].filter(Boolean).join("\n\n"), { caseId, kind });
  const letter = await db.responseLetter.create({
    data: { userId: user.id, caseId, noticeId, title: letterTitleForKind(kind), body },
  });
  await verifyUserCasesProgress(user.id);
  redirect(`/app/letters/${letter.id}`);
}

export async function updateLetterAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const letter = await db.responseLetter.findUnique({ where: { id } });
  if (!letter || letter.userId !== user.id) return { error: "Letter not found." };
  await db.responseLetter.update({
    where: { id },
    data: {
      title: String(formData.get("title") ?? letter.title),
      body: String(formData.get("body") ?? letter.body),
      status: String(formData.get("status") ?? letter.status),
    },
  });
  revalidatePath(`/app/letters/${id}`);
  return { ok: true };
}

// ---------- Consultant assignment consent ----------

export async function respondToAssignmentAction(assignmentId: string, accept: boolean) {
  const user = await requireUser();
  const a = await db.consultantAssignment.findUnique({ where: { id: assignmentId } });
  if (!a || a.userId !== user.id || a.status !== "proposed") return;
  if (!accept) {
    await db.consultantAssignment.update({ where: { id: assignmentId }, data: { status: "declined" } });
  } else {
    // User consent recorded; becomes active once the consultant also agrees.
    await db.consultantAssignment.update({
      where: { id: assignmentId },
      data: { status: a.consultantAgreedAt ? "active" : "user_accepted", userAgreedAt: new Date() },
    });
    await db.notification.create({
      data: {
        userId: a.consultantId,
        kind: "assignment",
        title: "A client accepted your assignment",
        body: "Review and accept the connection agreement to begin.",
        link: "/consultant",
      },
    });
  }
  revalidatePath("/app/consultants");
}

// ---------- Notifications ----------

export async function markNotificationReadAction(id: string) {
  const user = await requireUser();
  await db.notification.updateMany({ where: { id, userId: user.id }, data: { readAt: new Date() } });
  revalidatePath("/app");
}
