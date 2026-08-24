import "server-only";
import { createHash } from "crypto";
import { db } from "./db";

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function sourceMatchesQuery(source: { key: string; title: string; sourceType: string; jurisdictionOrScope: string }, query: string): boolean {
  const q = query.toLowerCase();
  const hay = `${source.key} ${source.title} ${source.sourceType} ${source.jurisdictionOrScope}`.toLowerCase();
  if (q.includes("form") || q.includes("i-")) return hay.includes("form");
  if (q.includes("notice") || q.includes("deadline")) return hay.includes("alert") || hay.includes("policy");
  if (q.includes("public_charge")) return hay.includes("policy") || hay.includes("regulation");
  return hay.includes(q.replace(/_/g, " ")) || hay.includes("policy");
}

export async function snapshotAuthorityForPlan(caseId: string, queries: string[]) {
  const sources = await db.authoritySource.findMany({ where: { isActive: true }, orderBy: [{ authorityRank: "asc" }, { title: "asc" }] });
  const snapshots = [];
  for (const query of queries) {
    const matched = sources.filter((source) => sourceMatchesQuery(source, query)).slice(0, 3);
    for (const source of matched) {
      const content = `${source.publisher} ${source.title} ${source.url} ${source.jurisdictionOrScope}`;
      snapshots.push(await db.authoritySnapshot.create({
        data: {
          sourceId: source.id,
          caseId,
          title: source.title,
          url: source.url,
          contentHash: hash(content),
          excerpt: source.jurisdictionOrScope,
          applicabilityJson: JSON.stringify([{ query, reason: "Matched from case analysis plan authority hints." }]),
        },
      }));
    }
  }
  return snapshots;
}
