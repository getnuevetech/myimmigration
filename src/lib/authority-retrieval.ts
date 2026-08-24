import "server-only";
import { createHash } from "crypto";
import { db } from "./db";
import {
  authorityQueryKeys,
  findAuthorityForKnowledge,
  knowledgeFromSnapshot,
  matchBoostsFromStats,
  overlappingOfficialUpdate,
  type AuthorityCatalogEntry,
} from "./authority-match";
import { classifyImmigrationInquiry } from "./immigration-inquiry";
import { rankKnowledgeSources, toKnowledgeRecord, type KnowledgeRecord } from "./knowledge-retrieval";
import { getUscisUpdates } from "./uscis-updates";

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export type UnifiedAuthorityHint = {
  query: string;
  queries?: string[];
  inquiryMode?: "existing_case" | "open_options";
  themes?: string[];
  caseId?: string | null;
  limit?: number;
  persistHits?: boolean;
  preferSnapshots?: boolean;
};

function catalogFromRow(row: {
  id: string;
  key: string;
  title: string;
  url: string;
  sourceType: string;
  publisher: string;
  authorityRank: string;
  jurisdictionOrScope: string;
}): AuthorityCatalogEntry {
  return row;
}

async function loadMatchBoosts(queryKeys: string[]): Promise<Record<string, number>> {
  if (queryKeys.length === 0) return {};
  const stats = await db.authorityMatchStat.findMany({
    where: { queryKey: { in: queryKeys } },
    select: { queryKey: true, hitCount: true, source: { select: { url: true } } },
  }).catch(() => []);
  return matchBoostsFromStats(
    stats.map((stat) => ({ url: stat.source.url, queryKey: stat.queryKey, hitCount: stat.hitCount })),
    queryKeys,
  );
}

async function recordAuthorityHits(records: KnowledgeRecord[], authorities: AuthorityCatalogEntry[], queryKeys: string[]) {
  if (!records.length || !queryKeys.length) return;
  for (const record of records) {
    const authority = findAuthorityForKnowledge(record, authorities);
    if (!authority) continue;
    for (const queryKey of queryKeys) {
      await db.authorityMatchStat.upsert({
        where: { sourceId_queryKey: { sourceId: authority.id, queryKey } },
        update: { hitCount: { increment: 1 }, lastHitAt: new Date() },
        create: { sourceId: authority.id, queryKey, hitCount: 1 },
      }).catch(() => null);
    }
  }
}

async function rankFromCatalog(hint: UnifiedAuthorityHint): Promise<{ records: KnowledgeRecord[]; authorities: AuthorityCatalogEntry[]; queryKeys: string[] }> {
  const inquiry = classifyImmigrationInquiry({ situation: hint.query, goal: hint.query });
  const inquiryMode = hint.inquiryMode ?? inquiry.mode;
  const themes = hint.themes?.length ? hint.themes : inquiry.themes;
  const queries = hint.queries?.length ? hint.queries : [];
  const queryKeys = authorityQueryKeys(themes, queries);
  const [knowledgeRows, authorityRows, matchBoosts] = await Promise.all([
    db.knowledgeSource.findMany({ where: { isActive: true } }),
    db.authoritySource.findMany({ where: { isActive: true } }),
    loadMatchBoosts(queryKeys),
  ]);
  const authorities = authorityRows.map(catalogFromRow);
  const records = rankKnowledgeSources(
    knowledgeRows.map(toKnowledgeRecord),
    {
      query: hint.query,
      inquiryMode,
      themes,
      authorityQueries: queries,
      matchBoosts,
    },
    hint.limit ?? 5,
  ).map((record) => {
    const authority = findAuthorityForKnowledge(record, authorities);
    return {
      ...record,
      publisher: record.publisher || authority?.publisher || "USCIS",
      url: record.url || authority?.url || "",
    };
  });
  return { records, authorities, queryKeys };
}

export async function retrieveUnifiedAuthority(hint: UnifiedAuthorityHint): Promise<KnowledgeRecord[]> {
  const preferSnapshots = hint.preferSnapshots ?? Boolean(hint.caseId);
  const ranked = await rankFromCatalog(hint);
  let records = ranked.records;
  if (preferSnapshots && hint.caseId) {
    const snapshots = await db.authoritySnapshot.findMany({
      where: { caseId: hint.caseId },
      orderBy: { retrievedAt: "desc" },
      take: hint.limit ?? 8,
      include: { source: { select: { publisher: true, sourceType: true } } },
    }).catch(() => []);
    if (snapshots.length) {
      const fromSnapshots = snapshots.map(knowledgeFromSnapshot);
      const seen = new Set(fromSnapshots.map((item) => (item.url || item.title).toLowerCase()));
      const extra = ranked.records.filter((item) => !seen.has((item.url || item.title).toLowerCase()));
      records = [...fromSnapshots, ...extra].slice(0, hint.limit ?? 8);
    }
  }
  if (hint.persistHits) await recordAuthorityHits(records, ranked.authorities, ranked.queryKeys);
  return records;
}

export async function snapshotAuthorityForPlan(
  caseId: string,
  queries: string[],
  hint: { situation?: string; goal?: string; inquiryMode?: "existing_case" | "open_options"; themes?: string[] } = {},
) {
  const query = [hint.situation, hint.goal, queries.join(" ")].filter(Boolean).join(" ");
  const inquiry = classifyImmigrationInquiry({ situation: hint.situation, goal: hint.goal });
  const inquiryMode = hint.inquiryMode ?? inquiry.mode;
  const themes = hint.themes?.length ? hint.themes : inquiry.themes;
  const ranked = await rankFromCatalog({
    query,
    queries,
    inquiryMode,
    themes,
    limit: 6,
  });
  const liveUpdates = await getUscisUpdates(12).catch(() => []);
  const matchingUpdates = liveUpdates.filter((update) => overlappingOfficialUpdate(update, queries, query));
  const alertsSource = ranked.authorities.find((item) => item.key === "uscis_alerts");

  await db.authoritySnapshot.deleteMany({ where: { caseId } }).catch(() => null);

  const snapshots = [];
  const seen = new Set<string>();
  for (const record of ranked.records) {
    const authority = findAuthorityForKnowledge(record, ranked.authorities);
    if (!authority || seen.has(authority.id)) continue;
    seen.add(authority.id);
    const excerpt = record.content.slice(0, 2000);
    const applicability = [
      {
        query: queries[0] || query,
        reason: `Ranked against this customer's goal and plan queries (${[...themes, ...queries].filter(Boolean).join(", ") || "situation"}).`,
        goal: hint.goal || "",
        themes,
      },
      ...matchingUpdates.slice(0, 2).map((update) => ({
        query: update.title,
        reason: `Current USCIS ${update.source}: ${update.title}`,
        url: update.url,
        publishedAt: update.publishedAt,
      })),
    ];
    snapshots.push(await db.authoritySnapshot.create({
      data: {
        sourceId: authority.id,
        caseId,
        title: record.title,
        url: record.url || authority.url,
        effectiveOrUpdateDate: matchingUpdates[0]?.publishedAt ?? "",
        contentHash: hash(excerpt),
        excerpt,
        applicabilityJson: JSON.stringify(applicability),
      },
    }));
  }

  if (!snapshots.length) {
    for (const queryItem of queries) {
      const fallback = ranked.authorities.find((source) => {
        const hay = `${source.key} ${source.title} ${source.jurisdictionOrScope}`.toLowerCase();
        return hay.includes(queryItem.toLowerCase().replace(/_/g, " ")) || hay.includes(queryItem.toLowerCase());
      });
      if (!fallback || seen.has(fallback.id)) continue;
      seen.add(fallback.id);
      const excerpt = fallback.jurisdictionOrScope;
      snapshots.push(await db.authoritySnapshot.create({
        data: {
          sourceId: fallback.id,
          caseId,
          title: fallback.title,
          url: fallback.url,
          contentHash: hash(excerpt),
          excerpt,
          applicabilityJson: JSON.stringify([{ query: queryItem, reason: "Matched the case analysis plan query from the authority registry." }]),
        },
      }));
    }
  }

  if (matchingUpdates.length && alertsSource && !seen.has(alertsSource.id)) {
    const excerpt = matchingUpdates.map((update) => `${update.title} (${update.publishedAt}): ${update.summary}`).join("\n").slice(0, 1500);
    snapshots.push(await db.authoritySnapshot.create({
      data: {
        sourceId: alertsSource.id,
        caseId,
        title: matchingUpdates[0].title,
        url: matchingUpdates[0].url,
        effectiveOrUpdateDate: matchingUpdates[0].publishedAt,
        contentHash: hash(excerpt),
        excerpt,
        applicabilityJson: JSON.stringify(matchingUpdates.map((update) => ({
          query: update.title,
          reason: `Live USCIS ${update.source} overlapping this customer's plan queries.`,
          url: update.url,
        }))),
      },
    }));
  }

  await recordAuthorityHits(ranked.records, ranked.authorities, ranked.queryKeys);
  return snapshots;
}
