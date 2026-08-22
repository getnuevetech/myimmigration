import "server-only";
import { db } from "./db";
import { hasFeature } from "./access";
import { FEATURE_KEYS } from "./constants";
import { formatCaseNumber } from "./case-number";

const USCIS_UPDATE_SOURCES = [
  { kind: "All News", url: "https://www.uscis.gov/newsroom/all-news" },
  { kind: "Alert", url: "https://www.uscis.gov/newsroom/alerts" },
] as const;

export type UscisUpdate = {
  title: string;
  url: string;
  publishedAt: string;
  summary: string;
  source: string;
};

export type UscisUpdateImpact = {
  caseId: string;
  caseRef: string;
  caseTitle: string;
  reason: string;
};

function decodeEntities(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function absoluteUscisUrl(value: string): string {
  if (value.startsWith("https://")) return value;
  if (value.startsWith("/")) return `https://www.uscis.gov${value}`;
  return `https://www.uscis.gov/${value}`;
}

function dateValue(value: string): number {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function recentThreshold(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - 14);
  return d.getTime();
}

function textLinesFromHtml(html: string): string[] {
  const withLinks = html.replace(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_all, href, label) => {
    const text = decodeEntities(label);
    return text ? `\n@@LINK|${href}|${text}\n` : "\n";
  });
  return decodeEntities(withLinks)
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseUscisHtml(html: string, source: string): UscisUpdate[] {
  const lines = textLinesFromHtml(html);
  const updates: UscisUpdate[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.startsWith("@@LINK|")) continue;
    const [, href, title] = line.split("|");
    if (!href || !title || !href.includes("/newsroom/")) continue;
    const dateIndex = lines.slice(i + 1, i + 8).findIndex((candidate) =>
      /^(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+20\d{2}$/i.test(candidate),
    );
    if (dateIndex < 0) continue;
    const absoluteDateIndex = i + 1 + dateIndex;
    const summary = lines.slice(absoluteDateIndex + 1, absoluteDateIndex + 4).find((candidate) => !candidate.startsWith("@@LINK|")) ?? "";
    updates.push({
      title,
      url: absoluteUscisUrl(href),
      publishedAt: lines[absoluteDateIndex],
      summary,
      source,
    });
  }
  return updates;
}

export async function getUscisUpdates(limit = 20): Promise<UscisUpdate[]> {
  try {
    const pages = await Promise.all(
      USCIS_UPDATE_SOURCES.map(async (source) => {
        const res = await fetch(source.url, { next: { revalidate: 1800 } });
        if (!res.ok) throw new Error(`${source.url} returned HTTP ${res.status}`);
        return parseUscisHtml(await res.text(), source.kind);
      }),
    );
    const byUrl = new Map<string, UscisUpdate>();
    for (const update of pages.flat()) byUrl.set(update.url, update);
    const sorted = Array.from(byUrl.values()).sort((a, b) => dateValue(b.publishedAt) - dateValue(a.publishedAt));
    const recent = sorted.filter((update) => dateValue(update.publishedAt) >= recentThreshold());
    return (recent.length ? recent : sorted).slice(0, limit);
  } catch {
    return [];
  }
}

function updateSignals(update: UscisUpdate): string[] {
  const hay = `${update.title} ${update.summary}`.toUpperCase();
  const forms = hay.match(/\b(?:I|N|G)-?\d{2,4}[A-Z]?\b/g) ?? [];
  const topics = [
    "RFE",
    "NOID",
    "BIOMETRICS",
    "INTERVIEW",
    "ASYLUM",
    "NATURALIZATION",
    "PUBLIC CHARGE",
    "EMPLOYMENT AUTHORIZATION",
    "H-1B",
    "I-485",
    "I-130",
    "I-765",
    "I-539",
  ].filter((topic) => hay.includes(topic));
  return Array.from(new Set([...forms, ...topics].map((item) => item.replace(/\s+/g, " ").trim())));
}

export async function getUpdateImpactsForUser(userId: string, update: UscisUpdate): Promise<{ allowed: boolean; impacts: UscisUpdateImpact[] }> {
  const allowed = await hasFeature(userId, FEATURE_KEYS.USCIS_UPDATES_ANALYSIS);
  if (!allowed) return { allowed, impacts: [] };
  const signals = updateSignals(update);
  if (signals.length === 0) return { allowed, impacts: [] };
  const cases = await db.case.findMany({
    where: { userId, status: { notIn: ["closed"] } },
    orderBy: { updatedAt: "desc" },
    take: 10,
    include: { issues: { select: { title: true, issueType: true }, take: 5 } },
  });

  const impacts: UscisUpdateImpact[] = [];
  for (const c of cases) {
    const caseText = `${c.title} ${c.situation} ${c.goal} ${c.issues.map((i) => `${i.title} ${i.issueType}`).join(" ")}`.toUpperCase();
    const matched = signals.filter((signal) => caseText.includes(signal));
    if (matched.length === 0) continue;
    impacts.push({
      caseId: c.id,
      caseRef: formatCaseNumber(c.number),
      caseTitle: c.title,
      reason: `This update mentions ${matched.slice(0, 3).join(", ")}, which also appears in this case.`,
    });
  }
  return { allowed, impacts };
}
