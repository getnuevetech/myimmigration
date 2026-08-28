"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, isAdmin, requireUser } from "@/lib/auth";
import { getOrCreateGuestSession } from "@/lib/guest";
import { saveUpload, deleteUpload, validateUploadFile } from "@/lib/uploads";
import { explainNoticeContent } from "@/lib/ai/orchestrator";
import { verifyCaseProgress, verifyUserCasesProgress } from "@/lib/case-progress";
import { processDocumentEvidence, processDocumentsEvidence } from "@/lib/evidence/document-processing";
import { rebuildCaseEvidenceState } from "@/lib/evidence/case-state";
import { featureLimit, hasFeature } from "@/lib/access";
import { FEATURE_KEYS } from "@/lib/constants";
import { documentUploadAllowed, normalizeDocumentKind } from "@/lib/goal-documents";
import { noticeUploadAllowed } from "@/lib/goal-notices";
import type { ActionState } from "./auth";

async function vaultDocumentCount(userId: string): Promise<number> {
  return db.document.count({
    where: { userId, deletedAt: null, docKind: { not: "avatar" } },
  });
}

export async function documentQuotaError(userId: string | null | undefined, incoming: number): Promise<string | null> {
  if (!userId) return null;
  const user = await db.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (user && isAdmin(user)) return null;
  const enabled = await hasFeature(userId, FEATURE_KEYS.DOC_UPLOAD);
  const limit = enabled ? await featureLimit(userId, FEATURE_KEYS.DOC_UPLOAD) : 0;
  const used = await vaultDocumentCount(userId);
  const quota = documentUploadAllowed({
    canUpload: enabled,
    used,
    incoming,
    limit: enabled ? limit : 0,
  });
  if (quota.allowed) return null;
  if (!enabled) return "Document uploads are not included in your plan. Upgrade to Plus to add files.";
  return `You've used all ${limit} document uploads included in Free. Upgrade to Plus for unlimited vault storage.`;
}

export async function noticeQuotaError(userId: string | null | undefined, incoming: number): Promise<string | null> {
  if (!userId) return null;
  const user = await db.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (user && isAdmin(user)) return null;
  const enabled = await hasFeature(userId, FEATURE_KEYS.NOTICE_UPLOAD);
  const limit = enabled ? await featureLimit(userId, FEATURE_KEYS.NOTICE_UPLOAD) : 0;
  const used = await db.notice.count({ where: { userId } });
  const quota = noticeUploadAllowed({
    canUpload: enabled,
    used,
    incoming,
    limit: enabled ? limit : 0,
  });
  if (quota.allowed) return null;
  if (!enabled) return "Notice explanations are not included in your plan. Upgrade to Plus to add letters.";
  return `You've used all ${limit} notice explanations included in Free. Upgrade to Plus for unlimited notices.`;
}

export async function uploadDocumentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  const docKind = normalizeDocumentKind(String(formData.get("docKind") ?? "other")) ?? "other";
  let caseId = String(formData.get("caseId") ?? "") || null;
  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return { error: "Choose at least one file." };
  const quotaError = await documentQuotaError(user?.id, files.length);
  if (quotaError) return { error: quotaError };

  const guest = user ? null : await getOrCreateGuestSession();
  const { resolveOwnedCaseId } = await import("@/lib/case-access");
  caseId = await resolveOwnedCaseId({
    caseId,
    userId: user?.id ?? null,
    guestSessionId: guest?.id ?? null,
  });

  const documentIds: string[] = [];
  for (const file of files.slice(0, 10)) {
    const validationError = validateUploadFile(file);
    if (validationError) return { error: validationError };
    const { filePath, sizeBytes } = await saveUpload(file);
    const doc = await db.document.create({
      data: {
        userId: user?.id ?? null,
        guestSessionId: guest?.id ?? null,
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
  // New evidence changes the picture: re-run the case analysis automatically
  // so issues, facts, deadlines, and next steps reflect the uploaded documents. The
  // analysis itself re-verifies path-step evidence when it finishes.
  if (user) {
    if (caseId) {
      const c = await db.case.findFirst({ where: { id: caseId, userId: user.id }, select: { id: true } });
      if (c) {
        // Run the (potentially minutes-long) multi-model re-analysis in the
        // background — the upload returns instantly and the case page
        // live-refreshes while status is "analyzing".
        await db.case.update({ where: { id: caseId }, data: { status: "analyzing" } });
        after(async () => {
          const { logSystem } = await import("@/lib/syslog");
          try {
            await processDocumentsEvidence(documentIds);
          } catch (err) {
            await logSystem("error", "evidence", "Background evidence processing after upload failed", String(err));
          }
          try {
            const { runCaseAnalysis } = await import("@/lib/ai/orchestrator");
            await runCaseAnalysis(caseId);
          } catch (err) {
            await logSystem("error", "analysis", "Background re-analysis after upload failed", String(err));
            await db.case.update({ where: { id: caseId }, data: { status: "analyzed" } }).catch(() => null);
          }
        });
      }
    } else {
      after(async () => {
        try {
          await processDocumentsEvidence(documentIds);
          await verifyUserCasesProgress(user.id);
        } catch (err) {
          const { logSystem } = await import("@/lib/syslog");
          await logSystem("error", "evidence", "Background evidence processing after upload failed", String(err));
        }
      });
    }
  } else {
    after(async () => {
      try {
        await processDocumentsEvidence(documentIds);
      } catch (err) {
        const { logSystem } = await import("@/lib/syslog");
        await logSystem("error", "evidence", "Background guest evidence processing after upload failed", String(err));
      }
    });
  }
  revalidatePath("/app/documents");
  if (caseId) revalidatePath(`/app/cases/${caseId}`);
  return { ok: true };
}

export async function deleteDocumentAction(documentId: string) {
  const user = await requireUser();
  const doc = await db.document.findUnique({ where: { id: documentId } });
  if (!doc || doc.userId !== user.id) return;
  // Delete evidence rows with the source document so stale facts do not remain
  // after a customer removes the underlying record.
  await db.$transaction([
    db.evidenceRelationship.deleteMany({ where: { sourceDocumentId: documentId } }),
    db.caseEvent.deleteMany({ where: { documentId } }),
    db.evidenceFact.deleteMany({ where: { documentId } }),
    db.document.delete({ where: { id: documentId } }),
  ]);
  if (doc.caseId) await rebuildCaseEvidenceState(doc.caseId);
  await deleteUpload(doc.filePath);
  // Removing evidence can un-complete verified steps.
  if (doc.caseId) await verifyCaseProgress(doc.caseId);
  else await verifyUserCasesProgress(user.id);
  revalidatePath("/app/documents");
}

// Upload an USCIS notice (file or photo) and run identification + explanation.
export async function uploadNoticeAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  const file = formData.get("file");
  const pastedText = String(formData.get("pastedText") ?? "").trim();
  let caseId = String(formData.get("caseId") ?? "") || null;
  if (!(file instanceof File && file.size > 0) && pastedText.length < 10) {
    return { error: "Upload a file or photo of your notice, or paste its text." };
  }
  const quotaError = await noticeQuotaError(user?.id, 1);
  if (quotaError) return { error: quotaError };
  if (file instanceof File && file.size > 0) {
    const docQuota = await documentQuotaError(user?.id, 1);
    if (docQuota) return { error: docQuota };
  }
  const guest = user ? null : await getOrCreateGuestSession();
  const { resolveOwnedCaseId } = await import("@/lib/case-access");
  caseId = await resolveOwnedCaseId({
    caseId,
    userId: user?.id ?? null,
    guestSessionId: guest?.id ?? null,
  });

  let documentId: string | null = null;
  let content = pastedText;

  if (file instanceof File && file.size > 0) {
    const validationError = validateUploadFile(file);
    if (validationError) return { error: validationError };
    const { filePath, sizeBytes } = await saveUpload(file);
    const doc = await db.document.create({
      data: {
        userId: user?.id ?? null,
        guestSessionId: guest?.id ?? null,
        caseId,
        fileName: file.name,
        filePath,
        mimeType: file.type || "application/octet-stream",
        sizeBytes,
        docKind: "notice",
      },
    });
    documentId = doc.id;
    if (file.type.startsWith("text/") && !content) {
      content = Buffer.from(await file.arrayBuffer()).toString("utf-8").slice(0, 30000);
    }
    if (!content) content = `USCIS notice file uploaded: ${file.name}. No machine-readable text available.`;
  }

  const notice = await db.notice.create({
    data: { userId: user?.id ?? null, caseId, documentId, status: "analyzing" },
  });

  if (documentId) {
    after(async () => {
      try {
        await processDocumentEvidence(documentId);
      } catch (err) {
        const { logSystem } = await import("@/lib/syslog");
        await logSystem("error", "evidence", "Background notice evidence processing failed", String(err));
      }
    });
  }

  const result = await explainNoticeContent(content, { caseId });
  if (result) {
    const deadlineStr = typeof result.deadline === "string" ? result.deadline : "";
    const deadline = deadlineStr && !Number.isNaN(Date.parse(deadlineStr)) ? new Date(deadlineStr) : null;
    await db.notice.update({
      where: { id: notice.id },
      data: {
        noticeType: String(result.notice_type ?? "") || "",
        caseYear: typeof result.case_year === "number" ? result.case_year : null,
        amountCents: typeof result.filing_fee_usd === "number" ? Math.round(result.filing_fee_usd * 100) : null,
        deadline,
        explanation: String(result.plain_english_explanation ?? ""),
        nextStepsJson: JSON.stringify(result.next_steps ?? []),
        status: result.fallback ? "verification_required" : "explained",
      },
    });
    if (deadline && user) {
      await db.deadline.create({
        data: {
          userId: user.id,
          caseId,
          title: `Respond to USCIS notice ${String(result.notice_type ?? "")}`.trim(),
          dueDate: deadline,
          source: "notice",
        },
      });
    }
  }
  return { ok: true, ...(user ? {} : {}), error: undefined };
}
