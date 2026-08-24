import "server-only";
import { createHash } from "crypto";
import { PROMPT_VERSION } from "./ai/prompts";
import { db } from "./db";

function stableJson(value: unknown): string {
  return JSON.stringify(value, (_key, val) => {
    if (val && typeof val === "object" && !Array.isArray(val)) {
      return Object.keys(val as Record<string, unknown>)
        .sort()
        .reduce((acc, key) => {
          acc[key] = (val as Record<string, unknown>)[key];
          return acc;
        }, {} as Record<string, unknown>);
    }
    return val;
  });
}

function sha256(value: unknown): string {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

export async function createEvidenceSnapshot(caseId: string) {
  const [documents, facts, events] = await Promise.all([
    db.document.findMany({
      where: { caseId, deletedAt: null },
      orderBy: { uploadedAt: "asc" },
      select: {
        id: true,
        fileName: true,
        docKind: true,
        documentType: true,
        processingStatus: true,
        contentHash: true,
        extractionSchemaVersion: true,
        uploadedAt: true,
      },
    }),
    db.evidenceFact.findMany({
      where: { caseId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        documentId: true,
        key: true,
        value: true,
        confidence: true,
        provenance: true,
        verificationState: true,
        sourceId: true,
        sourceAnchorJson: true,
        observedAt: true,
        effectiveTime: true,
      },
    }),
    db.caseEvent.findMany({
      where: { caseId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true, documentId: true, eventType: true, title: true, dateText: true, occurredAt: true },
    }),
  ]);
  const hash = sha256({ documents, facts, events, promptVersion: PROMPT_VERSION });
  return db.evidenceSnapshot.upsert({
    where: { caseId_hash: { caseId, hash } },
    update: {},
    create: {
      caseId,
      hash,
      documentsJson: stableJson(documents),
      factsJson: stableJson(facts),
      eventsJson: stableJson(events),
    },
  });
}

export async function ensureCaseVersion(caseId: string, reason = "analysis") {
  const snapshot = await createEvidenceSnapshot(caseId);
  const latest = await db.caseVersion.findFirst({ where: { caseId }, orderBy: { version: "desc" } });
  const reuse = latest?.evidenceSnapshotId === snapshot.id && latest.pipelineConfigVersion === PROMPT_VERSION;
  const row = reuse && latest
    ? await db.caseVersion.update({
        where: { id: latest.id },
        data: { status: "analyzing", reason, completedAt: null },
      })
    : await db.caseVersion.create({
        data: {
          caseId,
          version: (latest?.version ?? 0) + 1,
          reason,
          status: "analyzing",
          pipelineConfigVersion: PROMPT_VERSION,
          evidenceSnapshotId: snapshot.id,
        },
      });
  await db.canonicalCaseState.upsert({
    where: { caseId },
    update: { versionId: row.id, evidenceSnapshotHash: snapshot.hash },
    create: { caseId, versionId: row.id, evidenceSnapshotHash: snapshot.hash },
  });
  return row;
}

export async function finalizeCaseVersion(caseVersionId: string, caseId: string, approvedState: unknown) {
  await db.caseVersion.update({
    where: { id: caseVersionId },
    data: { status: "complete", completedAt: new Date() },
  });
  await db.canonicalCaseState.upsert({
    where: { caseId },
    update: {
      versionId: caseVersionId,
      stateJson: stableJson(approvedState),
      approvedStateJson: stableJson(approvedState),
    },
    create: {
      caseId,
      versionId: caseVersionId,
      stateJson: stableJson(approvedState),
      approvedStateJson: stableJson(approvedState),
    },
  });
}

export async function failCaseVersion(caseVersionId: string) {
  await db.caseVersion.update({ where: { id: caseVersionId }, data: { status: "failed", completedAt: new Date() } }).catch(() => null);
}

export async function getLatestCaseVersion(caseId: string) {
  return db.caseVersion.findFirst({
    where: { caseId },
    orderBy: { version: "desc" },
    include: { evidenceSnapshot: { select: { hash: true } } },
  });
}

export async function listCaseVersions(caseId: string, take = 8) {
  return db.caseVersion.findMany({
    where: { caseId },
    orderBy: { version: "desc" },
    take,
    include: { evidenceSnapshot: { select: { hash: true } } },
  });
}
