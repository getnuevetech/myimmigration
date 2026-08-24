export type KnowledgeRecord = {
  title: string;
  reference: string;
  sourceType?: string | null;
  tags?: string | null;
  url?: string | null;
  content: string;
  publisher?: string | null;
};

export function toKnowledgeRecord(row: {
  title: string;
  reference?: string | null;
  sourceType?: string | null;
  tags?: string | null;
  url?: string | null;
  content: string;
  publisher?: string | null;
}): KnowledgeRecord {
  return {
    title: row.title,
    reference: row.reference ?? "",
    sourceType: row.sourceType,
    tags: row.tags,
    url: row.url,
    content: row.content,
    publisher: row.publisher,
  };
}

export type KnowledgeRetrievalHint = {
  query: string;
  inquiryMode?: "existing_case" | "open_options";
  themes?: string[];
  authorityQueries?: string[];
  matchBoosts?: Record<string, number>;
};

const USCIS_REFERENCE_RE = /\b(?:RFE|NOID|NOIR|NOIT|I-797C?|I-485|I-130|I-765|I-864|I-589|N-400|G-28|AR-11|I-20|F-1|OPT|EOIR|NTA|[A-Z]{3}\d{10})\b/gi;
const NOTICE_QUERY_RE = /\b(rfe|noid|noir|noit|i-?797|receipt notice|request for evidence|notice of intent)\b/i;
const STOP = new Set(["that", "this", "with", "from", "have", "been", "were", "what", "when", "your", "about", "they", "them", "then", "than", "into", "also", "will", "would", "could", "should", "there", "their", "does", "done", "just", "like", "want", "need", "next", "month", "anything"]);

function uniq(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

export function queryTerms(query: string): string[] {
  return uniq(
    query
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((term) => term.length > 3 && !STOP.has(term)),
  );
}

function haystack(source: KnowledgeRecord): string {
  return `${source.title} ${source.reference} ${source.tags ?? ""} ${source.content}`.toLowerCase();
}

function compact(value: string): string {
  return value.toUpperCase().replace(/\s|-/g, "");
}

function isNoticeSource(source: KnowledgeRecord): boolean {
  const type = (source.sourceType ?? "").toLowerCase();
  const ref = compact(source.reference ?? "");
  return type.includes("notice") || ["RFE", "NOID", "NOIR", "NOIT", "I797", "I797C"].some((code) => ref.includes(code));
}

export function scoreKnowledgeSource(source: KnowledgeRecord, hint: KnowledgeRetrievalHint): number {
  const query = hint.query ?? "";
  const hay = haystack(source);
  let score = 0;
  for (const term of queryTerms(query)) {
    if (hay.includes(term)) score += 1;
  }
  const codes = query.toUpperCase().match(USCIS_REFERENCE_RE) ?? [];
  for (const code of codes) {
    if (compact(hay).includes(compact(code))) score += 12;
  }
  for (const ref of hint.authorityQueries ?? []) {
    if (compact(`${source.reference} ${source.title} ${source.tags ?? ""}`).includes(compact(ref))) score += 14;
  }
  for (const theme of hint.themes ?? []) {
    if (theme !== "general" && (source.tags ?? "").toLowerCase().includes(theme.replace(/_/g, " "))) score += 6;
  }
  const openOptions = hint.inquiryMode === "open_options" && !NOTICE_QUERY_RE.test(query);
  if (openOptions && isNoticeSource(source)) score -= 20;
  if (!openOptions && NOTICE_QUERY_RE.test(query) && isNoticeSource(source)) score += 10;
  if (openOptions) {
    const exclusiveHay = `${source.title} ${source.reference} ${source.tags ?? ""}`;
    const exclusiveThemes: { theme: string; pattern: RegExp }[] = [
      { theme: "naturalization", pattern: /n-?400|naturalization/i },
      { theme: "student", pattern: /\bf-?1\b|\bopt\b|i-20/i },
      { theme: "asylum", pattern: /i-?589|\basylum\b|eoir|removal/i },
    ];
    const themes = hint.themes ?? [];
    for (const item of exclusiveThemes) {
      if (item.pattern.test(exclusiveHay) && !themes.includes(item.theme)) score -= 15;
    }
  }
  const urlKey = (source.url ?? "").trim().toLowerCase().replace(/\/+$/, "");
  if (hint.matchBoosts && urlKey && hint.matchBoosts[urlKey]) score += hint.matchBoosts[urlKey];
  return score;
}

export function rankKnowledgeSources(
  sources: KnowledgeRecord[],
  hint: KnowledgeRetrievalHint,
  limit = 5,
): KnowledgeRecord[] {
  return sources
    .map((source) => ({ source, score: scoreKnowledgeSource(source, hint) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.source);
}

export function formatKnowledgeBlock(sources: KnowledgeRecord[], maxChars = 2500): string {
  return sources
    .map((source) => {
      const head = [source.reference || source.sourceType, source.title].filter(Boolean).join(" · ");
      const url = source.url ? `\nSource: ${source.url}` : "";
      return `[${head}]\n${source.content.slice(0, maxChars)}${url}`;
    })
    .join("\n\n---\n\n");
}
