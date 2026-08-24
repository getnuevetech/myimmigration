export const PRESENTATION_ACTION_STATUS: Record<string, { label: string; tone: "done" | "ready" | "blocked" | "muted" }> = {
  COMPLETED: { label: "Done", tone: "done" },
  READY: { label: "Ready now", tone: "ready" },
  IN_PROGRESS: { label: "In progress", tone: "ready" },
  BLOCKED: { label: "Waiting", tone: "blocked" },
  SUPERSEDED: { label: "No longer needed", tone: "muted" },
  NOT_REQUIRED: { label: "Not required", tone: "muted" },
};

export function presentationActionStatus(status: string) {
  return PRESENTATION_ACTION_STATUS[status.toUpperCase()] ?? { label: status.replace(/_/g, " "), tone: "muted" as const };
}

export function presentationEvidenceGateLabel(status: string | null | undefined): string | null {
  if (!status) return null;
  const key = status.toLowerCase();
  if (key === "pass") return "Records checked";
  if (key === "needs_review") return "Records need review";
  if (key === "fail" || key === "failed") return "Records incomplete";
  return `Records: ${status.replace(/_/g, " ")}`;
}

export function formatPresentationDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US");
}

export function presentationStepCta(actionKey: string, caseId: string): { label: string; href: string } | null {
  switch (actionKey.toUpperCase()) {
    case "GET_CASE_RECORD":
    case "GET_ACCOUNT_RECORD":
    case "UPLOAD_NOTICE":
      return { label: "Upload USCIS records", href: "/app/documents" };
    case "ADD_CASE_DETAILS":
      return { label: "Answer follow-up questions", href: "#clarify" };
    case "PREPARE_APPOINTMENT":
      return { label: "Upload appointment notice", href: "/app/documents" };
    case "DRAFT_LETTER":
      return { label: "Draft my letter", href: `/app/letters/new?case=${caseId}` };
    case "COMPLETE_FORM_I485":
    case "PREPARE_FORM":
      return { label: "See matching USCIS forms", href: "/app/forms" };
    case "ADD_DEADLINE":
      return { label: "Add the deadline", href: "/app/deadlines" };
    case "REVIEW_ANALYSIS":
      return { label: "Ask a follow-up question", href: `/app/qa?case=${caseId}` };
    default:
      return null;
  }
}
