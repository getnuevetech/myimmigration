import type { KnowledgeRecord } from "./knowledge-retrieval";
import { rankKnowledgeSources } from "./knowledge-retrieval";
import {
  bestSuggestionLine,
  consultantFromOfficialSources,
  officialSuggestionCandidates,
  rankAuthorityGaps,
  rankGoalSuggestions,
  refineInquiryThemes,
  stricterReferral,
  toPathSteps,
  type SuggestionBoosts,
} from "./goal-suggestions";

export const INQUIRY_MODES = {
  EXISTING_CASE: "existing_case",
  OPEN_OPTIONS: "open_options",
} as const;

export type InquiryMode = (typeof INQUIRY_MODES)[keyof typeof INQUIRY_MODES];

export const INQUIRY_THEMES = [
  "family",
  "employment",
  "asylum",
  "naturalization",
  "student",
  "visitor",
  "humanitarian",
  "parents_children",
  "adjustment",
  "consular",
  "general",
] as const;

export type InquiryTheme = (typeof INQUIRY_THEMES)[number];

export type ImmigrationInquiry = {
  mode: InquiryMode;
  themes: InquiryTheme[];
  hasUscisFileSignals: boolean;
};

export type InquiryClassifyInput = {
  situation?: string;
  goal?: string;
  documentsText?: string;
  documentCount?: number;
  notices?: string[];
  forms?: string[];
  receipts?: string[];
  factKeys?: string[];
};

export type OpenOptionsIssue = {
  issue_type: string;
  item_kind: "opportunity" | "missing_info" | "risk";
  evidence_status: "possible" | "needs_verification";
  evidence_strength: "limited";
  title: string;
  what_we_know: string;
  our_conclusion: string;
  still_unclear: string[];
  explanations: { title: string; detail: string; likelihood: string }[];
  confidence: "low" | "medium";
  priority: "urgent" | "high" | "medium" | "low";
  state: "review" | "info_needed" | "action_needed";
  next_action: string;
  alternative_action: string;
  uscis_basis: string;
  professional_review?: "required" | "recommended" | "probably_unnecessary";
  analysis_outline: { heading: string; detail: string; source?: string }[];
};

export type OpenOptionsPathStep = {
  title: string;
  description: string;
  action_key: string;
};

export type OpenOptionsAnalysis = {
  inquiry: ImmigrationInquiry;
  issues: OpenOptionsIssue[];
  pathSteps: OpenOptionsPathStep[];
  reconstruction: {
    summary: string;
    currentPosition: string;
    pendingActions: string[];
    confidence: "possible";
  };
  unknowns: { key: string; question: string; reason: string }[];
  authorityQueries: string[];
  suggestionKeys?: string[];
};

const RECEIPT_RE = /\b[A-Z]{3}\d{10}\b/;
const NOTICE_EVENT_RE =
  /\b(rfe|noid|noir|noit|i-?797c?|request for evidence|notice of intent(?: to (?:deny|revoke|terminate))?|biometrics (?:notice|appointment)|interview (?:notice|letter|appointment)|denial (?:notice|letter)|approval (?:notice|letter))\b/i;
const FILED_CASE_RE =
  /\b(receipt number|my (?:uscis )?case|case (?:was )?filed|already filed|pending (?:with )?uscis|uscis (?:sent|issued|mailed|received)|received an? (?:rfe|noid|notice|denial|approval)|online case status|case status online)\b/i;
const CORE_FACT_KEYS = new Set(["receipt_number", "form_type", "notice_type"]);

const THEME_PATTERNS: { theme: InquiryTheme; pattern: RegExp }[] = [
  { theme: "family", pattern: /\b(marry|marriage|spouse|husband|wife|green card|permanent resident|i-?130|i-?485|fiancé|fiance|k-?1)\b/i },
  { theme: "parents_children", pattern: /\b(parent|mother|father|child(?:ren)?|son|daughter|bring (?:my|our) (?:parents|kids|family))\b/i },
  { theme: "employment", pattern: /\b(work(?:ing)?(?: authorization| permit)?|job|employer|sponsor(?:ship)?|h-?1b|i-?765|ead|employment)\b/i },
  { theme: "student", pattern: /\b(f-?1|student|opt|cpt|i-?20|graduat(?:e|ing)|study(?:ing)?|school|university|college)\b/i },
  { theme: "naturalization", pattern: /\b(naturaliz(?:e|ation)|n-?400|civics test|oath ceremony|become a (?:u\.?s\.? )?citizen|apply(?:ing)? for (?:u\.?s\.? )?citizenship|citizenship (?:application|interview))\b/i },
  { theme: "asylum", pattern: /\b(asylum|refugee|persecution|i-?589|withholding of removal)\b/i },
  { theme: "humanitarian", pattern: /\b(tps|daca|parole|humanitarian|u visa|t visa|vawa|special immigrant)\b/i },
  { theme: "visitor", pattern: /\b(visit(?:or|ing)?|tourist|b-?1|b-?2|visa waiver|esta)\b/i },
  { theme: "adjustment", pattern: /\b(adjust(?:ment)? of status|i-?485|stay in the (?:u\.?s\.?|united states)|apply from inside)\b/i },
  { theme: "consular", pattern: /\b(consular(?: processing)?|embassy|national visa center|nvc|immigrant visa interview)\b/i },
];

const THEME_AUTHORITY: Record<InquiryTheme, string[]> = {
  family: ["I-130", "I-485"],
  parents_children: ["I-130"],
  employment: ["I-765", "I-129"],
  student: ["I-765", "F-1"],
  naturalization: ["N-400"],
  asylum: ["I-589"],
  humanitarian: ["I-821", "I-821D"],
  visitor: ["B-2"],
  adjustment: ["I-485"],
  consular: ["DS-260", "I-130"],
  general: ["USCIS"],
};

function uniq<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

function combinedText(input: InquiryClassifyInput): string {
  return [input.situation, input.goal, input.documentsText].filter(Boolean).join("\n");
}

export function hasExistingCaseSignals(input: InquiryClassifyInput): boolean {
  const text = combinedText(input);
  if (RECEIPT_RE.test(text.toUpperCase())) return true;
  if (NOTICE_EVENT_RE.test(text) || FILED_CASE_RE.test(text)) return true;
  if ((input.notices ?? []).length > 0) return true;
  if ((input.receipts ?? []).length > 0) return true;
  if ((input.factKeys ?? []).some((key) => CORE_FACT_KEYS.has(key))) return true;
  return false;
}

export function detectInquiryThemes(input: InquiryClassifyInput): InquiryTheme[] {
  const text = combinedText(input);
  const themes = THEME_PATTERNS.filter((item) => item.pattern.test(text)).map((item) => item.theme);
  return themes.length ? uniq(themes) : ["general"];
}

export function classifyImmigrationInquiry(input: InquiryClassifyInput): ImmigrationInquiry {
  const hasUscisFileSignals = hasExistingCaseSignals(input);
  return {
    mode: hasUscisFileSignals ? INQUIRY_MODES.EXISTING_CASE : INQUIRY_MODES.OPEN_OPTIONS,
    themes: detectInquiryThemes(input),
    hasUscisFileSignals,
  };
}

export function authorityQueriesForInquiry(inquiry: ImmigrationInquiry): string[] {
  return uniq(inquiry.themes.flatMap((theme) => THEME_AUTHORITY[theme] ?? []));
}

function firstSentences(text: string, count = 2): string {
  const parts = text.replace(/\s+/g, " ").trim().split(/(?<=\.)\s+/);
  return parts.slice(0, count).join(" ").trim();
}

function slugKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 48) || "needed_fact";
}

function alreadyStated(item: string, userText: string): boolean {
  const hay = userText.toLowerCase();
  const words = item
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 4);
  if (words.length === 0) return hay.includes(item.toLowerCase());
  const hits = words.filter((word) => hay.includes(word)).length;
  return hits >= Math.min(2, words.length);
}

export function evidenceItemsFromAuthority(content: string): string[] {
  const items: string[] = [];
  const listRe =
    /(?:includes?|including|check(?:s|ed)?|consider|require[sd]?|needed|must (?:include|provide|show)|evidence (?:usually )?(?:includes?|needed))\s+([^.]{12,240})/gi;
  for (const match of content.matchAll(listRe)) {
    for (const part of match[1].split(/,|;|\band\b/i)) {
      const item = part.replace(/^(the|any|an|a)\s+/i, "").trim();
      if (item.length >= 10 && item.length <= 90 && !/vary|depends/i.test(item)) items.push(item);
    }
  }
  return uniq(items).slice(0, 8);
}

export function deriveAuthorityGaps(
  sources: KnowledgeRecord[],
  userText: string,
): { key: string; question: string; reason: string; item: string }[] {
  const gaps: { key: string; question: string; reason: string; item: string }[] = [];
  const seen = new Set<string>();
  for (const source of sources) {
    for (const item of evidenceItemsFromAuthority(source.content)) {
      if (alreadyStated(item, userText)) continue;
      const key = slugKey(item);
      if (seen.has(key)) continue;
      seen.add(key);
      gaps.push({
        key,
        question: `What can you share about ${item}?`,
        reason: `${source.reference || source.title} lists this among the facts or evidence that usually matter.`,
        item,
      });
    }
  }
  const hay = userText.toLowerCase();
  if (!/\b(status|citizen|green card|permanent resident|f-?1|h-?1b|asylum|visitor|undocumented|daca|tps|opt)\b/i.test(hay)) {
    gaps.unshift({
      key: "current_status",
      question: "What is your current immigration status, if any?",
      reason: "USCIS and DOJ eligibility rules start from current status.",
      item: "current immigration status",
    });
  }
  if (!/\b(united states|in the u\.?s|inside the us|abroad|embassy|consul)\b/i.test(hay)) {
    gaps.push({
      key: "location",
      question: "Are you in the United States now, or would this be handled from abroad?",
      reason: "The matching USCIS process is different inside the United States than at a consulate.",
      item: "location",
    });
  }
  return gaps.slice(0, 8);
}

export type ConsultantReferral = {
  level: "required" | "recommended" | "probably_unnecessary";
  reason: string;
};

export function evaluateConsultantReferral(input: {
  text: string;
  inquiry?: ImmigrationInquiry;
  notices?: string[];
  sources?: KnowledgeRecord[];
}): ConsultantReferral {
  const fromSources = consultantFromOfficialSources(input.sources ?? []);
  const text = input.text.toLowerCase();
  let fromFacts: ConsultantReferral = { level: "probably_unnecessary", reason: "The described question can be outlined from official material, with a professional review before any filing." };
  if (/\b(asylum|refugee|persecution|withholding of removal|credible fear|convention against torture)\b/.test(text)) {
    fromFacts = { level: "required", reason: "Protection and asylum questions are high-stakes and fact-specific under USCIS and DOJ/EOIR rules." };
  } else if (/\b(removal|deport|immigration court|eoir|notice to appear|\bnta\b|detained|criminal conviction)\b/.test(text)) {
    fromFacts = { level: "required", reason: "Immigration court, removal, or criminal-immigration issues should be reviewed by a licensed professional." };
  } else if ((input.notices ?? []).some((notice) => ["NOID", "NOIR", "NOIT"].includes(notice.toUpperCase())) || /\b(noid|notice of intent to deny)\b/.test(text)) {
    fromFacts = { level: "required", reason: "A Notice of Intent to Deny is a serious USCIS action and should be reviewed by a licensed professional before a response." };
  } else if (/\b(rfe|request for evidence)\b/.test(text) && /\b(deadline|within \d+ days|respond by)\b/.test(text)) {
    fromFacts = { level: "recommended", reason: "An RFE with a running deadline can change the case outcome if the response is incomplete." };
  } else if (input.inquiry?.mode === INQUIRY_MODES.EXISTING_CASE && /\b(denial|denied)\b/.test(text)) {
    fromFacts = { level: "recommended", reason: "A denial or likely denial should be reviewed before the next filing or appeal." };
  }
  return fromSources ? stricterReferral(fromSources, fromFacts) : fromFacts;
}

function issueFromSource(
  source: KnowledgeRecord,
  known: string,
  gaps: { question: string }[],
  referral: ConsultantReferral,
): OpenOptionsIssue {
  const rule = firstSentences(source.content, 2);
  const highStakes = referral.level === "required";
  return {
    issue_type: highStakes ? "professional_review" : "pathway_option",
    item_kind: highStakes ? "risk" : "opportunity",
    evidence_status: "possible",
    evidence_strength: "limited",
    title: source.title,
    what_we_know: known,
    our_conclusion: `${rule} This is a possible path only if those conditions fit the facts you described. It is not a decision, approval, or reconstructed case file.`,
    still_unclear: gaps.slice(0, 5).map((item) => item.question),
    explanations: [
      {
        title: source.reference || "Official material",
        detail: source.url
          ? `${rule} Official source: ${source.url}`
          : rule,
        likelihood: "Possible",
      },
    ],
    confidence: "low",
    priority: highStakes ? "high" : "medium",
    state: highStakes ? "action_needed" : "review",
    next_action: highStakes ? "REVIEW_ANALYSIS" : gaps.length ? "ADD_CASE_DETAILS" : "REVIEW_ANALYSIS",
    alternative_action: highStakes
      ? `Talk with a licensed immigration attorney or accredited representative. ${referral.reason}`
      : referral.level === "recommended"
        ? `A licensed professional is recommended before you file. ${referral.reason}`
        : "Ask a follow-up about this official material before you file anything.",
    uscis_basis: source.reference || source.title,
    professional_review: referral.level,
    analysis_outline: [
      { heading: "Your situation", detail: known },
      { heading: "Immigration rules", detail: source.content.slice(0, 500), source: source.reference || source.title },
      { heading: "Your evidence", detail: "This options review uses the facts you shared and the official material above." },
      { heading: "Our conclusion", detail: "This material may apply. Confirm the missing facts before treating it as your path." },
      { heading: "Your next move", detail: gaps[0]?.question ?? "Ask a follow-up about this official material." },
    ],
  };
}

export function openOptionsReconstruction(inquiry: ImmigrationInquiry, goal = "", sources: KnowledgeRecord[] = []): OpenOptionsAnalysis["reconstruction"] {
  const goalText = goal.trim().replace(/[.]+$/, "");
  const sourceNames = sources.map((source) => source.reference || source.title).filter(Boolean).slice(0, 3).join(", ");
  const summary = goalText
    ? `You asked about ${goalText}. Matching official USCIS/DOJ material${sourceNames ? ` (${sourceNames})` : ""} outlines possible paths and conditions for this goal — not a decision, approval, or reconstructed filing.`
    : sourceNames
      ? `Matching official material for this goal includes ${sourceNames}.`
      : "Matching official USCIS and DOJ material can outline possible paths once we have your goal and current status.";
  return {
    summary,
    currentPosition: "Exploring immigration options",
    pendingActions: sources.length
      ? [`Review ${sources[0].title}`, "Share the facts and records that official material lists as relevant"]
      : ["Share the facts that change which official rule applies"],
    confidence: "possible",
  };
}

export function openOptionsPathSteps(
  sources: KnowledgeRecord[] = [],
  gaps: { question: string; item: string }[] = [],
  referral: ConsultantReferral = { level: "probably_unnecessary", reason: "" },
  boosts: SuggestionBoosts = {},
): OpenOptionsPathStep[] {
  return toPathSteps(rankGoalSuggestions(officialSuggestionCandidates(sources, gaps, referral), boosts));
}

export function buildOpenOptionsAnalysis(
  input: InquiryClassifyInput,
  inquiry = classifyImmigrationInquiry(input),
  sources: KnowledgeRecord[] = [],
  boosts: SuggestionBoosts = {},
): OpenOptionsAnalysis {
  const situation = (input.situation ?? "").trim();
  const goal = (input.goal ?? "").trim();
  const known = [situation, goal].filter(Boolean).join(" ").trim() || "You described an immigration goal.";
  const rankHint = {
    query: known,
    inquiryMode: inquiry.mode,
    themes: inquiry.themes,
    authorityQueries: authorityQueriesForInquiry(inquiry),
  };
  let ranked = sources.length ? rankKnowledgeSources(sources, rankHint, 3) : [];
  const refinedThemes = refineInquiryThemes(inquiry.themes, ranked);
  if (ranked.length && refinedThemes.join("|") !== inquiry.themes.join("|")) {
    inquiry = { ...inquiry, themes: refinedThemes };
    ranked = rankKnowledgeSources(sources, { ...rankHint, themes: refinedThemes }, 3);
  }
  const gaps = rankAuthorityGaps(deriveAuthorityGaps(ranked, known), boosts);
  const referral = evaluateConsultantReferral({ text: known, inquiry, sources: ranked });
  const issues: OpenOptionsIssue[] = ranked.map((source) => issueFromSource(source, known, gaps, referral));
  if (referral.level === "required" && !issues.some((issue) => issue.issue_type === "professional_review")) {
    issues.unshift({
      issue_type: "professional_review",
      item_kind: "risk",
      evidence_status: "needs_verification",
      evidence_strength: "limited",
      title: "Licensed professional review is needed",
      what_we_know: known,
      our_conclusion: referral.reason,
      still_unclear: gaps.map((item) => item.question),
      explanations: [{ title: "Why a professional", detail: referral.reason, likelihood: "Likely" }],
      confidence: "medium",
      priority: "high",
      state: "action_needed",
      next_action: "REVIEW_ANALYSIS",
      alternative_action: referral.reason,
      uscis_basis: ranked[0]?.reference || "USCIS / DOJ",
      professional_review: "required",
      analysis_outline: [
        { heading: "Your situation", detail: known },
        { heading: "Immigration rules", detail: referral.reason },
        { heading: "Your evidence", detail: "The facts you described are enough to know this is not a self-serve filing question." },
        { heading: "Our conclusion", detail: referral.reason },
        { heading: "Your next move", detail: "Connect with a licensed immigration attorney or accredited representative." },
      ],
    });
  }
  if (!issues.length) {
    issues.push({
      issue_type: "pathway_option",
      item_kind: "missing_info",
      evidence_status: "needs_verification",
      evidence_strength: "limited",
      title: "Matching official material is still needed for this question",
      what_we_know: known,
      our_conclusion:
        "We will not invent a form, notice, or eligibility finding. Share a bit more about status, location, and the outcome you want so the matching USCIS or DOJ material can be pulled.",
      still_unclear: gaps.map((item) => item.question),
      explanations: [
        {
          title: "No canned path",
          detail: "Options are taken from official USCIS/DOJ material that matches this question, not from a fixed list of stories.",
          likelihood: "Possible",
        },
      ],
      confidence: "low",
      priority: "medium",
      state: "info_needed",
      next_action: "ADD_CASE_DETAILS",
      alternative_action: "Ask a follow-up with more facts so the right official rule can be retrieved.",
      uscis_basis: "USCIS",
      professional_review: referral.level,
      analysis_outline: [
        { heading: "Your situation", detail: known },
        { heading: "Immigration rules", detail: "No matching USCIS or DOJ excerpt was retrieved for this wording yet." },
        { heading: "Your evidence", detail: "Share the facts that change which official rule applies." },
        { heading: "Our conclusion", detail: "More of your facts are needed before naming a form or path." },
        { heading: "Your next move", detail: gaps[0]?.question ?? "Add your current status and the outcome you want." },
      ],
    });
  } else if (gaps.length) {
    issues.push({
      issue_type: "pathway_option",
      item_kind: "missing_info",
      evidence_status: "needs_verification",
      evidence_strength: "limited",
      title: "A few facts from the official material will narrow this",
      what_we_know: known,
      our_conclusion: "These follow-ups come from the matching USCIS or DOJ material, not from a generic checklist.",
      still_unclear: gaps.map((item) => item.question),
      explanations: ranked[0]
        ? [{ title: ranked[0].title, detail: `Missing items were read from ${ranked[0].reference || ranked[0].title}.`, likelihood: "Possible" }]
        : [],
      confidence: "low",
      priority: "medium",
      state: "info_needed",
      next_action: "ADD_CASE_DETAILS",
      alternative_action: "If you later receive a USCIS notice, upload it so the review can use that record.",
      uscis_basis: ranked[0]?.reference || "USCIS",
      professional_review: referral.level,
      analysis_outline: [
        { heading: "Your situation", detail: known },
        { heading: "Immigration rules", detail: ranked[0] ? firstSentences(ranked[0].content) : "Matching official material still needs a few facts from you." },
        { heading: "Your evidence", detail: "The follow-ups below come from the matching official material." },
        { heading: "Our conclusion", detail: "Answer the gaps listed by the official material before treating a path as yours." },
        { heading: "Your next move", detail: gaps[0].question },
      ],
    });
  }
  const pathSteps = openOptionsPathSteps(ranked, gaps, referral, boosts);
  return {
    inquiry,
    issues,
    pathSteps,
    reconstruction: openOptionsReconstruction(inquiry, goal || situation, ranked),
    unknowns: gaps.map(({ key, question, reason }) => ({ key, question, reason })),
    authorityQueries: uniq([
      ...authorityQueriesForInquiry(inquiry),
      ...ranked.map((source) => source.reference).filter(Boolean),
    ]),
    suggestionKeys: uniq([
      ...pathSteps.map((step) => step.action_key),
      ...gaps.map((item) => `question:${item.key}`),
    ]),
  };
}

export function applyInquiryToEvidenceState<
  T extends {
    facts: { key: string }[];
    unknowns: { key: string; question: string; reason: string }[];
    audit: { status: string; summary: string; blockingUnknowns: string[]; warnings: string[] };
    reconstruction: {
      summary: string;
      currentPosition: string;
      timeline: unknown;
      pendingActions: string[];
      confidence: string;
    };
  },
>(state: T, inquiry: ImmigrationInquiry, narrative = "", sources: KnowledgeRecord[] = [], boosts: SuggestionBoosts = {}): T {
  if (inquiry.mode !== INQUIRY_MODES.OPEN_OPTIONS) return state;
  if (state.facts.some((fact) => CORE_FACT_KEYS.has(fact.key))) return state;
  const options = buildOpenOptionsAnalysis({ situation: narrative, goal: narrative }, inquiry, sources, boosts);
  const identifierUnknowns = new Set(["receipt_number", "form_type", "notice_type"]);
  const keptUnknowns = state.unknowns.filter((item) => !identifierUnknowns.has(item.key) && !item.key.startsWith("conflict_"));
  const unknowns = [...options.unknowns, ...keptUnknowns];
  const auditStatus = state.audit.status === "blocked" || state.audit.status === "pass" ? "needs_more_evidence" : state.audit.status;
  return {
    ...state,
    unknowns,
    audit: {
      ...state.audit,
      status: auditStatus,
      summary: "Possible pathways come from matching official USCIS or DOJ material for this goal and the facts you shared.",
      blockingUnknowns: unknowns.map((item) => item.key),
      warnings: state.audit.warnings.filter((warning) => !/receipt number|form type|notice type/i.test(warning)),
    },
    reconstruction: {
      ...state.reconstruction,
      summary: options.reconstruction.summary,
      currentPosition: options.reconstruction.currentPosition,
      pendingActions: options.reconstruction.pendingActions,
      confidence: options.reconstruction.confidence,
    },
  };
}

export function buildQaFallbackAnswer(input: {
  question: string;
  knowledge?: string;
  sources?: KnowledgeRecord[];
  inquiry?: ImmigrationInquiry;
  hasLinkedCase?: boolean;
  boosts?: SuggestionBoosts;
}): string {
  const inquiry = input.inquiry ?? classifyImmigrationInquiry({ situation: input.question, goal: input.question });
  const options = buildOpenOptionsAnalysis({ situation: input.question, goal: input.question }, inquiry, input.sources ?? [], input.boosts);
  const ranked = options.issues
    .map((issue) => (input.sources ?? []).find((source) => source.title === issue.title))
    .filter((source): source is KnowledgeRecord => Boolean(source));
  const knowledge = ranked.length
    ? ranked.map((source) => `${source.title} (${source.reference})${source.url ? ` ${source.url}` : ""}\n${firstSentences(source.content, 3)}`).join("\n\n")
    : (input.knowledge ?? "").trim();
  const referral = evaluateConsultantReferral({ text: input.question, inquiry, sources: ranked.length ? ranked : input.sources });
  const lines: string[] = [];
  lines.push("ImmigrationOnMe is not USCIS, a law firm, or a substitute for a licensed attorney or accredited representative.");
  if (inquiry.mode === INQUIRY_MODES.OPEN_OPTIONS && !input.hasLinkedCase) {
    const matched = (ranked.length ? ranked : input.sources ?? []).slice(0, 3).map((source) => source.title).join("; ");
    lines.push(
      matched
        ? `You do not need a USCIS case, letter, or receipt on file for this kind of question. The closest official material on file is: ${matched}.`
        : "You do not need a USCIS case, letter, or receipt on file to ask what options might exist.",
    );
    lines.push(
      "Possible paths should be treated as options with conditions — not as a decision, not as eligibility, and not as a reconstructed case. Never assume a receipt number, deadline, or notice you did not provide.",
    );
  } else if (input.hasLinkedCase) {
    lines.push("If this question is about a case already in your account, use the approved presentation on that case as the source of posture, next action, and deadlines.");
  }
  if (knowledge) {
    lines.push("From matching USCIS or DOJ reference material:");
    lines.push(knowledge.slice(0, 1600));
  } else {
    lines.push(
      "I could not pull matching official material just now. Add your current status, location, and the outcome you want so the right USCIS or DOJ rule can be retrieved.",
    );
  }
  const nextLine = bestSuggestionLine(options.pathSteps);
  if (nextLine && inquiry.mode === INQUIRY_MODES.OPEN_OPTIONS) lines.push(nextLine);
  if (referral.level === "required") {
    lines.push(`Based on what you described, a licensed professional should be involved before you act. ${referral.reason}`);
  } else if (referral.level === "recommended") {
    lines.push(`A licensed professional is recommended before you file or respond. ${referral.reason}`);
  }
  return lines.join("\n\n");
}

export const OPEN_OPTIONS_POSTURE = "Exploring immigration options";

