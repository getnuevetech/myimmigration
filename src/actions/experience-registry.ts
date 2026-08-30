"use server";

import { revalidatePath } from "next/cache";
import { requireAdminArea } from "@/lib/auth";
import {
  parsePromotionLevel,
  setPatternPromotionLevel,
  PROMOTION_LABELS,
} from "@/lib/experience/registry";
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
