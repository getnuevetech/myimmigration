"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdminArea } from "@/lib/auth";
import {
  overrideCustomerOutputWithSnapshot,
  parseCustomerFacingSnapshot,
  runAdminDraftReanalysis,
} from "@/lib/admin-reanalysis";
import type { ActionState } from "./auth";

async function requireReanalysisAdmin() {
  return requireAdminArea("admin.cases");
}

function parseProviderIds(formData: FormData): string[] {
  const raw = String(formData.get("providerIds") ?? "").trim();
  if (!raw) {
    return formData
      .getAll("providerId")
      .map((value) => String(value))
      .filter(Boolean);
  }
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
  } catch {
    /* fall through */
  }
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export async function startAdminReanalysisAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireReanalysisAdmin();
  const caseId = String(formData.get("caseId") ?? "").trim();
  if (!caseId) return { error: "Select a case first." };
  const found = await db.case.findUnique({ where: { id: caseId }, select: { id: true } });
  if (!found) return { error: "Case not found." };
  const providerIds = parseProviderIds(formData);
  const row = await db.adminCaseReanalysis.create({
    data: {
      caseId,
      adminUserId: admin.id,
      status: "pending",
      visibleToCustomer: formData.get("visibleToCustomer") === "on",
      visibleToConsultant: formData.get("visibleToConsultant") === "on",
      providerIdsJson: JSON.stringify(providerIds),
    },
  });
  after(() =>
    runAdminDraftReanalysis(row.id).catch(async (err) => {
      const { logSystem } = await import("@/lib/syslog");
      await logSystem("error", "admin_reanalysis", "Admin draft re-analysis failed", String(err));
    }),
  );
  revalidatePath(`/admin/reanalysis/${row.id}`);
  revalidatePath(`/admin/cases/${caseId}`);
  redirect(`/admin/reanalysis/${row.id}`);
}

export async function startAdminReanalysisFromCaseAction(caseId: string) {
  const admin = await requireReanalysisAdmin();
  const found = await db.case.findUnique({ where: { id: caseId }, select: { id: true } });
  if (!found) return;
  const row = await db.adminCaseReanalysis.create({
    data: {
      caseId,
      adminUserId: admin.id,
      status: "pending",
      visibleToCustomer: false,
      visibleToConsultant: false,
      providerIdsJson: "[]",
    },
  });
  after(() =>
    runAdminDraftReanalysis(row.id).catch(async (err) => {
      const { logSystem } = await import("@/lib/syslog");
      await logSystem("error", "admin_reanalysis", "Admin draft re-analysis failed", String(err));
    }),
  );
  revalidatePath(`/admin/reanalysis/${row.id}`);
  revalidatePath(`/admin/cases/${caseId}`);
  redirect(`/admin/reanalysis/${row.id}`);
}

export async function shareAdminReanalysisAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireReanalysisAdmin();
  const id = String(formData.get("id") ?? "").trim();
  const row = await db.adminCaseReanalysis.findUnique({ where: { id } });
  if (!row) return { error: "Re-analysis not found." };
  if (!["completed", "shared"].includes(row.status) || row.overriddenAt) {
    return { error: "Share is only available after a completed re-analysis that has not replaced the customer output." };
  }
  const visibleToCustomer = formData.get("visibleToCustomer") === "on";
  const visibleToConsultant = formData.get("visibleToConsultant") === "on";
  if (!visibleToCustomer && !visibleToConsultant) {
    return { error: "Select customer, consultant, or both before sharing." };
  }
  await db.adminCaseReanalysis.update({
    where: { id },
    data: {
      status: "shared",
      visibleToCustomer,
      visibleToConsultant,
      sharedAt: new Date(),
      adminUserId: admin.id,
    },
  });
  revalidatePath(`/admin/reanalysis/${id}`);
  revalidatePath(`/admin/cases/${row.caseId}`);
  revalidatePath(`/app/cases/${row.caseId}`);
  return { ok: true };
}

export async function overrideAdminReanalysisAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireReanalysisAdmin();
  const id = String(formData.get("id") ?? "").trim();
  const row = await db.adminCaseReanalysis.findUnique({ where: { id } });
  if (!row) return { error: "Re-analysis not found." };
  if (!["completed", "shared"].includes(row.status) || row.overriddenAt) {
    return { error: "Override is only available after a completed re-analysis." };
  }
  const proposed = parseCustomerFacingSnapshot(row.proposedSnapshotJson);
  if (!proposed) return { error: "The re-analysed output is missing, so it cannot replace the customer output." };
  await overrideCustomerOutputWithSnapshot(row.caseId, proposed);
  await db.adminCaseReanalysis.update({
    where: { id },
    data: {
      status: "overridden",
      overriddenAt: new Date(),
    },
  });
  revalidatePath(`/admin/reanalysis/${id}`);
  revalidatePath(`/admin/cases/${row.caseId}`);
  revalidatePath(`/app/cases/${row.caseId}`);
  return { ok: true };
}
