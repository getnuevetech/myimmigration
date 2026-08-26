"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser, hasAdminArea } from "@/lib/auth";
import { getBoolSetting } from "@/lib/settings";
import type { ActionState } from "./auth";

// Case discussion with visibility rules:
// - Customers may mark a comment PRIVATE (hidden from consultant AND admin) — if enabled.
// - Consultants may hide a comment from the customer — but never from admins.
// - Admins may hide a comment from the customer (visible to consultants).
// Which checkboxes are available is controlled by admin settings (group "comments").
export async function addCaseCommentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const caseId = String(formData.get("caseId") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  const hide = formData.get("hide") === "on";
  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (!body && files.length === 0) return { error: "Write a comment or attach a file." };
  if (body.length > 4000) return { error: "Comments are limited to 4000 characters." };
  for (const f of files) {
    if (f.size > 20 * 1024 * 1024) return { error: `${f.name} is larger than 20 MB.` };
  }

  const c = await db.case.findUnique({ where: { id: caseId }, select: { id: true, userId: true, title: true, number: true, situation: true, goal: true } });
  if (!c) return { error: "Case not found." };

  // Determine the viewer's relationship to this case.
  let authorRole: "customer" | "consultant" | "admin";
  if (user.role === "super_admin" || user.role === "admin") {
    if (!hasAdminArea(user, "admin.cases")) return { error: "You don't have access to case discussions." };
    authorRole = "admin";
  } else if (user.role === "consultant") {
    if (!c.userId) return { error: "Case not found." };
    const assignment = await db.consultantAssignment.findFirst({
      where: { consultantId: user.id, userId: c.userId, status: "active" },
    });
    if (!assignment) return { error: "You don't have an active connection to this client." };
    authorRole = "consultant";
  } else {
    if (c.userId !== user.id) return { error: "Case not found." };
    authorRole = "customer";
  }

  // Resolve visibility from the role + admin-controlled toggles.
  let visibility = "all";
  if (hide) {
    if (authorRole === "customer" && (await getBoolSetting("comments.customer_private_enabled", true))) {
      visibility = "private";
    } else if (authorRole === "consultant" && (await getBoolSetting("comments.consultant_hide_from_customer_enabled", true))) {
      visibility = "hidden_from_customer";
    } else if (authorRole === "admin" && (await getBoolSetting("comments.admin_hide_from_customer_enabled", true))) {
      visibility = "hidden_from_customer";
    }
  }

  // Attachments become real case documents in the CUSTOMER's vault (whoever
  // posts them), so they join the evidence and are analyzed like any upload.
  const attachmentIds: string[] = [];
  if (files.length > 0) {
    if (authorRole === "customer") {
      const { documentQuotaError } = await import("@/actions/documents");
      const quotaError = await documentQuotaError(user.id, files.length);
      if (quotaError) return { error: quotaError };
    }
    const { saveUpload } = await import("@/lib/uploads");
    const { matchingDocumentKind } = await import("@/lib/goal-documents");
    const { authorityQueriesForInquiry, classifyImmigrationInquiry } = await import("@/lib/immigration-inquiry");
    const inquiry = classifyImmigrationInquiry({ situation: c.situation, goal: c.goal });
    const docKind = matchingDocumentKind({
      themes: inquiry.themes,
      inquiryMode: inquiry.mode,
      query: `${c.situation} ${c.goal}`,
      authorityQueries: authorityQueriesForInquiry(inquiry),
    }) ?? "identity";
    for (const file of files.slice(0, 10)) {
      const { filePath, sizeBytes } = await saveUpload(file);
      const doc = await db.document.create({
        data: {
          userId: c.userId, // the case owner's vault
          caseId,
          fileName: file.name,
          filePath,
          mimeType: file.type || "application/octet-stream",
          sizeBytes,
          docKind,
        },
      });
      attachmentIds.push(doc.id);
    }
  }

  await db.caseComment.create({
    data: { caseId, authorId: user.id, authorRole, body: body || `(attached ${files.length} file${files.length === 1 ? "" : "s"})`, visibility, attachmentsJson: JSON.stringify(attachmentIds) },
  });

  // New evidence changes the picture — re-run the analysis in the background.
  if (attachmentIds.length > 0 && c.userId) {
    const { after } = await import("next/server");
    await db.case.update({ where: { id: caseId }, data: { status: "analyzing" } });
    after(async () => {
      const { logSystem } = await import("@/lib/syslog");
      try {
        const { processDocumentsEvidence } = await import("@/lib/evidence/document-processing");
        await processDocumentsEvidence(attachmentIds);
      } catch (err) {
        await logSystem("error", "evidence", "Background comment attachment evidence processing failed", String(err));
      }
      try {
        const { runCaseAnalysis } = await import("@/lib/ai/orchestrator");
        await runCaseAnalysis(caseId);
      } catch (err) {
        await logSystem("error", "analysis", "Background re-analysis after a comment attachment failed", String(err));
        await db.case.update({ where: { id: caseId }, data: { status: "analyzed" } }).catch(() => null);
      }
    });
  }

  // Notify the people who can see it.
  const { formatCaseNumber } = await import("@/lib/case-number");
  const { classifyImmigrationInquiry } = await import("@/lib/immigration-inquiry");
  const { commentNotificationTitle } = await import("@/lib/goal-conversation");
  const ref = formatCaseNumber(c.number);
  const inquiry = classifyImmigrationInquiry({ situation: c.situation, goal: c.goal });
  const discussionInput = { inquiryMode: inquiry.mode, query: `${c.situation} ${c.goal}` };
  if (visibility !== "private") {
    if (authorRole !== "customer" && c.userId && visibility === "all") {
      await db.notification.create({
        data: {
          userId: c.userId,
          kind: "info",
          title: commentNotificationTitle(ref, discussionInput, "customer"),
          body: body.slice(0, 120),
          link: `/app/cases/${caseId}`,
        },
      });
    }
    if (authorRole === "customer" && c.userId) {
      const assignment = await db.consultantAssignment.findFirst({
        where: { userId: c.userId, status: "active" },
      });
      if (assignment) {
        await db.notification.create({
          data: {
            userId: assignment.consultantId,
            kind: "info",
            title: commentNotificationTitle(ref, discussionInput, "consultant"),
            body: body.slice(0, 120),
            link: `/consultant/clients/${assignment.id}/cases/${caseId}`,
          },
        });
      }
    }
  }

  revalidatePath(`/app/cases/${caseId}`);
  revalidatePath(`/admin/cases/${caseId}`);
  return { ok: true };
}
