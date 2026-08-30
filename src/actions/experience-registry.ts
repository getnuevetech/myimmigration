"use server";

import { revalidatePath } from "next/cache";
import { requireAdminArea } from "@/lib/auth";
import {
  parsePromotionLevel,
  setPatternPromotionLevel,
  PROMOTION_LABELS,
} from "@/lib/experience/registry";
import {
  clearPatternStale,
  invalidatePatternsForAuthorityKey,
  markPatternStale,
  recordPatternFeedback,
} from "@/lib/experience/telemetry";
import type { ActionState } from "@/actions/auth";

/**
 * L5 — admin promotes / demotes a Pattern Registry entry (levels 0–4).
 * Production (4) remains the only level eligible for Sol Experience Search (L6).
 */
export async function promoteExperiencePatternAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdminArea("admin.experience");

  const id = String(formData.get("observationId") ?? "").trim();
  if (!id) return { error: "Missing pattern id." };

  let toLevel;
  try {
    toLevel = parsePromotionLevel(formData.get("toLevel"));
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Invalid promotion level." };
  }

  try {
    const result = await setPatternPromotionLevel({ id, toLevel });
    revalidatePath("/admin/experience");
    return {
      ok: true,
      info: `Moved ${result.fromLevel} → ${result.toLevel} (${PROMOTION_LABELS[result.toLevel]}).`,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Promotion failed." };
  }
}

/** L7 — record help/harm on a production pattern. */
export async function recordExperiencePatternFeedbackAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdminArea("admin.experience");
  const id = String(formData.get("observationId") ?? "").trim();
  const verdictRaw = String(formData.get("verdict") ?? "").trim();
  const reasonKey = String(formData.get("reason_key") ?? "").trim() || undefined;
  if (!id) return { error: "Missing pattern id." };
  if (verdictRaw !== "help" && verdictRaw !== "harm") {
    return { error: "verdict must be help or harm." };
  }

  try {
    const snap = await recordPatternFeedback({
      observationId: id,
      verdict: verdictRaw,
      reasonKey,
    });
    revalidatePath("/admin/experience");
    const staleNote = snap.staleAt ? " Pattern auto-staled from harm threshold." : "";
    return {
      ok: true,
      info: `Recorded ${verdictRaw} (help=${snap.helpCount}, harm=${snap.harmCount}).${staleNote}`,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Feedback failed." };
  }
}

/** L7 — mark pattern stale (excluded from Sol Experience Search). */
export async function markExperiencePatternStaleAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdminArea("admin.experience");
  const id = String(formData.get("observationId") ?? "").trim();
  const reasonKey = String(formData.get("reason_key") ?? "admin_marked_stale").trim();
  if (!id) return { error: "Missing pattern id." };

  try {
    await markPatternStale({ observationId: id, reasonKey });
    revalidatePath("/admin/experience");
    return { ok: true, info: "Pattern marked stale — excluded from Experience Search." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not mark stale." };
  }
}

/** L7 — clear stale so pattern can serve again (if still production). */
export async function clearExperiencePatternStaleAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdminArea("admin.experience");
  const id = String(formData.get("observationId") ?? "").trim();
  if (!id) return { error: "Missing pattern id." };

  try {
    await clearPatternStale({ observationId: id });
    revalidatePath("/admin/experience");
    return { ok: true, info: "Stale cleared." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not clear stale." };
  }
}

/** L7 — invalidate production patterns citing a changed authority catalog key. */
export async function invalidateExperiencePatternsForAuthorityAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdminArea("admin.experience");
  const authorityKey = String(formData.get("authority_key") ?? "").trim();
  if (!authorityKey) return { error: "Missing authority_key." };

  try {
    const result = await invalidatePatternsForAuthorityKey({
      authorityKey,
      reasonKey: "authority_source_changed",
    });
    revalidatePath("/admin/experience");
    return {
      ok: true,
      info: `Marked ${result.marked} production pattern(s) stale for authority ${authorityKey}.`,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Authority invalidation failed." };
  }
}
