/**
 * Phase S4 — classify whether a legacy Case row should become a Situation.
 * Uncertain / no government matter → Situation (default).
 * Preserve legacyCaseId for audit.
 */

import { detectGovernmentMatter } from "@/lib/conversation/government-matter";

export type LegacyCaseLike = {
  id: string;
  number: number;
  title: string;
  situation: string;
  goal: string;
  userId?: string | null;
  guestSessionId?: string | null;
  intelligenceJson?: string | null;
  notices?: { noticeType?: string | null }[];
  documentHints?: string[];
};

export type ReclassifyDecision = {
  caseId: string;
  action: "keep_case" | "reclassify_to_situation";
  reason: string;
  governmentSystems: string[];
  signals: string[];
};

export function decideLegacyCaseDisposition(row: LegacyCaseLike): ReclassifyDecision {
  const noticeHints = (row.notices ?? [])
    .map((n) => n.noticeType || "")
    .filter(Boolean);
  const text = [row.situation, row.goal, ...noticeHints].join("\n");
  const matter = detectGovernmentMatter(text, row.documentHints ?? noticeHints);

  if (matter.existing_government_case) {
    return {
      caseId: row.id,
      action: "keep_case",
      reason: `Government matter signals present: ${matter.signals.join(", ") || "detected"}.`,
      governmentSystems: matter.systems,
      signals: matter.signals,
    };
  }

  return {
    caseId: row.id,
    action: "reclassify_to_situation",
    reason:
      "No established government matter (receipt/filed form/RFE/NOID/court/removal). Default uncertain → Situation.",
    governmentSystems: [],
    signals: [],
  };
}

export function primaryGovernmentSystem(systems: string[]): string {
  if (systems.includes("uscis")) return "uscis";
  if (systems.includes("eoir")) return "eoir";
  if (systems.includes("ice_cbp_removal")) return "ice_cbp_removal";
  return systems[0] || "";
}
