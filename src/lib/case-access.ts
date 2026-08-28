import "server-only";
import { db } from "./db";
import { getCurrentUser, isAdmin, type CurrentUser } from "./auth";
import { getGuestSession } from "./guest";
import { ROLES } from "./constants";

export type CaseAccessSubject =
  | { kind: "user"; user: CurrentUser }
  | { kind: "guest"; guestSessionId: string };

export type CaseAccessResult = {
  allowed: boolean;
  reason?: string;
  /** Active consultant assignment used for access, if any. */
  assignmentId?: string;
  /** When set on the assignment, access is limited to this case. */
  scopedCaseId?: string | null;
};

/**
 * Central case ACL: owner, matching guest, admin, or active consultant.
 * If the consultant assignment has caseId set, access is limited to that case.
 */
export async function canAccessCase(
  caseId: string,
  subject?: CaseAccessSubject | null,
): Promise<CaseAccessResult> {
  const c = await db.case.findUnique({
    where: { id: caseId },
    select: { id: true, userId: true, guestSessionId: true },
  });
  if (!c) return { allowed: false, reason: "not_found" };

  let actor = subject;
  if (!actor) {
    const user = await getCurrentUser();
    if (user) actor = { kind: "user", user };
    else {
      const guest = await getGuestSession();
      if (guest) actor = { kind: "guest", guestSessionId: guest.id };
    }
  }
  if (!actor) return { allowed: false, reason: "unauthenticated" };

  if (actor.kind === "guest") {
    if (c.guestSessionId && c.guestSessionId === actor.guestSessionId) return { allowed: true };
    return { allowed: false, reason: "forbidden" };
  }

  const user = actor.user;
  if (isAdmin(user)) return { allowed: true };
  if (c.userId && c.userId === user.id) return { allowed: true };

  if (user.role === ROLES.CONSULTANT && c.userId) {
    const assignment = await db.consultantAssignment.findFirst({
      where: { consultantId: user.id, userId: c.userId, status: "active" },
      select: { id: true, caseId: true },
    });
    if (assignment) {
      if (assignment.caseId && assignment.caseId !== caseId) {
        return { allowed: false, reason: "assignment_case_scope", assignmentId: assignment.id, scopedCaseId: assignment.caseId };
      }
      return { allowed: true, assignmentId: assignment.id, scopedCaseId: assignment.caseId };
    }
  }

  return { allowed: false, reason: "forbidden" };
}

export async function assertCanViewCase(caseId: string, subject?: CaseAccessSubject | null) {
  const result = await canAccessCase(caseId, subject);
  if (!result.allowed) {
    const err = new Error(result.reason === "not_found" ? "NOT_FOUND" : "FORBIDDEN");
    throw err;
  }
  return result;
}

/**
 * Validate that a caseId may be attached to a new document for this actor.
 * Returns the sanitized caseId (or null) — never a foreign id.
 */
export async function resolveOwnedCaseId(options: {
  caseId: string | null | undefined;
  userId?: string | null;
  guestSessionId?: string | null;
}): Promise<string | null> {
  const caseId = options.caseId?.trim() || null;
  if (!caseId) return null;

  if (options.userId) {
    const c = await db.case.findFirst({
      where: { id: caseId, userId: options.userId },
      select: { id: true },
    });
    return c?.id ?? null;
  }
  if (options.guestSessionId) {
    const c = await db.case.findFirst({
      where: { id: caseId, guestSessionId: options.guestSessionId },
      select: { id: true },
    });
    return c?.id ?? null;
  }
  return null;
}

/** Consultant may access a client's document/report only under an active assignment that covers the case. */
export async function consultantCanAccessClient(options: {
  consultantId: string;
  clientUserId: string;
  caseId?: string | null;
}): Promise<boolean> {
  const assignment = await db.consultantAssignment.findFirst({
    where: {
      consultantId: options.consultantId,
      userId: options.clientUserId,
      status: "active",
    },
    select: { id: true, caseId: true },
  });
  if (!assignment) return false;
  if (assignment.caseId && options.caseId && assignment.caseId !== options.caseId) return false;
  if (assignment.caseId && !options.caseId) return false;
  return true;
}
