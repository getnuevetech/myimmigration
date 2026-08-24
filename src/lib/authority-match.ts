import type { KnowledgeRecord } from "./knowledge-retrieval";

export type AuthorityCatalogEntry = {
  id: string;
  key: string;
  title: string;
  url: string;
  sourceType: string;
  publisher: string;
  authorityRank: string;
  jurisdictionOrScope: string;
};

export function normalizeAuthorityUrl(url: string): string {
  return url.trim().toLowerCase().replace(/\/+$/, "").split("#")[0].split("?")[0];
}

export function authorityQueryKeys(themes: string[] = [], queries: string[] = []): string[] {
  const keys: string[] = [];
  for (const theme of themes.map((item) => item.trim().toLowerCase()).filter(Boolean)) {
    keys.push(theme);
  }
  for (const query of queries.map((item) => item.trim()).filter(Boolean)) {
    keys.push(query);
    for (const theme of themes.map((item) => item.trim().toLowerCase()).filter(Boolean)) {
      keys.push(`${theme}|${query}`);
    }
  }
  return Array.from(new Set(keys));
}

export function historicalMatchBoost(hitCount: number): number {
  if (hitCount <= 0) return 0;
  return Math.min(8, Math.floor(Math.log2(hitCount + 1) * 3));
}

export function matchBoostsFromStats(
  stats: { url: string; queryKey: string; hitCount: number }[],
  queryKeys: string[],
): Record<string, number> {
  const wanted = new Set(queryKeys.map((key) => key.toLowerCase()));
  const boosts: Record<string, number> = {};
  for (const stat of stats) {
    if (!wanted.has(stat.queryKey.toLowerCase())) continue;
    const url = normalizeAuthorityUrl(stat.url);
    if (!url) continue;
    boosts[url] = (boosts[url] ?? 0) + historicalMatchBoost(stat.hitCount);
  }
  return boosts;
}

function compact(value: string): string {
  return value.toUpperCase().replace(/\s|-/g, "");
}

export function findAuthorityForKnowledge(
  knowledge: { url?: string | null; title: string; reference?: string | null },
  authorities: AuthorityCatalogEntry[],
): AuthorityCatalogEntry | null {
  const url = normalizeAuthorityUrl(knowledge.url ?? "");
  if (url) {
    const byUrl = authorities.find((item) => normalizeAuthorityUrl(item.url) === url);
    if (byUrl) return byUrl;
  }
  const ref = compact(knowledge.reference || knowledge.title);
  if (ref.length >= 4) {
    const byRef = authorities.find((item) => compact(`${item.key} ${item.title} ${item.url}`).includes(ref));
    if (byRef) return byRef;
  }
  return authorities.find((item) => item.key === "uscis_forms") ?? authorities[0] ?? null;
}

export function knowledgeFromSnapshot(snapshot: {
  title: string;
  url: string;
  excerpt: string;
  source?: { publisher?: string | null; sourceType?: string | null } | null;
}): KnowledgeRecord {
  return {
    title: snapshot.title,
    reference: snapshot.title,
    url: snapshot.url,
    content: snapshot.excerpt,
    sourceType: snapshot.source?.sourceType,
    publisher: snapshot.source?.publisher,
  };
}

export function overlappingOfficialUpdate(
  update: { title: string; summary: string },
  queries: string[],
  query: string,
): boolean {
  const hay = `${update.title} ${update.summary}`.toLowerCase();
  const needles = [
    ...queries,
    ...query.split(/[^a-z0-9]+/i).filter((word) => word.length > 3),
  ].map((item) => item.toLowerCase());
  return needles.some((needle) => needle.length >= 3 && hay.includes(needle));
}
