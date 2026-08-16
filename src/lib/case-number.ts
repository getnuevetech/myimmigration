export function formatCaseNumber(n: number): string {
  return `IMM-${String(n).padStart(6, "0")}`;
}
