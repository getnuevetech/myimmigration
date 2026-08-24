import "server-only";
import { db } from "./db";

function parseJson(value: string, fallback: unknown) {
  try {
    return JSON.parse(value || "");
  } catch {
    return fallback;
  }
}

export async function buildPrimaryReasonerContext(caseId: string) {
  const [canonicalState, reconstruction, facts, authoritySnapshots, unknowns] = await Promise.all([
    db.canonicalCaseState.findUnique({ where: { caseId } }),
    db.caseReconstruction.findUnique({ where: { caseId } }),
    db.evidenceFact.findMany({
      where: { caseId },
      orderBy: { createdAt: "asc" },
      take: 80,
      select: {
        key: true,
        value: true,
        confidence: true,
        provenance: true,
        verificationState: true,
        sourceAnchorJson: true,
      },
    }),
    db.authoritySnapshot.findMany({
      where: { caseId },
      orderBy: { retrievedAt: "desc" },
      take: 20,
      select: {
        title: true,
        url: true,
        effectiveOrUpdateDate: true,
        excerpt: true,
        applicabilityJson: true,
        source: { select: { publisher: true, sourceType: true, authorityRank: true } },
      },
    }).catch(() => []),
    db.caseUnknown.findMany({ where: { caseId, status: "open" }, select: { key: true, question: true, reason: true }, take: 20 }),
  ]);

  return {
    canonical_state: canonicalState ? parseJson(canonicalState.approvedStateJson || canonicalState.stateJson, {}) : null,
    case_reconstruction: reconstruction
      ? {
          summary: reconstruction.summary,
          current_position: reconstruction.currentPosition,
          timeline: parseJson(reconstruction.timelineJson, []),
          pending_actions: parseJson(reconstruction.pendingActionsJson, []),
          confidence: reconstruction.confidence,
        }
      : null,
    evidence_ledger: facts,
    material_unknowns: unknowns,
    authority_bundle: authoritySnapshots.map((snapshot) => ({
      title: snapshot.title,
      url: snapshot.url,
      publisher: snapshot.source.publisher,
      source_type: snapshot.source.sourceType,
      authority_rank: snapshot.source.authorityRank,
      effective_or_update_date: snapshot.effectiveOrUpdateDate,
      excerpt: snapshot.excerpt,
      applicability: parseJson(snapshot.applicabilityJson, []),
    })),
  };
}
