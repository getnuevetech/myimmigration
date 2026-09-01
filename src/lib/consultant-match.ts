export const OPEN_MATCH_STATUSES = ["proposed", "user_accepted", "active"] as const;
export type OpenMatchStatus = (typeof OPEN_MATCH_STATUSES)[number];

export type MatchRequestAudience = "guest" | "free" | "plus" | "pro";

export type MatchRequestEntitlement = {
  audience: MatchRequestAudience;
  consultantReferral: boolean;
  canRequest: boolean;
  showRegisterCta: boolean;
  showUpgradeCta: boolean;
};

export function resolveMatchRequestEntitlement(input: {
  isGuest?: boolean;
  audience?: MatchRequestAudience;
  consultantReferral?: boolean;
}): MatchRequestEntitlement {
  if (input.isGuest || input.audience === "guest") {
    return {
      audience: "guest",
      consultantReferral: false,
      canRequest: false,
      showRegisterCta: true,
      showUpgradeCta: false,
    };
  }
  const audience = input.audience === "pro" ? "pro" : input.audience === "plus" ? "plus" : "free";
  const consultantReferral = Boolean(input.consultantReferral);
  return {
    audience,
    consultantReferral,
    canRequest: consultantReferral && audience === "pro",
    showRegisterCta: false,
    showUpgradeCta: !consultantReferral,
  };
}

export function canRequestConsultantMatch(entitlement: Pick<MatchRequestEntitlement, "canRequest">): boolean {
  return entitlement.canRequest;
}

export function openMatchBlocksNewRequest(existingOpenCount: number): boolean {
  return existingOpenCount > 0;
}

export function customerMatchSharesFiles(status: string): boolean {
  return status === "active";
}

export function assignmentPayloadFromCustomerRequest(input: {
  userId: string;
  consultantId: string;
  caseId?: string | null;
  reasonSummary: string;
  reasonDetail?: string;
}): {
  userId: string;
  consultantId: string;
  caseId: string | null;
  note: string;
  reasonSummary: string;
  reasonDetail: string;
  autoAssigned: false;
  assignedById: string;
  status: "user_accepted";
  userAgreedAt: Date;
} {
  return {
    userId: input.userId,
    consultantId: input.consultantId,
    caseId: input.caseId ?? null,
    note: input.reasonSummary,
    reasonSummary: input.reasonSummary,
    reasonDetail: input.reasonDetail ?? "",
    autoAssigned: false,
    assignedById: input.userId,
    status: "user_accepted",
    userAgreedAt: new Date(),
  };
}

export function consultantSeesCaseDetails(status: string): boolean {
  return status === "active";
}

export function matchRequestBlockReason(entitlement: MatchRequestEntitlement): string {
  if (entitlement.canRequest) return "";
  if (entitlement.audience === "guest") {
    return "**Create a free account** to keep your review. Pro can match you with a **licensed immigration attorney or accredited representative** — nothing is shared until you approve.";
  }
  return "Upgrade to Pro to request a matched **licensed immigration attorney or accredited representative** on ImmigrationOnMe. Nothing is shared until you approve, and the professional still has to accept.";
}
