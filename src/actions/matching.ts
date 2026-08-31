"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { hasFeature } from "@/lib/access";
import { FEATURE_KEYS, ROLES } from "@/lib/constants";
import { classifyImmigrationInquiry } from "@/lib/immigration-inquiry";
import { conversationNarrative } from "@/lib/goal-suggestions";
import {
  assignmentPayloadFromCustomerRequest,
  canRequestConsultantMatch,
  matchRequestBlockReason,
  openMatchBlocksNewRequest,
  resolveMatchRequestEntitlement,
} from "@/lib/consultant-match";
import {
  credentialLabel,
  generateAssignmentReason,
  pickConsultantForCase,
  pickConsultantForThemes,
  rankConsultantsForCase,
} from "@/lib/matching";
import type { ActionState } from "./auth";

function themeReason(name: string, credentialType: string, yearsExperience: number, themes: string[]) {
  const cred = credentialLabel(credentialType);
  const themeLabel = themes.filter((theme) => theme !== "general").join(", ") || "this immigration matter";
  return {
    summary: `${name} (${cred}, ${yearsExperience} yrs) works ${themeLabel} matters on ImmigrationOnMe.`,
    detail: `Customer-requested match. Specialty fit: ${themeLabel}. Nothing is shared until this professional also accepts.`,
  };
}

export async function requestConsultantMatchAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (user.role !== ROLES.USER) return { error: "Only customers can request a professional match." };
  const caseIdRaw = String(formData.get("caseId") ?? "").trim();
  const threadIdRaw = String(formData.get("threadId") ?? "").trim();

  const hasReferral = await hasFeature(user.id, FEATURE_KEYS.CONSULTANT_REFERRAL);
  const entitlement = resolveMatchRequestEntitlement({
    audience: hasReferral ? "pro" : "free",
    consultantReferral: hasReferral,
  });
  if (!canRequestConsultantMatch(entitlement)) {
    return { error: matchRequestBlockReason(entitlement) };
  }

  const ownedCase = caseIdRaw
    ? await db.case.findFirst({
        where: { id: caseIdRaw, userId: user.id },
        select: { id: true, situation: true, goal: true },
      })
    : await db.case.findFirst({
        where: { userId: user.id },
        orderBy: { updatedAt: "desc" },
        select: { id: true, situation: true, goal: true },
      });

  const thread = !ownedCase && threadIdRaw
    ? await db.qaThread.findFirst({
        where: { id: threadIdRaw, userId: user.id },
        include: { messages: { orderBy: { createdAt: "asc" }, select: { role: true, content: true } } },
      })
    : !ownedCase
      ? await db.qaThread.findFirst({
          where: { userId: user.id, caseId: null },
          orderBy: { createdAt: "desc" },
          include: { messages: { orderBy: { createdAt: "asc" }, select: { role: true, content: true } } },
        })
      : null;

  const inquiry = ownedCase
    ? classifyImmigrationInquiry({ situation: ownedCase.situation, goal: ownedCase.goal })
    : thread
      ? classifyImmigrationInquiry({
          situation: conversationNarrative(thread.messages),
          goal: thread.title,
        })
      : null;

  const openCount = await db.consultantAssignment.count({
    where: { userId: user.id, status: { in: ["proposed", "user_accepted", "active"] } },
  });
  if (openMatchBlocksNewRequest(openCount)) {
    redirect("/app/consultants");
  }

  const candidate = ownedCase
    ? (await pickConsultantForCase(ownedCase.id)) ?? (await pickConsultantForThemes(inquiry?.themes ?? []))
    : await pickConsultantForThemes(inquiry?.themes ?? ["general"]);
  if (!candidate) {
    return { error: "No licensed professional is available to match right now. Try again when a specialist who works this kind of matter is on the platform." };
  }

  let reason = themeReason(candidate.name, candidate.credentialType, candidate.yearsExperience, inquiry?.themes ?? []);
  if (ownedCase) {
    const ranked = await rankConsultantsForCase(ownedCase.id).catch(() => []);
    const rankedCandidate = ranked.find((item) => item.userId === candidate.userId) ?? candidate;
    reason = await generateAssignmentReason(ownedCase.id, rankedCandidate).catch(() => reason);
  }

  const payload = assignmentPayloadFromCustomerRequest({
    userId: user.id,
    consultantId: candidate.userId,
    caseId: ownedCase?.id ?? null,
    reasonSummary: reason.summary,
    reasonDetail: reason.detail,
  });
  const assignment = await db.consultantAssignment.create({ data: payload });

  await db.notification.create({
    data: {
      userId: user.id,
      kind: "assignment",
      title: "Match requested — waiting on the professional",
      body: `${candidate.name} has your request. Files stay private until they accept the connection agreement.`,
      link: "/app/consultants",
    },
  });
  await db.notification.create({
    data: {
      userId: candidate.userId,
      kind: "assignment",
      title: "A customer requested a professional match",
      body: "A Pro customer asked to connect with you. Case files stay private until you accept.",
      link: "/consultant",
    },
  });

  revalidatePath("/app/consultants");
  revalidatePath("/consultant");
  const { trackTikTokEventBeforeRedirect } = await import("@/lib/tiktok-events");
  await trackTikTokEventBeforeRedirect({
    event: "Lead",
    eventId: `match-${assignment.id}`,
    email: user.email,
    externalId: user.id,
    contentId: "consultant_match",
    contentName: "Professional match request",
    contentType: "product",
  });
  redirect(`/app/consultants?requested=${assignment.id}`);
}
