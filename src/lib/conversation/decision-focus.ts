/** Short customer-facing label for the active decision target (client-safe). */
export function decisionFocusLabel(decisionTarget: string): string {
  switch (decisionTarget) {
    case "petition_eligibility_overview":
      return "Whether a relative can file for you";
    case "identify_available_pathways":
      return "Which pathways may be available";
    case "explain_document_or_notice":
      return "What this notice or document means";
    case "document_checklist":
      return "Documents typically needed";
    case "status_guidance":
      return "How to read your case status";
    case "risk_overview":
      return "Material risks in your situation";
    case "comprehensive_case_strategy":
      return "Review of your government matter";
    case "interpret_situation_offer_next_step":
      return "What you want help with next";
    case "answer_user_question":
      return "Answering your question";
    default:
      return "Understanding your request";
  }
}
