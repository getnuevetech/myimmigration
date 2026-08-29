"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminArea } from "@/lib/auth";
import { applyStaffApprovalGateOverride } from "@/lib/approval-gate-override";
import type { ActionState } from "./auth";

export async function overrideApprovalGateAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdminArea("admin.cases");
  const caseId = String(formData.get("caseId") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  if (!caseId) return { error: "Missing case id." };
  if (reason.length < 12) {
    return { error: "Enter a reason (at least 12 characters). Overrides are audited." };
  }

  try {
    await applyStaffApprovalGateOverride({
      caseId,
      adminUserId: admin.id,
      adminEmail: admin.email,
      reason,
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Override failed." };
  }

  revalidatePath(`/admin/cases/${caseId}`);
  revalidatePath(`/app/cases/${caseId}`);
  redirect(`/admin/cases/${caseId}`);
}
