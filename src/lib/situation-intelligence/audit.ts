import type { AuditFinding, DecomposeResult } from "./types";

/**
 * AI2 — Fact Auditor (heuristic Phase 1).
 * Catches overclaims, manufactured relationships, soft→hard upgrades.
 */
export function auditDecomposeResult(decompose: DecomposeResult, message: string): AuditFinding[] {
  const findings: AuditFinding[] = [];
  const lower = message.toLowerCase();
  const keys = new Set(decompose.claims.map((c) => c.key));

  for (const claim of decompose.claims) {
    // Never let soft/ambiguous fear become a hard reported fact
    if (claim.key === "fear_of_persecution") {
      if (claim.claim_strength !== "explicit" || claim.value == null) {
        findings.push({
          key: claim.key,
          action: "drop",
          reason: "User did not explicitly establish fear of persecution; keep return concern only.",
        });
      }
    }

    // Spouse / family must appear in narrative
    if (claim.key === "family_basis" || claim.key === "usc_child") {
      if (!/\b(wife|husband|spouse|married|daughter|son|child|family)\b/i.test(message)) {
        findings.push({
          key: claim.key,
          action: "drop",
          reason: "Family relationship not present in narrative — refusing manufactured family fact.",
        });
      }
    }

    // USC/LPR spouse requires status words
    if (claim.key === "family_basis" && claim.value === "usc_or_lpr_spouse") {
      if (!/\b(u\.?s\.?\s*citizen|usc|green.?card|permanent resident|lpr)\b/i.test(message)) {
        findings.push({
          key: claim.key,
          action: "downgrade",
          reason: "Spouse mentioned without USC/LPR status — keep as spouse_mentioned only.",
          revised_value: "spouse_mentioned",
          revised_strength: "soft",
        });
      }
    }

    // Soft employment should not become verified sponsorship
    if (claim.key === "employment_signal" && claim.claim_strength === "soft") {
      findings.push({
        key: claim.key,
        action: "keep",
        reason: "Employment is a signal only; not sponsorship eligibility.",
      });
    }
  }

  // If return concern exists but fear was never claimed, ensure we don't invent it
  if (keys.has("inability_or_concern_about_return") && !/\b(afraid|fear|persecut)\b/i.test(lower)) {
    findings.push({
      key: "fear_of_persecution",
      action: "add_unknown",
      reason: "Cannot return ≠ fear of persecution until clarified.",
      revised_value: null,
    });
  }

  // Guard: live/work goal must not create family_basis
  if (/\blive and work|work and live\b/i.test(message) && !keys.has("family_basis")) {
    findings.push({
      key: "family_basis",
      action: "drop",
      reason: "Live/work goal alone must not invent a family immigration basis.",
    });
  }

  return findings;
}
