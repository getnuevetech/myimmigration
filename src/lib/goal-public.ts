export type PublicStartIntent = "options" | "letter" | "any";

export type PublicCta = {
  label: string;
  href: string;
};

export type PublicHeroCopy = {
  tagline: string;
  title: string;
  subtitle: string;
  primaryCta: PublicCta;
  secondaryCta: PublicCta;
  letterLink: PublicCta;
};

export type PublicClosingCopy = {
  title: string;
  body: string;
  optionsCta: PublicCta;
  letterCta: PublicCta;
};

export type PublicStartCopy = {
  intent: PublicStartIntent;
  title: string;
  subtitle: string;
  situationPlaceholder: string;
  goalPlaceholder: string;
  fileHint: string;
  steps: { title: string; subtitle: string }[];
  goalChips: string[];
};

export const PUBLIC_FEATURE_SORT_ORDER: Record<string, number> = {
  "case.analysis": 1,
  "case.full_results": 2,
  "documents.upload": 3,
  "documents.explain": 4,
  "forms.wizard": 5,
  "forms.download": 6,
  "qa.chat": 7,
  "qa.personalized": 8,
  "suggestions.personalized": 9,
  "letters.generate": 10,
  "notice.upload": 11,
  "notice.explain": 12,
  "deadlines.reminders": 13,
  "vault.storage": 14,
  "guide.chatbot": 15,
  "case.report": 16,
  "uscis.updates_analysis": 17,
  "consultant.referral": 18,
};

export const STALE_PUBLIC_TAGLINES = ["Immigration paperwork, organized"];
export const STALE_PUBLIC_HERO_TITLES = ["Turn immigration paperwork into a clear case plan"];
export const STALE_PUBLIC_HERO_SUBTITLES = [
  "ImmigrationOnMe organizes notices, forms, timelines, evidence gaps, and deadlines so applicants can understand what is happening and what to prepare next.",
];
export const STALE_PUBLIC_PRIMARY_CTAS = ["Start a case review"];

export const PUBLIC_TAGLINE = "Immigration options and paperwork, organized";

export const PUBLIC_HERO: PublicHeroCopy = {
  tagline: PUBLIC_TAGLINE,
  title: "See your immigration *options* — even before you file.",
  subtitle:
    "Start with a life situation or a USCIS letter. We map possible pathways, matching forms and documents, and official Q&A first. Notices, timelines, and deadlines come in when you already have a case on file.",
  primaryCta: { label: "Explore my options", href: "/start?intent=options" },
  secondaryCta: { label: "Ask an immigration question", href: "/start/qa" },
  letterLink: { label: "Already have a USCIS receipt or RFE? Start with that letter →", href: "/start?intent=letter" },
};

export const PUBLIC_HOW_IT_WORKS_HEADING = "From a life situation to a *clear next step*";
export const PUBLIC_HOW_IT_WORKS_INTRO =
  "A durable workflow for pathways, matching evidence, official questions, and — when you have one — a USCIS letter.";

export const PUBLIC_HOME_STEPS = [
  {
    n: "01",
    title: "Share the situation",
    body: "Start with what you know: a life situation with no filing yet, or a USCIS case, letter, or notice. Receipt numbers help when you have them. They are not required to explore options.",
  },
  {
    n: "02",
    title: "Match the official path",
    body: "We rank the forms, identity and relationship records, and official questions that belong to your situation. Upload a USCIS notice only when USCIS has already sent one.",
  },
  {
    n: "03",
    title: "Leave with a plan",
    body: "Get possible pathways with conditions, or a structured case summary, issue list, missing-document checklist, and professional-ready handoff packet.",
  },
];

export const PUBLIC_HOME_FEATURES = [
  {
    title: "Pathway exploration",
    body: "See which immigration options the matching official material still supports — including when you have not filed anything yet.",
  },
  {
    title: "Matching forms and documents",
    body: "Start with the petition and evidence that belong to the path, such as Form I-130 and identity records, not a receipt you do not have.",
  },
  {
    title: "Official Q&A",
    body: "Ask what the instructions still need from you. Follow-ups come from official material, not a canned essay.",
  },
  {
    title: "Notice intelligence",
    body: "When you already have a USCIS letter, identify the form, notice type, receipt number, response deadline, and evidence requested.",
  },
  {
    title: "Case timeline builder",
    body: "Turn scattered filings, status changes, appointments, and approvals into a readable immigration history.",
  },
  {
    title: "Professional-ready packet",
    body: "Package the timeline, notices, documents, and questions so an attorney or accredited representative can move faster.",
  },
];

export const PUBLIC_WHY_IT_WORKS = [
  {
    value: "9+",
    label: "USCIS workflows organized into guided steps",
  },
  {
    value: "5",
    label: "Core surfaces: options, documents, forms, questions, notices",
  },
  {
    value: "100%",
    label: "User-controlled document ownership",
  },
];

export const PUBLIC_UPDATES_HEADING = "Policy and form updates, watched for *your situation*";
export const PUBLIC_UPDATES_INTRO =
  "We pull public USCIS updates and help paid customers understand which changes may matter for their options or filed case.";

export const PUBLIC_CLOSING: PublicClosingCopy = {
  title: "Ready to see your *options* — or make sense of a letter?",
  body: "Explore pathways before you file, or upload a USCIS receipt, RFE, or other letter you do not want to misread.",
  optionsCta: { label: "Explore my options →", href: "/start?intent=options" },
  letterCta: { label: "I have a USCIS letter →", href: "/start?intent=letter" },
};

export const PUBLIC_PRICING_INTRO =
  "Start free whether you have not filed yet or already have a USCIS letter. Visitors get one short official answer and one suggested next step; Free keeps a few general questions and the next official step each month; Plus personalizes follow-ups and the full suggested path; Pro can request a matched licensed professional — nothing is shared until both of you accept.";

export const PUBLIC_BILLING_SUBTITLE =
  "Start without a filing, or bring a USCIS letter. Upgrade or downgrade anytime. Access changes immediately.";

export const PUBLIC_PLAN_DESCRIPTIONS: Record<string, string> = {
  free: "Explore immigration options before you file — no credit card needed.",
  plus: "The full toolkit for one immigration situation — whether you have not filed yet or already have a USCIS letter.",
  pro: "Everything, unlimited — plus professional referrals.",
};

export const STALE_PLAN_DESCRIPTIONS: Record<string, string[]> = {
  free: ["Understand what's going on — no credit card needed."],
  plus: ["The full toolkit for handling one immigration situation end to end."],
};

export const PUBLIC_HERO_CAROUSEL = {
  kicker: "Immigration options",
  cards: [
    { title: "I-130 petition", body: "Family path starts here, not I-485" },
    { title: "Identity documents", body: "Passport and civil records first" },
    { title: "RFE (if USCIS wrote)", body: "Evidence checklist for a filed case" },
  ],
  readinessLabel: "Options review",
  readinessValue: "Open",
  checklistTitle: "Matching evidence listed",
  checklistMeta: "No USCIS receipt required",
};

export const PUBLIC_FAQ_BODY = `Q: Is ImmigrationOnMe USCIS or a law firm?
No. ImmigrationOnMe is an immigration case assistant that explains your situation and guides your next steps in plain English. For high-stakes decisions we connect you with licensed professionals.

Q: Do I need a USCIS receipt to start?
No. You can explore options, matching forms, and official questions with no filing yet. Checking a USCIS case is only useful if you already have a receipt number — use the official USCIS case status site or sign in at my.uscis.gov, then upload that letter here so we can organize the timeline.

Q: What happens to documents I upload?
They're stored in your private vault. Only you can see them — and a consultant only after you explicitly approve the connection. You can delete files or your whole account anytime.

Q: How does the analysis work?
We extract facts from your answers and documents, compare them with USCIS reference material, and turn everything into issues and a step-by-step plan. When something can't be verified, we say so — we never guess.

Q: Can ImmigrationOnMe file with USCIS for me?
No. ImmigrationOnMe helps organize information and prepare draft materials for review. You are responsible for filings, and complex or high-stakes matters should be reviewed by a licensed immigration attorney or accredited representative.

Q: How do I cancel my subscription?
Plan & billing → Cancel subscription. You keep access until the end of the paid period.

Q: Something in the app isn't working.
Open a tech support ticket under Support tickets (or ask the guide chatbot to create one) and our team will fix it.

(Edit this FAQ in the admin backend under Content & agreements.)`;

export const PUBLIC_HOW_IT_WORKS_PAGE = `ImmigrationOnMe helps you understand immigration options and resolve filed cases in plain English.

1. Tell us what happened — a life situation with no filing yet, or a USCIS letter if you already have one.
2. Tell us your goal — what a great outcome looks like.
3. Add matching documents — identity, relationship, and status records first. Upload USCIS notices, receipts, and RFEs only when USCIS has already sent them.

Our analysis engine maps possible pathways with conditions, or breaks a filed situation into clear issues, checks facts against your documents, and builds a step-by-step path forward. When facts can't be verified, we say so — we never guess.

If your case needs a licensed professional, we can help prepare a handoff to an immigration attorney, accredited representative, or vetted immigration professional — only with your approval.`;

const OPTIONS_GOAL_CHIPS = [
  "Family green card options",
  "Work authorization options",
  "Citizenship / naturalization",
  "Study in the U.S.",
  "Bring my parents or children",
];
const LETTER_GOAL_CHIPS = [
  "Understand a USCIS letter",
  "Prepare an RFE response",
  "Organize my case timeline",
  "Get ready for an interview",
];

export function parsePublicStartIntent(raw?: string | null): PublicStartIntent {
  const value = (raw ?? "").trim().toLowerCase();
  if (value === "letter" || value === "notice" || value === "filed" || value === "rfe") return "letter";
  if (value === "options" || value === "explore" || value === "open") return "options";
  return "any";
}

export function resolvePublicStartCopy(raw?: string | null): PublicStartCopy {
  const intent = parsePublicStartIntent(raw);
  if (intent === "letter") {
    return {
      intent,
      title: "Understand a USCIS letter",
      subtitle: "A receipt, RFE, or other notice you already have — start here so we can explain it against official material.",
      situationPlaceholder: 'For example: "I got an RFE from USCIS on my I-485 and the deadline is coming up."',
      goalPlaceholder: 'For example: "Help me understand what the letter asks for and what to prepare next."',
      fileHint: "Upload the USCIS letter if you have it. Receipt numbers help when they appear on the notice.",
      steps: [
        { title: "What's going on?", subtitle: "A USCIS receipt, RFE, or other letter — paste or describe it in your own words." },
        { title: "What do you want?", subtitle: "Understand the letter, the deadline, and what to prepare next." },
        { title: "Any documents?", subtitle: "Upload the notice if you have it. Receipt numbers help when they appear on the letter." },
      ],
      goalChips: [...LETTER_GOAL_CHIPS, ...OPTIONS_GOAL_CHIPS],
    };
  }
  if (intent === "options") {
    return {
      intent,
      title: "Explore your immigration options",
      subtitle: "No USCIS filing yet is fine. Start with the situation and we will map pathways, matching forms, and official next steps.",
      situationPlaceholder: 'For example: "I want to marry a U.S. citizen and get a green card. We have not filed anything yet."',
      goalPlaceholder: 'For example: "Show me what options I have, and what I can do next."',
      fileHint: "Identity, relationship, or status records if you have them — not a receipt unless USCIS already sent one.",
      steps: [
        { title: "What's going on?", subtitle: "A life situation with no USCIS file yet — start with your own words." },
        { title: "What do you want?", subtitle: "Possible pathways, matching forms, and what evidence the official instructions still need." },
        { title: "Any documents?", subtitle: "Optional. Identity and relationship records help a family petition; skip a USCIS notice if you do not have one." },
      ],
      goalChips: [...OPTIONS_GOAL_CHIPS, ...LETTER_GOAL_CHIPS],
    };
  }
  return {
    intent,
    title: "Get help with your immigration situation",
    subtitle: "Whether you have a USCIS case, a letter, or you just need to know what options exist — start here.",
    situationPlaceholder: 'For example: "I want to marry a U.S. citizen and get a green card. We have not filed anything yet." Or: "I got an RFE from USCIS and the deadline is coming up…"',
    goalPlaceholder: 'For example: "Show me what options I have, and what I can do next."',
    fileHint: "Identity, relationship, or status records if you have them — not a receipt unless USCIS already sent one.",
    steps: [
      { title: "What's going on?", subtitle: "A USCIS case, a letter, or just a life situation — start with your own words." },
      { title: "What do you want?", subtitle: "A next step, a possible path, or help understanding a notice." },
      { title: "Any documents?", subtitle: "Optional. Identity and relationship records help a family petition; skip a USCIS notice if you do not have one." },
    ],
    goalChips: [...OPTIONS_GOAL_CHIPS, ...LETTER_GOAL_CHIPS],
  };
}

function isStaleValue(stored: string | undefined, stale: string[]): boolean {
  const value = stored?.trim() ?? "";
  if (!value) return true;
  return stale.some((item) => value === item || (item.length >= 24 && value.includes(item)));
}

export function resolvePublicHero(settings: Record<string, string | undefined> = {}): PublicHeroCopy {
  const title = isStaleValue(settings["home.hero_title"], STALE_PUBLIC_HERO_TITLES)
    ? PUBLIC_HERO.title
    : (settings["home.hero_title"] ?? PUBLIC_HERO.title);
  const subtitle = isStaleValue(settings["home.hero_subtitle"], STALE_PUBLIC_HERO_SUBTITLES)
    ? PUBLIC_HERO.subtitle
    : (settings["home.hero_subtitle"] ?? PUBLIC_HERO.subtitle);
  const tagline = isStaleValue(settings["app.tagline"], STALE_PUBLIC_TAGLINES)
    ? PUBLIC_HERO.tagline
    : (settings["app.tagline"] ?? PUBLIC_HERO.tagline);
  const primaryLabel = isStaleValue(settings["home.cta_primary"], STALE_PUBLIC_PRIMARY_CTAS)
    ? PUBLIC_HERO.primaryCta.label
    : (settings["home.cta_primary"] ?? PUBLIC_HERO.primaryCta.label);
  const secondaryLabel = settings["home.cta_secondary"]?.trim() || PUBLIC_HERO.secondaryCta.label;
  return {
    tagline,
    title,
    subtitle,
    primaryCta: { label: primaryLabel, href: PUBLIC_HERO.primaryCta.href },
    secondaryCta: { label: secondaryLabel, href: PUBLIC_HERO.secondaryCta.href },
    letterLink: PUBLIC_HERO.letterLink,
  };
}

export function publicFeatureSortOrder(key: string): number {
  return PUBLIC_FEATURE_SORT_ORDER[key] ?? Number.MAX_SAFE_INTEGER;
}

export function featuresRankedBeforeNotices(): string[] {
  const noticeOrder = PUBLIC_FEATURE_SORT_ORDER["notice.upload"];
  return Object.entries(PUBLIC_FEATURE_SORT_ORDER)
    .filter(([, order]) => order < noticeOrder)
    .sort((a, b) => a[1] - b[1])
    .map(([key]) => key);
}

export function publicCopyLeadsWithOptions(text: string): boolean {
  const hay = text.toLowerCase();
  const optionsIdx = Math.min(
    ...["option", "before you file", "not filed", "no filing", "no uscis filing"].map((token) => {
      const idx = hay.indexOf(token);
      return idx === -1 ? Number.MAX_SAFE_INTEGER : idx;
    }),
  );
  const noticeIdx = Math.min(
    ...["i-797", "receipt number", "start a case review"].map((token) => {
      const idx = hay.indexOf(token);
      return idx === -1 ? Number.MAX_SAFE_INTEGER : idx;
    }),
  );
  return optionsIdx < noticeIdx;
}
