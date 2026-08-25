import type { KnowledgeRecord } from "./knowledge-retrieval";
import type { ConsultantReferral, InquiryTheme, OpenOptionsPathStep } from "./immigration-inquiry";

export type SuggestionCandidate = {
  title: string;
  description: string;
  action_key: string;
  officialRank: number;
  pin?: boolean;
};

export type SuggestionBoosts = Record<string, number>;

export function historicalSuggestionBoost(completedCount: number, recommendedCount = 0): number {
  if (completedCount <= 0 && recommendedCount <= 0) return 0;
  const completed = Math.min(8, Math.floor(Math.log2(completedCount + 1) * 3));
  const recommended = Math.min(3, Math.floor(Math.log2(recommendedCount + 1)));
  return Math.min(8, completed + Math.floor(recommended / 2));
}

export function suggestionBoostsFromStats(
  stats: { actionKey: string; queryKey: string; completedCount: number; recommendedCount: number }[],
  queryKeys: string[],
): SuggestionBoosts {
  const wanted = new Set(queryKeys.map((key) => key.toLowerCase()));
  const boosts: SuggestionBoosts = {};
  for (const stat of stats) {
    if (!wanted.has(stat.queryKey.toLowerCase())) continue;
    boosts[stat.actionKey] = (boosts[stat.actionKey] ?? 0) + historicalSuggestionBoost(stat.completedCount, stat.recommendedCount);
  }
  return boosts;
}

const TAG_THEME: { pattern: RegExp; theme: InquiryTheme }[] = [
  { pattern: /\bfamily\b|i-?130|spouse|marriage|petitioner|beneficiary/, theme: "family" },
  { pattern: /\bparent|child(?:ren)?|son|daughter/, theme: "parents_children" },
  { pattern: /\bi-?485|adjustment/, theme: "adjustment" },
  { pattern: /\bstudent\b|f-?1|\bopt\b|i-20/, theme: "student" },
  { pattern: /\bi-?765|\bead\b|employment/, theme: "employment" },
  { pattern: /\bn-?400|naturalization|citizenship/, theme: "naturalization" },
  { pattern: /\basylum\b|i-?589|refugee|persecution/, theme: "asylum" },
  { pattern: /\beoir\b|immigration court|removal/, theme: "humanitarian" },
  { pattern: /\btps\b|daca|parole|humanitarian|u visa|vawa/, theme: "humanitarian" },
  { pattern: /\bvisitor\b|b-?2|esta|tourist/, theme: "visitor" },
  { pattern: /\bconsular\b|nvc|embassy|ds-?260/, theme: "consular" },
];

function sourceHay(source: KnowledgeRecord): string {
  return `${source.reference} ${source.title} ${source.tags ?? ""} ${source.content}`.toLowerCase();
}

export function themesFromOfficialSources(sources: KnowledgeRecord[]): InquiryTheme[] {
  const found: InquiryTheme[] = [];
  for (const source of sources) {
    const hay = sourceHay(source);
    for (const item of TAG_THEME) {
      if (item.pattern.test(hay) && !found.includes(item.theme)) found.push(item.theme);
    }
  }
  return found;
}

export function refineInquiryThemes(regexThemes: InquiryTheme[], sources: KnowledgeRecord[]): InquiryTheme[] {
  const sourceThemes = themesFromOfficialSources(sources);
  if (!sourceThemes.length) return regexThemes.length ? regexThemes : ["general"];
  return sourceThemes;
}

export function consultantFromOfficialSources(sources: KnowledgeRecord[]): ConsultantReferral | null {
  if (!sources.length) return null;
  const hay = sources.map(sourceHay).join(" \n ");
  if (/\bi-?589\b|\basylum\b|withholding of removal|credible fear|convention against torture/.test(hay)) {
    return { level: "required", reason: "Matching official material is about asylum or protection, which is high-stakes and fact-specific under USCIS and DOJ rules." };
  }
  if (/\beoir\b|immigration court|removal proceedings|notice to appear|\bnta\b/.test(hay)) {
    return { level: "required", reason: "Matching official material is about immigration court or removal, which should be reviewed by a licensed professional." };
  }
  if (/\bnoid\b|notice of intent to deny/.test(hay)) {
    return { level: "required", reason: "Matching official material is about a Notice of Intent to Deny, which should be reviewed by a licensed professional before a response." };
  }
  return null;
}

export function stricterReferral(a: ConsultantReferral, b: ConsultantReferral): ConsultantReferral {
  const rank = { required: 2, recommended: 1, probably_unnecessary: 0 };
  return rank[a.level] >= rank[b.level] ? a : b;
}

export function officialSuggestionCandidates(
  sources: KnowledgeRecord[] = [],
  gaps: { question: string; item: string }[] = [],
  referral: ConsultantReferral = { level: "probably_unnecessary", reason: "" },
): SuggestionCandidate[] {
  const steps: SuggestionCandidate[] = [];
  if (gaps.length) {
    steps.push({
      title: "Share the facts this official material still needs",
      description: gaps.slice(0, 3).map((item) => item.item).join("; ") + ".",
      action_key: "ADD_CASE_DETAILS",
      officialRank: 0,
      pin: true,
    });
  }
  if (sources[0]) {
    steps.push({
      title: `Review ${sources[0].reference || sources[0].title}`,
      description: sources[0].url
        ? `Read the matching official instructions (${sources[0].url}) and see what filing would involve before you file anything.`
        : `Read the matching official instructions for ${sources[0].title} before you file anything.`,
      action_key: "COMPLETE_FORM_I485",
      officialRank: 1,
    });
  }
  if (referral.level === "required" || referral.level === "recommended") {
    steps.push({
      title: referral.level === "required" ? "Talk with a licensed professional now" : "Consider a licensed professional before filing",
      description: referral.reason,
      action_key: "REVIEW_ANALYSIS",
      officialRank: 0,
      pin: referral.level === "required",
    });
  } else {
    steps.push({
      title: "Ask a follow-up about these options",
      description: "Ask anything else about the official material that matched your question. You do not need a receipt number to do that.",
      action_key: "REVIEW_ANALYSIS",
      officialRank: 2,
    });
  }
  return steps;
}

export function rankGoalSuggestions(candidates: SuggestionCandidate[], boosts: SuggestionBoosts = {}): SuggestionCandidate[] {
  const score = (item: SuggestionCandidate) => (3 - item.officialRank) * 4 + (boosts[item.action_key] ?? 0);
  const pinned = candidates.filter((item) => item.pin);
  const rest = candidates
    .filter((item) => !item.pin)
    .sort((a, b) => score(b) - score(a) || a.officialRank - b.officialRank);
  const seen = new Set<string>();
  const ordered: SuggestionCandidate[] = [];
  for (const item of [...pinned, ...rest]) {
    if (seen.has(item.action_key)) continue;
    seen.add(item.action_key);
    ordered.push(item);
  }
  return ordered.slice(0, 4);
}

export function toPathSteps(candidates: SuggestionCandidate[]): OpenOptionsPathStep[] {
  return candidates.map((item) => ({
    title: item.title,
    description: item.description,
    action_key: item.action_key,
  }));
}

export function rankAuthorityGaps<T extends { key: string }>(gaps: T[], boosts: SuggestionBoosts = {}): T[] {
  const pinnedKeys = new Set(["current_status", "location"]);
  const pinned = gaps.filter((item) => pinnedKeys.has(item.key));
  const rest = gaps
    .filter((item) => !pinnedKeys.has(item.key))
    .sort((a, b) => (boosts[`question:${b.key}`] ?? 0) - (boosts[`question:${a.key}`] ?? 0));
  return [...pinned, ...rest].slice(0, 8);
}

export function bestSuggestionLine(steps: OpenOptionsPathStep[]): string {
  const first = steps[0];
  if (!first) return "";
  return `For this goal, the next step from matching official material is: ${first.title}. ${first.description}`;
}
