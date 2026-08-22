import "server-only";
import { db } from "./db";
import { hasFeature } from "./access";
import { FEATURE_KEYS } from "./constants";
import { formatCaseNumber } from "./case-number";

const USCIS_NEWS_RSS = "https://uscisdhs-gov.us/news/rss-feed/59144.html";

export type UscisUpdate = {
  title: string;
  url: string;
  publishedAt: string;
  summary: string;
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

function tag(block: string, name: string): string {
  const match = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  return match ? decodeEntities(match[1]) : "";
}

export async function getUscisUpdates(limit = 20): Promise<UscisUpdate[]> {
  try {
    const res = await fetch(USCIS_NEWS_RSS, { next: { revalidate: 3600 } });
    if (!res.ok) throw new Error(`USCIS feed returned HTTP ${res.status}`);
    const xml = await res.text();
    return (xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? [])
      .map((item) => ({
        title: tag(item, "title"),
        url: tag(item, "link"),
        publishedAt: tag(item, "pubDate"),
        summary: tag(item, "description"),
      }))
      .filter((item) => item.title && item.url)
      .slice(0, limit);
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
