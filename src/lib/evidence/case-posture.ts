/**
 * Case posture values (ledger current_posture).
 * Canonical write: PENDING_PRIMA_FACIE_ISSUED
 * Legacy alias: PRIMA_FACIE_PENDING (dual-read forever for stored ledgers)
 */
export const POSTURE_PENDING_PRIMA_FACIE_ISSUED = "PENDING_PRIMA_FACIE_ISSUED";
/** @deprecated Prefer PENDING_PRIMA_FACIE_ISSUED — kept for dual-read of stored ledgers/fixtures. */
export const POSTURE_PRIMA_FACIE_PENDING_LEGACY = "PRIMA_FACIE_PENDING";
export const POSTURE_FILED_PENDING = "FILED_PENDING";

const PRIMA_FACIE_POSTURES = new Set([
  POSTURE_PENDING_PRIMA_FACIE_ISSUED,
  POSTURE_PRIMA_FACIE_PENDING_LEGACY,
]);

export function isPrimaFacieIssuedPosture(value: string | null | undefined): boolean {
  return PRIMA_FACIE_POSTURES.has(String(value ?? "").trim());
}

/** Customer/staff-facing label — never show the raw enum alone. */
export function postureCustomerLabel(value: string | null | undefined): string {
  const v = String(value ?? "").trim();
  if (isPrimaFacieIssuedPosture(v)) {
    return "Prima facie determination issued (pending further processing)";
  }
  if (v === POSTURE_FILED_PENDING) return "I-360 filed (pending USCIS action)";
  if (!v) return "";
  return v.replace(/_/g, " ").toLowerCase();
}
