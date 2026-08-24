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
  { theme: "naturalization", pattern: /\b(citizen(?:ship)?|naturaliz(?:e|ation)|n-?400|civics test|oath ceremony)\b/i },
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

function themeLabel(theme: InquiryTheme): string {
  switch (theme) {
    case "family":
      return "family-based immigration";
    case "parents_children":
      return "bringing parents or children";
    case "employment":
      return "work authorization or employment sponsorship";
    case "student":
      return "student status and after-graduation options";
    case "naturalization":
      return "U.S. citizenship / naturalization";
    case "asylum":
      return "asylum or protection";
    case "humanitarian":
      return "humanitarian or temporary protection";
    case "visitor":
      return "visitor travel";
    case "adjustment":
      return "adjustment of status inside the United States";
    case "consular":
      return "consular processing from abroad";
    default:
      return "U.S. immigration options";
  }
}

function themeIssue(theme: InquiryTheme, situation: string, goal: string): OpenOptionsIssue {
  const known = [situation, goal].filter((part) => part.trim()).join(" ").trim() || "You described an immigration goal without a USCIS case file.";
  const base = {
    issue_type: "pathway_option",
    item_kind: "opportunity" as const,
    evidence_status: "possible" as const,
    evidence_strength: "limited" as const,
    confidence: "low" as const,
    priority: "medium" as const,
    state: "review" as const,
    next_action: "ADD_CASE_DETAILS",
    alternative_action: "Talk with a licensed immigration attorney or accredited representative before filing anything high-stakes.",
  };

  const issues: Record<InquiryTheme, Omit<OpenOptionsIssue, keyof typeof base> & Partial<OpenOptionsIssue>> = {
    family: {
      title: "A family green card path may be possible",
      what_we_know: known,
      our_conclusion:
        "If you have a qualifying relative who is a U.S. citizen or lawful permanent resident, a family petition (often Form I-130) can be a starting point. Approval of that petition alone does not give status. Next steps depend on whether you would apply from inside the United States or through a U.S. embassy or consulate, and on the petitioner's status.",
      still_unclear: [
        "Who the petitioner would be and their U.S. status",
        "Whether you are inside the United States now",
        "Whether any prior overstay, unlawful presence, or other bar could affect filing",
      ],
      explanations: [
        {
          title: "Family petition vs. status",
          detail: "A relative petition shows the relationship. A separate application is usually needed for a green card or immigrant visa.",
          likelihood: "Likely",
        },
      ],
      uscis_basis: "I-130",
      analysis_outline: [
        { heading: "Your situation", detail: known },
        { heading: "Immigration rules", detail: "Form I-130 is used to show a qualifying family relationship. It does not by itself grant a green card.", source: "I-130" },
        { heading: "Your evidence", detail: "No USCIS case file is on record yet. This is an options review from your description." },
        { heading: "Our conclusion", detail: "A family-based path may exist if the relationship and petitioner status qualify." },
        { heading: "Your next move", detail: "Tell us the relationship, the petitioner's status, and whether you are in the United States." },
      ],
    },
    parents_children: {
      title: "A path to bring parents or children may exist",
      what_we_know: known,
      our_conclusion:
        "U.S. citizens and some lawful permanent residents can petition for certain parents or children. Age, marital status, and the petitioner's own status change which category applies and how long it can take.",
      still_unclear: ["Petitioner's status (citizen or permanent resident)", "Each relative's age and marital status", "Whether anyone would apply from inside the United States or abroad"],
      explanations: [{ title: "Category matters", detail: "Immediate relatives of U.S. citizens follow a different wait than family-preference categories.", likelihood: "Likely" }],
      uscis_basis: "I-130",
      analysis_outline: [
        { heading: "Your situation", detail: known },
        { heading: "Immigration rules", detail: "Family petitions use Form I-130. Who can file, and for whom, depends on status and the family relationship.", source: "I-130" },
        { heading: "Your evidence", detail: "No filed case is on record. Options are based on the family situation you described." },
        { heading: "Our conclusion", detail: "A petition may be possible once we know who would file and for which relative." },
        { heading: "Your next move", detail: "List each relative, their relationship to you, and your (or the petitioner's) current status." },
      ],
    },
    employment: {
      title: "Work authorization or employer sponsorship may be an option",
      what_we_know: known,
      our_conclusion:
        "Work options in the United States usually depend on current status, whether an employer will sponsor a visa, and whether a work-permit form such as I-765 is available in your category. There is no general walk-in work permit for people without a qualifying status or petition.",
      still_unclear: ["Your current status, if any", "Whether an employer is willing to sponsor you", "Whether you already have a pending petition or EAD category"],
      explanations: [{ title: "Status first", detail: "Most work authorization is tied to a specific visa, pending application, or humanitarian category — not to having a job offer alone.", likelihood: "Likely" }],
      uscis_basis: "I-765",
      analysis_outline: [
        { heading: "Your situation", detail: known },
        { heading: "Immigration rules", detail: "Form I-765 is only for people in a category that already allows a work permit. Employer visas usually need a petition from the employer.", source: "I-765" },
        { heading: "Your evidence", detail: "No USCIS employment case is on file yet." },
        { heading: "Our conclusion", detail: "Work may be possible if a qualifying status or sponsor exists." },
        { heading: "Your next move", detail: "Share your current status and whether an employer can sponsor you." },
      ],
    },
    student: {
      title: "Student and after-graduation options can be mapped",
      what_we_know: known,
      our_conclusion:
        "People in F-1 status often look at Optional Practical Training, a change of status, or an employer-sponsored visa after graduation. Timing, unemployment limits, and the school’s international office rules all matter. None of that should be treated as a filed USCIS case until a form is actually submitted.",
      still_unclear: ["Current student status and program end date", "Whether OPT or CPT is already authorized", "Whether you want to stay, work, or change status"],
      explanations: [{ title: "School and USCIS", detail: "The I-20 and DSO process is separate from a USCIS benefit application. Both may be needed depending on the path.", likelihood: "Likely" }],
      uscis_basis: "I-765",
      next_action: "ADD_CASE_DETAILS",
      analysis_outline: [
        { heading: "Your situation", detail: known },
        { heading: "Immigration rules", detail: "F-1 students may apply for OPT work authorization in limited windows. Changing status or getting a new visa has separate rules.", source: "I-765" },
        { heading: "Your evidence", detail: "No student-benefit filing is on record yet." },
        { heading: "Our conclusion", detail: "There are possible next steps after graduation, but they depend on dates and current status." },
        { heading: "Your next move", detail: "Share your program end date, current status, and whether you want to work or stay in school." },
      ],
    },
    naturalization: {
      title: "Naturalization may be possible if you already have a green card",
      what_we_know: known,
      our_conclusion:
        "Form N-400 is for lawful permanent residents who meet residence, physical presence, and other requirements. If you do not already have a green card, citizenship is not the first form — a green-card path comes first.",
      still_unclear: ["Whether you are already a lawful permanent resident", "How long you have held that status", "Long trips outside the United States and any issues that could affect good moral character"],
      explanations: [{ title: "Green card first", detail: "Naturalization generally requires permanent resident status for a required period, with some exceptions such as certain military cases.", likelihood: "Likely" }],
      uscis_basis: "N-400",
      analysis_outline: [
        { heading: "Your situation", detail: known },
        { heading: "Immigration rules", detail: "Form N-400 is the naturalization application for eligible permanent residents.", source: "N-400" },
        { heading: "Your evidence", detail: "No naturalization filing is on record yet." },
        { heading: "Our conclusion", detail: "Citizenship may be a fit only if permanent resident requirements are met." },
        { heading: "Your next move", detail: "Tell us whether you have a green card and since when." },
      ],
    },
    asylum: {
      title: "A protection path may exist — this is high-stakes",
      what_we_know: known,
      our_conclusion:
        "Asylum and related protection filings are fact-specific and time-sensitive. Form I-589 is one common form, but eligibility, one-year filing rules, and credible fear or court processes depend on your history. This is not something to guess from a short summary.",
      still_unclear: ["When you last entered the United States", "Whether you have already been in immigration court", "The facts that make you fear return"],
      explanations: [{ title: "Get qualified help", detail: "Protection cases can affect your safety and future filings. A licensed professional should review them.", likelihood: "Likely" }],
      uscis_basis: "I-589",
      item_kind: "risk",
      priority: "high",
      state: "action_needed",
      next_action: "REVIEW_ANALYSIS",
      alternative_action: "Speak with a licensed immigration attorney or accredited representative experienced in asylum as soon as you can.",
      analysis_outline: [
        { heading: "Your situation", detail: known },
        { heading: "Immigration rules", detail: "Asylum has strict timing and evidence rules. Filing the wrong way, or waiting too long, can cause serious harm.", source: "I-589" },
        { heading: "Your evidence", detail: "No protection filing is on record in this app yet." },
        { heading: "Our conclusion", detail: "A protection option may exist, but it needs careful, professional review." },
        { heading: "Your next move", detail: "Ask a follow-up question here, and connect with a qualified professional before you file." },
      ],
    },
    humanitarian: {
      title: "Humanitarian or temporary protection options may apply",
      what_we_know: known,
      our_conclusion:
        "Programs such as TPS, DACA, parole, or certain humanitarian visas are category-specific. Each has its own who-qualifies rules, dates, and forms. None should be assumed from a label alone.",
      still_unclear: ["Which program you think may apply", "Your country of nationality and current status", "Whether you have ever had TPS, DACA, or parole before"],
      explanations: [{ title: "Program rules differ", detail: "TPS, DACA, and parole are different benefits with different forms and deadlines.", likelihood: "Possible" }],
      uscis_basis: "USCIS humanitarian programs",
      analysis_outline: [
        { heading: "Your situation", detail: known },
        { heading: "Immigration rules", detail: "Humanitarian programs are limited to named countries or fact patterns. Check current USCIS program pages before assuming you qualify." },
        { heading: "Your evidence", detail: "No humanitarian filing is on record yet." },
        { heading: "Our conclusion", detail: "A humanitarian option might exist if a current program matches your facts." },
        { heading: "Your next move", detail: "Share nationality, current status, and any prior TPS, DACA, or parole." },
      ],
    },
    visitor: {
      title: "Visitor travel has a different set of rules than staying permanently",
      what_we_know: known,
      our_conclusion:
        "Visitor visas and visa-waiver travel are for temporary visits. They are not a green-card process. Overstaying or using a visitor stay to live and work in the United States can create bars to later benefits.",
      still_unclear: ["Whether you are planning a trip or already in the United States", "How long you intend to stay", "Whether you also want a longer-term status"],
      explanations: [{ title: "Temporary vs. immigrant intent", detail: "Visitor status is for short visits. Immigrant petitions follow a different process.", likelihood: "Likely" }],
      uscis_basis: "B-2",
      analysis_outline: [
        { heading: "Your situation", detail: known },
        { heading: "Immigration rules", detail: "B-1/B-2 and visa-waiver travel are for temporary visits. They do not authorize work or permanent residence." },
        { heading: "Your evidence", detail: "No visitor filing is on record yet." },
        { heading: "Our conclusion", detail: "Visitor rules may apply for a short trip; a different path is needed to stay permanently." },
        { heading: "Your next move", detail: "Say whether this is a short visit or you want a longer-term option." },
      ],
    },
    adjustment: {
      title: "Adjustment of status may be possible from inside the United States",
      what_we_know: known,
      our_conclusion:
        "Form I-485 is used to apply for a green card from inside the United States when a person is eligible. Eligibility usually needs an underlying petition or category, a lawful entry in many cases, and no applying bar. Being in the United States is not enough by itself.",
      still_unclear: ["Your current status and how you last entered", "Whether an immigrant petition is already approved or pending", "Whether any unlawful presence or other bar applies"],
      explanations: [{ title: "Petition plus adjustment", detail: "Many people need an approved or concurrently filed immigrant petition before I-485 can succeed.", likelihood: "Likely" }],
      uscis_basis: "I-485",
      next_action: "COMPLETE_FORM_I485",
      analysis_outline: [
        { heading: "Your situation", detail: known },
        { heading: "Immigration rules", detail: "Form I-485 is adjustment of status. It is only for people who already qualify in a specific immigrant category.", source: "I-485" },
        { heading: "Your evidence", detail: "No adjustment filing is on record yet." },
        { heading: "Our conclusion", detail: "Adjustment might be a path if a qualifying category and entry history line up." },
        { heading: "Your next move", detail: "Share how you entered, your current status, and any family or employer petition." },
      ],
    },
    consular: {
      title: "Consular processing may be the path if you will apply from abroad",
      what_we_know: known,
      our_conclusion:
        "If you will complete the green-card process at a U.S. embassy or consulate, that is consular processing, often after a petition such as I-130. It is different from filing I-485 inside the United States.",
      still_unclear: ["Whether you are currently abroad or in the United States", "Whether a family or employer petition already exists", "Which embassy or consulate would likely process the visa"],
      explanations: [{ title: "Two places to apply", detail: "Some people adjust status in the United States. Others finish through the National Visa Center and a consulate.", likelihood: "Likely" }],
      uscis_basis: "I-130",
      analysis_outline: [
        { heading: "Your situation", detail: known },
        { heading: "Immigration rules", detail: "Consular processing is used when the immigrant visa is issued abroad after a petition is approved." },
        { heading: "Your evidence", detail: "No consular case file is on record yet." },
        { heading: "Our conclusion", detail: "Applying from abroad may be the right track if you cannot or should not file I-485." },
        { heading: "Your next move", detail: "Tell us where you live now and whether a petition is already in process." },
      ],
    },
    general: {
      title: "Possible U.S. immigration paths can still be outlined",
      what_we_know: known,
      our_conclusion:
        "You do not need a USCIS receipt or notice to explore what might be possible. Family, work, school, humanitarian, and citizenship paths each have different starting forms and conditions. The next step is to match your facts to those paths — not to invent a case number.",
      still_unclear: ["Your current status, if any", "Your main goal (stay, work, study, family, protection, citizenship)", "Whether anyone in your family is a U.S. citizen or permanent resident"],
      explanations: [{ title: "Options first", detail: "An options review lists possible paths with conditions. It is not a decision and not a filed-case reconstruction.", likelihood: "Possible" }],
      uscis_basis: "USCIS",
      analysis_outline: [
        { heading: "Your situation", detail: known },
        { heading: "Immigration rules", detail: "Different goals use different forms. No single form fits every person." },
        { heading: "Your evidence", detail: "No USCIS case file is on record. Analysis uses your description and public USCIS rules." },
        { heading: "Our conclusion", detail: "There are possible next steps once we know status, family ties, and your goal." },
        { heading: "Your next move", detail: "Add a few facts: current status, family or work ties, and the outcome you want." },
      ],
    },
  };

  const specific = issues[theme];
  return { ...base, ...specific } as OpenOptionsIssue;
}

export function openOptionsReconstruction(inquiry: ImmigrationInquiry, goal = ""): OpenOptionsAnalysis["reconstruction"] {
  const themeText = inquiry.themes.filter((theme) => theme !== "general").map(themeLabel).join(", ");
  const goalText = goal.trim().replace(/[.]+$/, "");
  const summary = goalText
    ? `You asked about ${goalText}. No USCIS case file is on record, so this is an options review — possible paths and conditions, not a reconstructed filing.`
    : themeText
      ? `You may have options related to ${themeText}. No USCIS case file is on record yet.`
      : "You can explore immigration options without a USCIS case, letter, or notice on file.";
  return {
    summary,
    currentPosition: "Exploring immigration options",
    pendingActions: ["Clarify the facts that change which path fits", "Review matching USCIS forms if a path looks relevant"],
    confidence: "possible",
  };
}

export function openOptionsUnknowns(inquiry: ImmigrationInquiry): { key: string; question: string; reason: string }[] {
  const unknowns: { key: string; question: string; reason: string }[] = [
    {
      key: "current_status",
      question: "What is your current immigration status, if any?",
      reason: "Current status changes which options are even available.",
    },
    {
      key: "desired_outcome",
      question: "What outcome matters most right now — stay, work, study, family, protection, or citizenship?",
      reason: "The goal selects which pathway to explain first.",
    },
  ];
  if (inquiry.themes.includes("family") || inquiry.themes.includes("parents_children")) {
    unknowns.push({
      key: "qualifying_relative",
      question: "Do you have a U.S. citizen or permanent resident spouse, parent, or child who could petition?",
      reason: "Family paths depend on a qualifying petitioner.",
    });
  }
  if (inquiry.themes.includes("employment") || inquiry.themes.includes("student")) {
    unknowns.push({
      key: "work_or_school",
      question: "Do you have a school program, job offer, or employer who might sponsor you?",
      reason: "Work and student options often need a school or employer.",
    });
  }
  return unknowns;
}

export function openOptionsPathSteps(): OpenOptionsPathStep[] {
  return [
    {
      title: "Clarify the facts that change which path fits",
      description: "Share current status, family or work ties, and the outcome you want. You do not need a receipt number to do this.",
      action_key: "ADD_CASE_DETAILS",
    },
    {
      title: "Review matching USCIS forms",
      description: "If a path looks relevant, open the related form worksheet so you can see what filing would involve before you file anything.",
      action_key: "COMPLETE_FORM_I485",
    },
    {
      title: "Ask a follow-up about these options",
      description: "Use Q&A to ask anything else — including questions with no USCIS case on file. For high-stakes choices, also talk with a licensed professional.",
      action_key: "REVIEW_ANALYSIS",
    },
  ];
}

export function buildOpenOptionsAnalysis(input: InquiryClassifyInput, inquiry = classifyImmigrationInquiry(input)): OpenOptionsAnalysis {
  const situation = (input.situation ?? "").trim();
  const goal = (input.goal ?? "").trim();
  const themes = inquiry.themes.includes("general") && inquiry.themes.length > 1
    ? inquiry.themes.filter((theme) => theme !== "general")
    : inquiry.themes;
  const issues = themes.slice(0, 4).map((theme) => themeIssue(theme, situation, goal));
  if (!issues.some((issue) => issue.item_kind === "missing_info")) {
    issues.push({
      issue_type: "pathway_option",
      item_kind: "missing_info",
      evidence_status: "needs_verification",
      evidence_strength: "limited",
      title: "A few facts will narrow the options",
      what_we_know: "No USCIS receipt, notice, or filed form is on record. That does not block an options review.",
      our_conclusion: "The remaining questions are about your life situation — status, family, work, school — not about uploading a case file you do not have.",
      still_unclear: openOptionsUnknowns(inquiry).map((item) => item.question),
      explanations: [
        {
          title: "Documents are optional",
          detail: "If you later receive a notice or receipt, upload it and this review can shift from options to a case-file analysis.",
          likelihood: "Possible",
        },
      ],
      confidence: "low",
      priority: "medium",
      state: "info_needed",
      next_action: "ADD_CASE_DETAILS",
      alternative_action: "If you already have a USCIS letter, you can upload it anytime.",
      uscis_basis: "USCIS",
      analysis_outline: [
        { heading: "Your situation", detail: situation || goal || "You asked what immigration options might exist." },
        { heading: "Immigration rules", detail: "Possible paths are labeled with conditions. They are not confirmed eligibility or a promise of approval." },
        { heading: "Your evidence", detail: "No USCIS case file is required for this kind of review." },
        { heading: "Our conclusion", detail: "Clarifying a few facts is more useful than waiting for a notice you do not have." },
        { heading: "Your next move", detail: "Answer the follow-up questions or ask anything else in Q&A." },
      ],
    });
  }
  return {
    inquiry,
    issues,
    pathSteps: openOptionsPathSteps(),
    reconstruction: openOptionsReconstruction(inquiry, goal || situation),
    unknowns: openOptionsUnknowns(inquiry),
    authorityQueries: uniq(inquiry.themes.flatMap((theme) => THEME_AUTHORITY[theme] ?? [])),
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
>(state: T, inquiry: ImmigrationInquiry, goal = ""): T {
  if (inquiry.mode !== INQUIRY_MODES.OPEN_OPTIONS) return state;
  if (state.facts.some((fact) => CORE_FACT_KEYS.has(fact.key))) return state;
  const options = buildOpenOptionsAnalysis({ goal }, inquiry);
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
      summary: "No USCIS case file is required for an options review. Possible pathways are based on the described situation, not on a receipt or notice.",
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
  inquiry?: ImmigrationInquiry;
  hasLinkedCase?: boolean;
}): string {
  const inquiry = input.inquiry ?? classifyImmigrationInquiry({ situation: input.question, goal: input.question });
  const knowledge = (input.knowledge ?? "").trim();
  const lines: string[] = [];
  lines.push("ImmigrationOnMe is not USCIS, a law firm, or a substitute for a licensed attorney or accredited representative.");
  if (inquiry.mode === INQUIRY_MODES.OPEN_OPTIONS && !input.hasLinkedCase) {
    const themeText = inquiry.themes.filter((theme) => theme !== "general").map(themeLabel).join(", ");
    lines.push(
      themeText
        ? `You do not need a USCIS case, letter, or receipt on file for this kind of question. From what you asked, possible areas to review include ${themeText}.`
        : "You do not need a USCIS case, letter, or receipt on file to ask what options might exist.",
    );
    lines.push(
      "Possible paths should be treated as options with conditions — not as a decision, not as eligibility, and not as a reconstructed case. Never assume a receipt number, deadline, or notice you did not provide.",
    );
  } else if (input.hasLinkedCase) {
    lines.push("If this question is about a case already in your account, use the approved presentation on that case as the source of posture, next action, and deadlines.");
  }
  if (knowledge) {
    lines.push("From the USCIS reference material on file:");
    lines.push(knowledge.slice(0, 1200));
  } else {
    lines.push(
      "I could not pull a matching USCIS reference just now. You can still describe your situation, goal, and any family, work, or school facts. If you later have a notice or receipt, upload it so the review can use that record.",
    );
  }
  lines.push("If the stakes are high — a deadline, removal risk, asylum, or a filing you might submit soon — talk with a licensed professional before you act.");
  return lines.join("\n\n");
}

export const OPEN_OPTIONS_POSTURE = "Exploring immigration options";
