export type QaAudience = "guest" | "free" | "plus" | "pro";

export type QaEntitlement = {
  audience: QaAudience;
  qaEnabled: boolean;
  questionLimit: number | null;
  maxSentences: number | null;
  maxExcerpts: number | null;
  maxFollowUps: number | null;
  personalized: boolean;
  consultantReferral: boolean;
  showRegisterCta: boolean;
  showUpgradeCta: boolean;
  showConsultantCta: boolean;
  allowSaveOptionsCase: boolean;
};

export type QaUsage = {
  used: number;
  remaining: number | null;
  blocked: boolean;
  blockReason: string;
};

export type QaConsultantPreview = {
  name: string;
  credentialLabel: string;
} | null;

export type QaChatAccess = {
  audience: QaAudience;
  remaining: number | null;
  limit: number | null;
  blocked: boolean;
  blockReason: string;
  showRegisterCta: boolean;
  showUpgradeCta: boolean;
  showConsultantCta: boolean;
  allowSaveOptionsCase: boolean;
  consultantName?: string | null;
  linkedCase?: boolean;
  filed?: boolean;
};

export function toQaChatAccess(
  entitlement: QaEntitlement,
  usage: QaUsage,
  consultantName?: string | null,
  linkedCase = false,
  filed = false,
): QaChatAccess {
  const caseThread = linkedCase && entitlement.audience !== "guest";
  return {
    audience: entitlement.audience,
    remaining: caseThread ? null : usage.remaining,
    limit: entitlement.questionLimit,
    blocked: caseThread ? !entitlement.qaEnabled : usage.blocked,
    blockReason: caseThread
      ? (entitlement.qaEnabled ? "" : usage.blockReason)
      : usage.blockReason,
    showRegisterCta: entitlement.showRegisterCta,
    showUpgradeCta: entitlement.showUpgradeCta,
    showConsultantCta: entitlement.showConsultantCta,
    allowSaveOptionsCase: caseThread ? false : entitlement.allowSaveOptionsCase,
    consultantName: consultantName ?? null,
    linkedCase: caseThread,
    filed: caseThread && filed,
  };
}

export const DEFAULT_GUEST_QA = {
  questionLimit: 1,
  maxSentences: 2,
  maxExcerpts: 1,
  maxFollowUps: 1,
};

export const DEFAULT_FREE_QA = {
  questionLimit: 3,
  maxSentences: 3,
  maxExcerpts: 1,
  maxFollowUps: 1,
};

export const THEME_CONSULTANT_SPECIALTIES: Record<string, string[]> = {
  family: ["family"],
  parents_children: ["family"],
  adjustment: ["family"],
  employment: ["employment"],
  student: ["employment"],
  asylum: ["asylum"],
  naturalization: ["naturalization"],
  humanitarian: ["asylum", "removal"],
  visitor: ["international"],
  consular: ["international"],
};

export function consultantSpecialtiesForThemes(themes: string[]): string[] {
  return Array.from(new Set(themes.flatMap((theme) => THEME_CONSULTANT_SPECIALTIES[theme] ?? [])));
}

export function countUserQuestions(history: { role: string }[]): number {
  return history.filter((item) => item.role === "user").length;
}

export function resolveQaEntitlement(input: {
  isGuest: boolean;
  planKey?: string;
  qaEnabled?: boolean;
  qaQuestionLimit?: number | null;
  personalized?: boolean;
  consultantReferral?: boolean;
  guestQuestionLimit?: number;
  guestMaxSentences?: number;
  guestMaxExcerpts?: number;
  guestMaxFollowUps?: number;
  freeMaxSentences?: number;
  freeMaxExcerpts?: number;
  freeMaxFollowUps?: number;
}): QaEntitlement {
  if (input.isGuest) {
    return {
      audience: "guest",
      qaEnabled: true,
      questionLimit: input.guestQuestionLimit ?? DEFAULT_GUEST_QA.questionLimit,
      maxSentences: input.guestMaxSentences ?? DEFAULT_GUEST_QA.maxSentences,
      maxExcerpts: input.guestMaxExcerpts ?? DEFAULT_GUEST_QA.maxExcerpts,
      maxFollowUps: input.guestMaxFollowUps ?? DEFAULT_GUEST_QA.maxFollowUps,
      personalized: false,
      consultantReferral: false,
      showRegisterCta: true,
      showUpgradeCta: false,
      showConsultantCta: true,
      allowSaveOptionsCase: false,
    };
  }
  const planKey = (input.planKey || "free").toLowerCase();
  const audience: QaAudience = planKey === "pro" ? "pro" : planKey === "plus" ? "plus" : "free";
  const personalized = Boolean(input.personalized);
  const consultantReferral = Boolean(input.consultantReferral);
  const qaEnabled = input.qaEnabled !== false;
  const limitedDepth = !personalized;
  return {
    audience,
    qaEnabled,
    questionLimit: input.qaQuestionLimit === undefined
      ? (limitedDepth ? DEFAULT_FREE_QA.questionLimit : null)
      : input.qaQuestionLimit,
    maxSentences: limitedDepth ? (input.freeMaxSentences ?? DEFAULT_FREE_QA.maxSentences) : null,
    maxExcerpts: limitedDepth ? (input.freeMaxExcerpts ?? DEFAULT_FREE_QA.maxExcerpts) : null,
    maxFollowUps: limitedDepth ? (input.freeMaxFollowUps ?? DEFAULT_FREE_QA.maxFollowUps) : null,
    personalized,
    consultantReferral,
    showRegisterCta: false,
    showUpgradeCta: audience !== "pro",
    showConsultantCta: true,
    allowSaveOptionsCase: true,
  };
}

export function qaUsageFromCount(used: number, entitlement: QaEntitlement): QaUsage {
  if (!entitlement.qaEnabled) {
    return { used, remaining: 0, blocked: true, blockReason: "Immigration Q&A is not included in this plan. Upgrade to keep asking." };
  }
  if (entitlement.questionLimit === null) {
    return { used, remaining: null, blocked: false, blockReason: "" };
  }
  const remaining = Math.max(0, entitlement.questionLimit - used);
  if (remaining <= 0) {
    const blockReason = entitlement.audience === "guest"
      ? "Create a free account to keep asking. Paid plans keep a personalized options review, and Pro can match you with a licensed attorney or accredited representative on ImmigrationOnMe."
      : "You have used this month's Q&A questions on the Free plan. Upgrade to Plus for personalized official follow-ups, or Pro to add a matched immigration lawyer or accredited representative.";
    return { used, remaining: 0, blocked: true, blockReason };
  }
  return { used, remaining, blocked: false, blockReason: "" };
}

export function qaMonetizationFooter(
  entitlement: QaEntitlement,
  consultant: QaConsultantPreview = null,
): string {
  const lines: string[] = [];
  if (entitlement.audience === "guest") {
    lines.push("This is a short overview for visitors. Create a free account to ask a few more questions. Paid plans keep a personalized options review from the official material you already matched, and Pro can match you with a licensed immigration attorney or accredited representative on this platform.");
  } else if (entitlement.audience === "free") {
    lines.push("Free accounts get a short official overview. Plus keeps personalized follow-ups from the matching USCIS/DOJ material. Pro adds a matched licensed attorney or accredited representative on ImmigrationOnMe — nothing is shared until you approve.");
  } else if (entitlement.audience === "plus") {
    lines.push("A licensed immigration attorney or accredited representative on this platform can go deeper than this overview. Upgrade to Pro to get a matched professional. Nothing is shared until you approve.");
  }
  if (entitlement.consultantReferral && consultant) {
    lines.push(`A licensed professional on ImmigrationOnMe who works this kind of matter: ${consultant.name}, ${consultant.credentialLabel}. Open Consultants to request a match — nothing is shared until you approve.`);
  } else if (entitlement.consultantReferral) {
    lines.push("Pro includes matching with a licensed immigration attorney or accredited representative on this platform. Open Consultants to request a match when one is available — nothing is shared until you approve.");
  } else if (entitlement.audience === "guest" || entitlement.audience === "free") {
    lines.push("Licensed professionals on ImmigrationOnMe can help with a deeper review of your situation once you have an account and a Pro plan.");
  }
  return lines.join("\n\n");
}

function firstSentences(text: string, count: number): string {
  const parts = text.replace(/\s+/g, " ").trim().split(/(?<=\.)\s+/);
  return parts.slice(0, Math.max(1, count)).join(" ").trim();
}

function trimGeneralAnswer(body: string, maxChars: number): string {
  if (body.length <= maxChars) return body;
  const knowledgeIdx = body.search(/From matching USCIS or DOJ/i);
  if (knowledgeIdx >= 0) {
    const head = body.slice(0, knowledgeIdx).trim();
    const rest = body.slice(knowledgeIdx);
    const headBudget = Math.min(head.length, Math.floor(maxChars * 0.4));
    const keptHead = head.length <= headBudget ? head : `${head.slice(0, headBudget).replace(/\s+\S*$/, "")}`;
    const restBudget = Math.max(120, maxChars - keptHead.length - 2);
    const keptRest = rest.length <= restBudget ? rest : `${rest.slice(0, restBudget).replace(/\s+\S*$/, "")}…`;
    return [keptHead, keptRest].filter(Boolean).join("\n\n");
  }
  return `${body.slice(0, maxChars).replace(/\s+\S*$/, "")}…`;
}

export function limitOfficialExcerpts(knowledge: string, maxExcerpts: number | null, maxSentences: number | null): string {
  const text = knowledge.trim();
  if (!text) return "";
  if (maxExcerpts === null && maxSentences === null) return text;
  const blocks = text.split(/\n\n+/).filter(Boolean);
  const kept = (maxExcerpts === null ? blocks : blocks.slice(0, Math.max(1, maxExcerpts))).map((block) =>
    maxSentences === null ? block : firstSentences(block, maxSentences),
  );
  return kept.join("\n\n");
}

export function countAskedOfficialFollowUps(history: { role: string; content: string }[], prefix: string): number {
  return history.filter((item) => item.role === "assistant" && item.content.includes(prefix)).length;
}

export function shouldAppendOfficialFollowUp(maxFollowUps: number | null | undefined, alreadyAsked: number): boolean {
  if (maxFollowUps === 0) return false;
  if (maxFollowUps == null) return true;
  return alreadyAsked < maxFollowUps;
}

export function applyQaEntitlementToAnswer(
  answer: string,
  entitlement: QaEntitlement,
  options: { followUpLine?: string | null; consultant?: QaConsultantPreview; hasLinkedCase?: boolean } = {},
): string {
  let body = answer.trim();
  const followUp = options.followUpLine?.trim() || "";
  if (followUp && body.includes(followUp)) {
    body = body.replace(followUp, "").trim();
  }
  const skipTrim = entitlement.personalized || Boolean(options.hasLinkedCase && entitlement.audience !== "guest");
  if (!skipTrim) {
    const maxChars = entitlement.audience === "guest" ? 1400 : 1800;
    body = trimGeneralAnswer(body, maxChars);
  }
  const parts = [body];
  if (followUp) parts.push(followUp);
  const footer = qaMonetizationFooter(entitlement, options.consultant ?? null);
  if (footer) parts.push(footer);
  return parts.filter(Boolean).join("\n\n");
}
