export type CaseGoal =
  | "understand_status"
  | "interpret_letter"
  | "find_missing_docs"
  | "rfe_prep"
  | "interview_prep"
  | "organize_for_attorney"
  | "understand_denial"
  | "identify_pathways"
  | "review_history"
  | "understand_next_steps"
  | "prepare_attorney_questions";

export const CASE_GOAL_LABELS: Record<CaseGoal, string> = {
  understand_status: "Understand my current immigration status",
  interpret_letter: "Understand a USCIS letter or notice",
  find_missing_docs: "See what may be missing from my case",
  rfe_prep: "Understand and respond to an RFE",
  interview_prep: "Prepare for an immigration interview",
  organize_for_attorney: "Organize documents for my attorney",
  understand_denial: "Understand why my application was denied",
  identify_pathways: "Understand possible immigration pathways",
  review_history: "Review my complete immigration history",
  understand_next_steps: "Understand what happens next",
  prepare_attorney_questions: "Prepare questions for an immigration lawyer",
};

export interface TimelineEvent {
  year: string;
  date?: string;
  event: string;
  source: "narrative" | "document" | "both";
  formType?: string;
  receiptNumber?: string;
}

export interface DocumentRecord {
  id: string;
  name: string;
  formType?: string;
  receiptNumber?: string;
  aNumber?: string;
  dates: string[];
  status?: string;
  deadlines?: string[];
  issues?: string[];
  extractedText?: string;
}

export interface CaseInconsistency {
  field: string;
  narrativeSays: string;
  documentSays: string;
  severity: "warning" | "critical";
}

export interface CaseFinding {
  label: string;
  status: "ok" | "warning" | "missing" | "critical";
  detail?: string;
}

export interface NextStep {
  option: string;
  title: string;
  description: string;
  recommended?: boolean;
}

export type CaseHealth = "good" | "needs_attention" | "critical";

export interface CaseAnalysis {
  caseHealth: CaseHealth;
  currentSituation: string;
  importantFindings: string[];
  deadlines: { label: string; date: string }[];
  timeline: TimelineEvent[];
  findings: CaseFinding[];
  plainLanguageSummary: string;
  nextSteps: NextStep[];
  inconsistencies: CaseInconsistency[];
  documentsReviewed: number;
  documentsMissing: string[];
  majorIssues: number;
  disclaimer: string;
}

export interface CaseInput {
  narrative: string;
  goals: CaseGoal[];
  documents: DocumentRecord[];
}
