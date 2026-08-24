export type PresentationEvidenceStrength = "Strong" | "Moderate" | "Limited";

export type PresentationHero = {
  current_posture: string;
  status: string;
  next_best_action: { title: string; action_key: string } | null;
  nearest_deadline: { title: string; due_date: string } | null;
  evidence_strength: PresentationEvidenceStrength;
  professional_review_recommended: boolean;
};

export type PresentationContract = {
  hero: PresentationHero;
  what_this_means: {
    summary: string;
    unresolved_count: number;
    pending_actions: string[];
    unknowns: string[];
    evidence_gate_status: string | null;
    conflicts: { topic: string; description: string; resolution?: string }[];
  };
  timeline: { eventType?: string; title?: string; dateText?: string }[];
  findings: {
    id: string;
    title: string;
    group: string;
    state: string;
    evidence_status: string;
    evidence_strength: string;
    conclusion: string;
    next_action: string;
  }[];
  deadlines: { id: string; title: string; due_date: string; source: string }[];
  actions: { id: string; title: string; action_key: string; status: string; priority: number }[];
  evidence: { id: string; file_name: string; document_type: string; processing_status: string }[];
  professional_review: { issue_id: string; title: string } | null;
};

export function evidenceStrengthFromScores(actionReadinessScore: number): PresentationEvidenceStrength {
  if (actionReadinessScore >= 75) return "Strong";
  if (actionReadinessScore >= 40) return "Moderate";
  return "Limited";
}

function isProfessionalReviewIssue(issue: { issueType: string; altAction: string }) {
  if (issue.issueType === "professional_review") return true;
  return /\b(professional review is (?:required|strongly recommended)|licensed professional (?:should|is recommended))/i.test(issue.altAction);
}

export function assemblePresentationContract(input: {
  status: string;
  actionReadinessScore: number;
  reconstruction?: { currentPosition?: string | null; summary?: string | null; timeline?: unknown; pendingActions?: unknown } | null;
  issues: {
    id: string;
    title: string;
    itemKind: string;
    state: string;
    evidenceStatus: string;
    evidenceStrength: string;
    conclusion: string;
    nextAction: string;
    issueType: string;
    altAction: string;
  }[];
  deadlines: { id: string; title: string; dueDate: Date | string; source: string }[];
  actionNodes: { id: string; title: string; actionKey: string; status: string; priority: number }[];
  documents: { id: string; fileName: string; documentType?: string | null; docKind?: string | null; processingStatus: string }[];
  unknowns?: { question: string }[];
  evidenceGateStatus?: string | null;
  conflicts?: { topic: string; description: string; resolution?: string }[];
}): PresentationContract {
  const readyAction = input.actionNodes.find((node) => node.status === "READY" || node.status === "IN_PROGRESS") ?? null;
  const nearestDeadline = input.deadlines[0] ?? null;
  const professionalReview = input.issues.find(isProfessionalReviewIssue) ?? null;
  const timeline = Array.isArray(input.reconstruction?.timeline) ? input.reconstruction.timeline : [];
  const pendingActions = Array.isArray(input.reconstruction?.pendingActions)
    ? input.reconstruction.pendingActions.map(String).filter(Boolean)
    : [];

  return {
    hero: {
      current_posture: input.reconstruction?.currentPosition || input.status.replace(/_/g, " "),
      status: input.status,
      next_best_action: readyAction ? { title: readyAction.title, action_key: readyAction.actionKey } : null,
      nearest_deadline: nearestDeadline
        ? { title: nearestDeadline.title, due_date: new Date(nearestDeadline.dueDate).toISOString() }
        : null,
      evidence_strength: evidenceStrengthFromScores(input.actionReadinessScore),
      professional_review_recommended: Boolean(professionalReview),
    },
    what_this_means: {
      summary: input.reconstruction?.summary || "The case is still being organized from the available information.",
      unresolved_count: input.issues.filter((issue) => issue.state !== "resolved").length,
      pending_actions: pendingActions,
      unknowns: (input.unknowns ?? []).map((item) => item.question).filter(Boolean),
      evidence_gate_status: input.evidenceGateStatus ?? null,
      conflicts: input.conflicts ?? [],
    },
    timeline: timeline as PresentationContract["timeline"],
    findings: input.issues.map((issue) => ({
      id: issue.id,
      title: issue.title,
      group: issue.itemKind,
      state: issue.state,
      evidence_status: issue.evidenceStatus,
      evidence_strength: issue.evidenceStrength,
      conclusion: issue.conclusion,
      next_action: issue.nextAction,
    })),
    deadlines: input.deadlines.map((deadline) => ({
      id: deadline.id,
      title: deadline.title,
      due_date: new Date(deadline.dueDate).toISOString(),
      source: deadline.source,
    })),
    actions: input.actionNodes.map((node) => ({
      id: node.id,
      title: node.title,
      action_key: node.actionKey,
      status: node.status,
      priority: node.priority,
    })),
    evidence: input.documents.map((doc) => ({
      id: doc.id,
      file_name: doc.fileName,
      document_type: doc.documentType || doc.docKind || "other",
      processing_status: doc.processingStatus,
    })),
    professional_review: professionalReview ? { issue_id: professionalReview.id, title: professionalReview.title } : null,
  };
}

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value || "") as T;
  } catch {
    return fallback;
  }
}

export function parsePresentationRecord(row: {
  heroJson: string;
  whatThisMeansJson: string;
  timelineJson: string;
  findingsJson: string;
  deadlinesJson: string;
  actionsJson: string;
  evidenceJson: string;
  professionalReviewJson: string;
}): PresentationContract {
  return {
    hero: parseJson(row.heroJson, {
      current_posture: "",
      status: "",
      next_best_action: null,
      nearest_deadline: null,
      evidence_strength: "Limited" as PresentationEvidenceStrength,
      professional_review_recommended: false,
    }),
    what_this_means: parseJson(row.whatThisMeansJson, {
      summary: "",
      unresolved_count: 0,
      pending_actions: [],
      unknowns: [],
      evidence_gate_status: null,
      conflicts: [],
    }),
    timeline: parseJson(row.timelineJson, []),
    findings: parseJson(row.findingsJson, []),
    deadlines: parseJson(row.deadlinesJson, []),
    actions: parseJson(row.actionsJson, []),
    evidence: parseJson(row.evidenceJson, []),
    professional_review: parseJson(row.professionalReviewJson, null),
  };
}
