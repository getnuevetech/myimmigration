import { authorityQueriesForInquiry, classifyImmigrationInquiry, INQUIRY_MODES } from "./immigration-inquiry";

export const ANALYSIS_TASKS = {
  PROCESS_DOCUMENTS: "PROCESS_DOCUMENTS",
  RECONSTRUCT_CASE: "RECONSTRUCT_CASE",
  RETRIEVE_AUTHORITY: "RETRIEVE_AUTHORITY",
  PRIMARY_REASONING: "PRIMARY_REASONING",
  INDEPENDENT_REVIEW: "INDEPENDENT_REVIEW",
  QUESTION_PLANNING: "QUESTION_PLANNING",
  PRESENT_APPROVED_STATE: "PRESENT_APPROVED_STATE",
} as const;

export const ANALYSIS_TOOLS = {
  EVIDENCE_RECONCILIATION: "EVIDENCE_RECONCILIATION",
  READINESS_SPLIT: "READINESS_SPLIT",
  ACTION_GRAPH: "ACTION_GRAPH",
} as const;

export const ANALYSIS_TASK_LABELS: Record<string, string> = {
  PROCESS_DOCUMENTS: "Document processing",
  RECONSTRUCT_CASE: "Situation reconstruction",
  RETRIEVE_AUTHORITY: "USCIS rule lookup",
  PRIMARY_REASONING: "Situation analysis",
  INDEPENDENT_REVIEW: "Second independent review",
  QUESTION_PLANNING: "Follow-up questions",
  PRESENT_APPROVED_STATE: "Approved case presentation",
};

export const ANALYSIS_COMPLEXITY_LABELS: Record<string, string> = {
  LOW: "Straightforward",
  MODERATE: "Needs extra checks",
  HIGH: "Needs a careful review",
  CRITICAL: "Needs professional review",
};

export type AnalysisPlan = {
  case_complexity: "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
  tasks_required: string[];
  tasks_skipped: { task: string; reason: string }[];
  documents_to_process: string[];
  deterministic_tools: string[];
  authority_queries_needed: string[];
  reasoning_level: "DIRECT" | "VERIFIED" | "HIGH_RISK";
  review_required: boolean;
  human_review_required: boolean;
  questions_may_be_needed: boolean;
  blocking_conditions: string[];
  stop_conditions: string[];
  execution?: AnalysisPlanExecution;
};

export type AnalysisPlanExecution = {
  tasks_executed: string[];
  tasks_skipped: { task: string; reason: string }[];
  tools_executed: string[];
  runtime_additions: { task: string; reason: string }[];
  stopped: boolean;
  blocked: boolean;
};

export type AnalysisPlanInput = {
  caseStatus: string;
  documentCount: number;
  documents: { id: string; processingStatus: string }[];
  issues: { priority: string; issueType: string }[];
  unknowns: { key: string }[];
  evidenceAuditStatus?: string | null;
  evidenceFactKeys: string[];
  situation?: string;
  goal?: string;
  inquiryMode?: "existing_case" | "open_options";
};

export type AnalysisIssueHint = {
  issue_type?: unknown;
  professional_review?: unknown;
};

export type AnalysisRunDecisions = {
  processDocuments: boolean;
  reconstructCase: boolean;
  retrieveAuthority: boolean;
  primaryReasoning: boolean;
  independentReview: boolean;
  questionPlanning: boolean;
  presentApprovedState: boolean;
  actionGraph: boolean;
  evidenceReconciliation: boolean;
  readinessSplit: boolean;
  stop: boolean;
  blocked: boolean;
};

function uniq(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

export function parseAnalysisPlan(value: string | AnalysisPlan | null | undefined): AnalysisPlan | null {
  if (!value) return null;
  if (typeof value === "object") return value;
  try {
    const parsed = JSON.parse(value) as AnalysisPlan;
    if (!parsed || !Array.isArray(parsed.tasks_required)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function planRequires(plan: AnalysisPlan | null | undefined, task: string): boolean {
  return Boolean(plan?.tasks_required.includes(task));
}

export function planHasTool(plan: AnalysisPlan | null | undefined, tool: string): boolean {
  return Boolean(plan?.deterministic_tools.includes(tool));
}

export function issuesNeedIndependentReview(issues: AnalysisIssueHint[]): boolean {
  return issues.some((issue) => {
    const type = String(issue.issue_type ?? "");
    const review = String(issue.professional_review ?? "");
    return type === "professional_review" || review === "required";
  });
}

export function buildAnalysisPlan(input: AnalysisPlanInput): AnalysisPlan {
  const docsToProcess = input.documents
    .filter((doc) => ["uploaded", "failed"].includes(doc.processingStatus))
    .map((doc) => doc.id);
  const inquiry = input.inquiryMode
    ? {
        mode: input.inquiryMode,
        themes: classifyImmigrationInquiry({
          situation: input.situation,
          goal: input.goal,
          documentCount: input.documentCount,
          factKeys: input.evidenceFactKeys,
        }).themes,
        hasUscisFileSignals: input.inquiryMode === INQUIRY_MODES.EXISTING_CASE,
      }
    : input.situation || input.goal
      ? classifyImmigrationInquiry({
          situation: input.situation,
          goal: input.goal,
          documentCount: input.documentCount,
          factKeys: input.evidenceFactKeys,
        })
      : { mode: INQUIRY_MODES.EXISTING_CASE, themes: ["general" as const], hasUscisFileSignals: true };
  const openOptions = inquiry.mode === INQUIRY_MODES.OPEN_OPTIONS;
  const highRiskIssue = input.issues.some((issue) =>
    issue.priority === "urgent" ||
    ["professional_review", "deadline_tracking", "uscis_notice_response"].includes(issue.issueType),
  );
  const evidenceBlocked = input.evidenceAuditStatus === "blocked" && !openOptions;
  const needsReview = input.evidenceAuditStatus === "needs_review" || evidenceBlocked || highRiskIssue;
  const humanReview = evidenceBlocked || input.issues.some((issue) => issue.issueType === "professional_review");
  const complexity: AnalysisPlan["case_complexity"] =
    humanReview ? "CRITICAL" : needsReview ? "HIGH" : openOptions || input.unknowns.length > 0 || input.documentCount > 2 ? "MODERATE" : "LOW";
  const reasoningLevel: AnalysisPlan["reasoning_level"] =
    humanReview ? "HIGH_RISK" : needsReview || openOptions || input.unknowns.length > 0 ? "VERIFIED" : "DIRECT";
  const questionsNeeded = input.unknowns.length > 0 || openOptions;

  return {
    case_complexity: complexity,
    tasks_required: uniq([
      docsToProcess.length ? ANALYSIS_TASKS.PROCESS_DOCUMENTS : "",
      ANALYSIS_TASKS.RECONSTRUCT_CASE,
      ANALYSIS_TASKS.RETRIEVE_AUTHORITY,
      ANALYSIS_TASKS.PRIMARY_REASONING,
      needsReview ? ANALYSIS_TASKS.INDEPENDENT_REVIEW : "",
      questionsNeeded ? ANALYSIS_TASKS.QUESTION_PLANNING : "",
      ANALYSIS_TASKS.PRESENT_APPROVED_STATE,
    ]),
    tasks_skipped: [
      ...(docsToProcess.length ? [] : [{ task: ANALYSIS_TASKS.PROCESS_DOCUMENTS, reason: openOptions ? "No USCIS documents were uploaded, so document processing is not required for an options review." : "No stale or failed documents require processing." }]),
      ...(needsReview ? [] : [{ task: ANALYSIS_TASKS.INDEPENDENT_REVIEW, reason: "No high-risk issue, audit block, or material conflict detected." }]),
      ...(questionsNeeded ? [] : [{ task: ANALYSIS_TASKS.QUESTION_PLANNING, reason: "No open unknowns need follow-up questions." }]),
    ],
    documents_to_process: docsToProcess,
    deterministic_tools: uniq([
      ANALYSIS_TOOLS.EVIDENCE_RECONCILIATION,
      ANALYSIS_TOOLS.READINESS_SPLIT,
      ANALYSIS_TOOLS.ACTION_GRAPH,
    ]),
    authority_queries_needed: uniq([
      ...input.evidenceFactKeys.filter((key) => ["form_type", "notice_type", "response_deadline"].includes(key)),
      ...(openOptions ? authorityQueriesForInquiry(inquiry) : []),
    ]),
    reasoning_level: reasoningLevel,
    review_required: needsReview,
    human_review_required: humanReview,
    questions_may_be_needed: questionsNeeded,
    blocking_conditions: evidenceBlocked ? ["Evidence audit is blocked."] : [],
    stop_conditions: input.caseStatus === "closed" ? ["Case is closed."] : [],
  };
}

export function analysisRunDecisions(
  plan: AnalysisPlan,
  runtime: { issues?: AnalysisIssueHint[]; openUnknownCount?: number } = {},
): AnalysisRunDecisions {
  const stop = plan.stop_conditions.length > 0;
  const blocked = plan.blocking_conditions.length > 0;
  const required = (task: string) => !stop && planRequires(plan, task);
  const independentReview = required(ANALYSIS_TASKS.INDEPENDENT_REVIEW) || (!stop && issuesNeedIndependentReview(runtime.issues ?? []));
  const questionPlanning = required(ANALYSIS_TASKS.QUESTION_PLANNING) || (!stop && (runtime.openUnknownCount ?? 0) > 0);
  return {
    processDocuments: required(ANALYSIS_TASKS.PROCESS_DOCUMENTS),
    reconstructCase: required(ANALYSIS_TASKS.RECONSTRUCT_CASE),
    retrieveAuthority: required(ANALYSIS_TASKS.RETRIEVE_AUTHORITY),
    primaryReasoning: required(ANALYSIS_TASKS.PRIMARY_REASONING) && !blocked,
    independentReview,
    questionPlanning,
    presentApprovedState: required(ANALYSIS_TASKS.PRESENT_APPROVED_STATE),
    actionGraph: !stop && planHasTool(plan, ANALYSIS_TOOLS.ACTION_GRAPH),
    evidenceReconciliation: !stop && planHasTool(plan, ANALYSIS_TOOLS.EVIDENCE_RECONCILIATION),
    readinessSplit: !stop && planHasTool(plan, ANALYSIS_TOOLS.READINESS_SPLIT),
    stop,
    blocked,
  };
}

export function runtimeReviewAddition(plan: AnalysisPlan, issues: AnalysisIssueHint[]): { task: string; reason: string } | null {
  if (planRequires(plan, ANALYSIS_TASKS.INDEPENDENT_REVIEW)) return null;
  if (!issuesNeedIndependentReview(issues)) return null;
  return { task: ANALYSIS_TASKS.INDEPENDENT_REVIEW, reason: "A finding required professional or independent review after the first analysis pass." };
}

export function runtimeQuestionAddition(plan: AnalysisPlan, openUnknownCount: number): { task: string; reason: string } | null {
  if (planRequires(plan, ANALYSIS_TASKS.QUESTION_PLANNING)) return null;
  if (openUnknownCount <= 0) return null;
  return { task: ANALYSIS_TASKS.QUESTION_PLANNING, reason: "Open unknowns remained after analysis, so follow-up questions were planned." };
}

export function buildPlanExecution(
  plan: AnalysisPlan,
  decisions: AnalysisRunDecisions,
  extras?: { runtimeAdditions?: { task: string; reason: string }[] },
): AnalysisPlanExecution {
  const executed: string[] = [];
  const skipped = [...plan.tasks_skipped];
  const mark = (task: string, ran: boolean, skipReason: string) => {
    if (ran) {
      executed.push(task);
      const idx = skipped.findIndex((item) => item.task === task);
      if (idx >= 0) skipped.splice(idx, 1);
    } else if (!skipped.some((item) => item.task === task)) {
      skipped.push({ task, reason: skipReason });
    }
  };
  mark(ANALYSIS_TASKS.PROCESS_DOCUMENTS, decisions.processDocuments, "The plan skipped document processing.");
  mark(ANALYSIS_TASKS.RECONSTRUCT_CASE, decisions.reconstructCase, decisions.stop ? "The case is closed, so analysis stopped." : "The plan skipped case reconstruction.");
  mark(ANALYSIS_TASKS.RETRIEVE_AUTHORITY, decisions.retrieveAuthority, "The plan skipped authority retrieval.");
  mark(ANALYSIS_TASKS.PRIMARY_REASONING, decisions.primaryReasoning, decisions.blocked ? "Evidence is blocked, so the pipeline did not invent a new analysis." : "The plan skipped primary reasoning.");
  mark(ANALYSIS_TASKS.INDEPENDENT_REVIEW, decisions.independentReview, "Independent review was not required.");
  mark(ANALYSIS_TASKS.QUESTION_PLANNING, decisions.questionPlanning, "No follow-up questions were needed.");
  mark(ANALYSIS_TASKS.PRESENT_APPROVED_STATE, decisions.presentApprovedState, "The plan skipped presentation assembly.");
  const tools = [
    decisions.evidenceReconciliation ? ANALYSIS_TOOLS.EVIDENCE_RECONCILIATION : "",
    decisions.readinessSplit ? ANALYSIS_TOOLS.READINESS_SPLIT : "",
    decisions.actionGraph ? ANALYSIS_TOOLS.ACTION_GRAPH : "",
  ].filter(Boolean);
  return {
    tasks_executed: executed,
    tasks_skipped: skipped,
    tools_executed: tools,
    runtime_additions: extras?.runtimeAdditions ?? [],
    stopped: decisions.stop,
    blocked: decisions.blocked,
  };
}

export function withPlanExecution(plan: AnalysisPlan, execution: AnalysisPlanExecution): AnalysisPlan {
  return { ...plan, execution };
}

export function analysisPlanSummary(plan: AnalysisPlan): {
  complexityLabel: string;
  executedLabels: string[];
  skippedLabels: { label: string; reason: string }[];
  runtimeLabels: { label: string; reason: string }[];
  stopped: boolean;
  blocked: boolean;
} {
  const execution = plan.execution;
  const executed = execution?.tasks_executed ?? plan.tasks_required;
  const skipped = execution?.tasks_skipped ?? plan.tasks_skipped;
  return {
    complexityLabel: ANALYSIS_COMPLEXITY_LABELS[plan.case_complexity] ?? plan.case_complexity,
    executedLabels: executed.map((task) => ANALYSIS_TASK_LABELS[task] ?? task),
    skippedLabels: skipped.map((item) => ({
      label: ANALYSIS_TASK_LABELS[item.task] ?? item.task,
      reason: item.reason,
    })),
    runtimeLabels: (execution?.runtime_additions ?? []).map((item) => ({
      label: ANALYSIS_TASK_LABELS[item.task] ?? item.task,
      reason: item.reason,
    })),
    stopped: execution?.stopped ?? plan.stop_conditions.length > 0,
    blocked: execution?.blocked ?? plan.blocking_conditions.length > 0,
  };
}
