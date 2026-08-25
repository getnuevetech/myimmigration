import "server-only";
import { db } from "./db";
import { authorityQueryKeys } from "./authority-match";
import { authorityQueriesForInquiry, classifyImmigrationInquiry } from "./immigration-inquiry";
import { suggestionBoostsFromStats, type SuggestionBoosts } from "./goal-suggestions";

async function queryKeysForText(situation: string, goal = ""): Promise<string[]> {
  const inquiry = classifyImmigrationInquiry({ situation, goal });
  return authorityQueryKeys(inquiry.themes, authorityQueriesForInquiry(inquiry));
}

export async function loadSuggestionBoosts(queryKeys: string[]): Promise<SuggestionBoosts> {
  if (!queryKeys.length) return {};
  const stats = await db.goalSuggestionStat.findMany({
    where: { queryKey: { in: queryKeys } },
    select: { queryKey: true, actionKey: true, completedCount: true, recommendedCount: true },
  }).catch(() => []);
  return suggestionBoostsFromStats(stats, queryKeys);
}

export async function recordSuggestionEvent(
  queryKeys: string[],
  actionKeys: string[],
  kind: "recommended" | "completed",
) {
  const keys = Array.from(new Set(actionKeys.filter(Boolean)));
  if (!queryKeys.length || !keys.length) return;
  for (const queryKey of queryKeys) {
    for (const actionKey of keys) {
      if (kind === "recommended") {
        await db.goalSuggestionStat.upsert({
          where: { queryKey_actionKey: { queryKey, actionKey } },
          update: { recommendedCount: { increment: 1 }, lastRecommendedAt: new Date() },
          create: { queryKey, actionKey, recommendedCount: 1 },
        }).catch(() => null);
      } else {
        await db.goalSuggestionStat.upsert({
          where: { queryKey_actionKey: { queryKey, actionKey } },
          update: { completedCount: { increment: 1 }, lastCompletedAt: new Date() },
          create: { queryKey, actionKey, completedCount: 1, lastCompletedAt: new Date() },
        }).catch(() => null);
      }
    }
  }
}

export async function loadBoostsForNarrative(situation: string, goal = ""): Promise<{ queryKeys: string[]; boosts: SuggestionBoosts }> {
  const queryKeys = await queryKeysForText(situation, goal);
  return { queryKeys, boosts: await loadSuggestionBoosts(queryKeys) };
}

export async function recordSuggestionsForCase(
  caseId: string,
  actionKeys: string[],
  kind: "recommended" | "completed",
) {
  const row = await db.case.findUnique({ where: { id: caseId }, select: { situation: true, goal: true } });
  if (!row) return;
  const queryKeys = await queryKeysForText(row.situation, row.goal);
  await recordSuggestionEvent(queryKeys, actionKeys, kind);
}
