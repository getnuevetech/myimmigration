import "server-only";
import { IMMIGRATION_EVENT_TYPES, type ImmigrationEventType } from "@/domain/events";
import { isImmigrationFactKey, type ImmigrationFactKey } from "@/domain/facts";
import { classifyUploadedDocument, type ImmigrationDocumentType } from "@/domain/documents";
import { db } from "@/lib/db";
import { getNumberSetting } from "@/lib/settings";
import { classifyImmigrationInquiry, applyInquiryToEvidenceState, INQUIRY_MODES, authorityQueriesForInquiry } from "@/lib/immigration-inquiry";
import { retrieveUnifiedAuthority } from "@/lib/authority-retrieval";
import { loadBoostsForNarrative } from "@/lib/goal-suggestion-store";
import { resolveReadinessPolicy } from "@/lib/goal-readiness";
import type { KnowledgeRecord } from "@/lib/knowledge-retrieval";
import { buildSituationBrief, stripClarifiedNarrative } from "@/lib/situation-brief";
import { computeEvidenceReadinessSplit } from "./readiness";
import { reconcileEvidenceStates } from "./reconcile";
import type { CompiledCaseEvent, CompiledEvidenceFact, CompiledEvidenceState, EvidenceConfidence } from "./types";

const CONFIDENCE_VALUES: EvidenceConfidence[] = ["confirmed", "likely", "possible", "needs_verification", "not_supported"];

function normalizeConfidence(value: string): EvidenceConfidence {
  return CONFIDENCE_VALUES.includes(value as EvidenceConfidence) ? (value as EvidenceConfidence) : "needs_verification";
}

function normalizeEventType(value: string): ImmigrationEventType {
  return (IMMIGRATION_EVENT_TYPES as readonly string[]).includes(value) ? (value as ImmigrationEventType) : "case_status_updated";
}

function parseJson(value: string): unknown {
  if (!value) return undefined;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

export async function rebuildCaseEvidenceState(caseId: string) {
  const [facts, events, documents, documentsExpected, caseRow, clarifyMessages] = await Promise.all([
    db.evidenceFact.findMany({
      where: { caseId },
      include: { document: { select: { id: true, fileName: true, documentType: true } } },
      orderBy: { createdAt: "asc" },
    }),
    db.caseEvent.findMany({
      where: { caseId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
    db.document.findMany({
      where: { caseId, deletedAt: null, docKind: { not: "avatar" } },
      select: { id: true, processingStatus: true, docKind: true, fileName: true, documentType: true, extractedJson: true },
    }),
    getNumberSetting("analysis.expected_documents", 3),
    db.case.findUnique({ where: { id: caseId }, select: { situation: true, goal: true } }),
    db.caseClarifyMessage.findMany({ where: { caseId }, select: { role: true, questionKey: true, content: true }, orderBy: { createdAt: "asc" } }),
  ]);

  const compiledFacts: CompiledEvidenceFact[] = facts
    .filter((fact) => isImmigrationFactKey(fact.key))
    .map((fact) => ({
      key: fact.key as ImmigrationFactKey,
      value: fact.value,
      valueJson: parseJson(fact.valueJson),
      confidence: normalizeConfidence(fact.confidence),
      source: {
        kind: "document",
        documentId: fact.documentId ?? undefined,
        documentType: (fact.document?.documentType || "other") as ImmigrationDocumentType,
        label: fact.document?.fileName,
      },
      sourceText: fact.sourceText || undefined,
      observedAt: fact.observedAt?.toISOString(),
    }));

  const compiledEvents: CompiledCaseEvent[] = events.map((event, index) => ({
    eventType: normalizeEventType(event.eventType),
    title: event.title,
    description: event.description || undefined,
    dateText: event.dateText || undefined,
    occurredAt: event.occurredAt?.toISOString(),
    evidence: [],
    sortOrder: index,
  }));

  const state: CompiledEvidenceState = {
    documentType: "other",
    facts: compiledFacts,
    events: compiledEvents,
    relationships: [],
    unknowns: [],
    suppressedQuestions: [],
    audit: {
      status: "needs_more_evidence",
      summary: "",
      blockingUnknowns: [],
      warnings: [],
    },
    reconstruction: {
      summary: "",
      currentPosition: "",
      timeline: [],
      pendingActions: [],
      confidence: "needs_verification",
    },
  };
  const clarifyAnswers = clarifyMessages
    .filter((item) => item.role === "user" && item.content.trim())
    .map((item) => {
      const question = [...clarifyMessages].reverse().find((message) => message.role === "assistant" && message.questionKey === item.questionKey)?.content ?? "";
      return { question, answer: item.content };
    });
  const clarifyTexts = clarifyAnswers.map((item) => item.answer);
  const classifiedDocuments = documents.map((doc) => {
    const extracted = parseJson(doc.extractedJson);
    const text = extracted && typeof extracted === "object" && "raw_text" in extracted
      ? String((extracted as { raw_text?: string }).raw_text ?? "")
      : "";
    const classified = classifyUploadedDocument({
      fileName: doc.fileName,
      text,
      declaredType: doc.documentType,
      docKind: doc.docKind,
    });
    return {
      id: doc.id,
      fileName: doc.fileName,
      processingStatus: doc.processingStatus,
      documentType: classified.documentType,
      docKind: classified.docKind,
      text,
      typeChanged: classified.documentType !== (doc.documentType || "") || classified.docKind !== doc.docKind,
    };
  });
  const inquiry = classifyImmigrationInquiry({
    situation: stripClarifiedNarrative(caseRow?.situation),
    goal: caseRow?.goal,
    documentCount: classifiedDocuments.length,
    factKeys: compiledFacts.map((fact) => fact.key),
    clarifyAnswers: clarifyTexts,
  });
  const situationBrief = buildSituationBrief({
    situation: caseRow?.situation,
    goal: caseRow?.goal,
    documents: classifiedDocuments.map((doc) => ({
      fileName: doc.fileName,
      documentType: doc.documentType,
      docKind: doc.docKind,
      text: doc.text,
    })),
    facts: facts.map((fact) => ({
      key: fact.key,
      value: fact.value,
      provenance: fact.provenance,
      confidence: fact.confidence,
      sourceText: fact.sourceText,
    })),
    clarifyAnswers,
  });
  let knowledgeSources: KnowledgeRecord[] = [];
  if (inquiry.mode === INQUIRY_MODES.OPEN_OPTIONS) {
    knowledgeSources = await retrieveUnifiedAuthority({
      query: [stripClarifiedNarrative(caseRow?.situation), caseRow?.goal, ...clarifyTexts].filter(Boolean).join(" "),
      caseId,
      limit: 6,
      persistHits: false,
      preferSnapshots: true,
    });
  }
  const { boosts } = inquiry.mode === INQUIRY_MODES.OPEN_OPTIONS
    ? await loadBoostsForNarrative(stripClarifiedNarrative(caseRow?.situation ?? ""), caseRow?.goal ?? "")
    : { boosts: {} };
  const reconciled = applyInquiryToEvidenceState(
    reconcileEvidenceStates([state]),
    inquiry,
    [stripClarifiedNarrative(caseRow?.situation), caseRow?.goal, ...clarifyTexts].filter(Boolean).join("\n"),
    knowledgeSources,
    boosts,
    clarifyMessages.filter((item) => item.role === "user").map((item) => item.questionKey),
  );
  const readiness = computeEvidenceReadinessSplit({
    documentsCount: classifiedDocuments.length,
    documentsExpected,
    extractedDocumentsCount: classifiedDocuments.filter((doc) => doc.processingStatus === "extracted").length,
    needsReviewDocumentsCount: classifiedDocuments.filter((doc) => doc.processingStatus === "needs_review").length,
    reconciled,
    policy: resolveReadinessPolicy({
      themes: inquiry.themes,
      inquiryMode: inquiry.mode,
      query: [caseRow?.situation, caseRow?.goal].filter(Boolean).join(" "),
      authorityQueries: authorityQueriesForInquiry(inquiry),
      noticeTypes: compiledFacts.filter((fact) => fact.key === "notice_type").map((fact) => fact.value),
      documentsExpected,
      haveKinds: classifiedDocuments.map((doc) => doc.docKind),
    }),
  });

  await db.$transaction(async (tx) => {
    await tx.caseUnknown.deleteMany({ where: { caseId } });
    await tx.suppressedQuestion.deleteMany({ where: { caseId } });
    await tx.evidenceRelationship.deleteMany({ where: { caseId, sourceDocumentId: null } });

    if (reconciled.crossDocumentRelationships.length > 0) {
      await tx.evidenceRelationship.createMany({
        data: reconciled.crossDocumentRelationships.map((item) => ({
          caseId,
          sourceDocumentId: null,
          relationType: item.relationType,
          fromFactKey: item.fromFactKey,
          fromValue: item.fromValue,
          toFactKey: item.toFactKey,
          toValue: item.toValue,
          confidence: item.confidence,
          rationale: item.rationale,
        })),
      });
    }

    if (reconciled.unknowns.length > 0) {
      await tx.caseUnknown.createMany({
        data: reconciled.unknowns.map((item) => ({
          caseId,
          key: item.key,
          question: item.question,
          reason: item.reason,
        })),
      });
    }

    if (reconciled.suppressedQuestions.length > 0) {
      await tx.suppressedQuestion.createMany({
        data: reconciled.suppressedQuestions.map((item) => ({
          caseId,
          questionKey: item.questionKey,
          question: item.question,
          reason: item.reason,
        })),
      });
    }

    for (const doc of classifiedDocuments.filter((item) => item.typeChanged)) {
      await tx.document.update({
        where: { id: doc.id },
        data: { documentType: doc.documentType, docKind: doc.docKind },
      });
    }

    await tx.evidenceAudit.create({
      data: {
        caseId,
        status: reconciled.audit.status,
        summary: reconciled.audit.summary,
        blockingUnknownsJson: JSON.stringify(reconciled.audit.blockingUnknowns),
        warningsJson: JSON.stringify(reconciled.audit.warnings),
      },
    });

    await tx.caseReconstruction.upsert({
      where: { caseId },
      update: {
        summary: reconciled.reconstruction.summary,
        currentPosition: reconciled.reconstruction.currentPosition,
        timelineJson: JSON.stringify(reconciled.reconstruction.timeline),
        pendingActionsJson: JSON.stringify(reconciled.reconstruction.pendingActions),
        confidence: reconciled.reconstruction.confidence,
        briefJson: JSON.stringify(situationBrief),
      },
      create: {
        caseId,
        summary: reconciled.reconstruction.summary,
        currentPosition: reconciled.reconstruction.currentPosition,
        timelineJson: JSON.stringify(reconciled.reconstruction.timeline),
        pendingActionsJson: JSON.stringify(reconciled.reconstruction.pendingActions),
        confidence: reconciled.reconstruction.confidence,
        briefJson: JSON.stringify(situationBrief),
      },
    });

    await tx.case.update({
      where: { id: caseId },
      data: {
        evidenceAvailableScore: readiness.evidenceAvailableScore,
        evidenceProcessedScore: readiness.evidenceProcessedScore,
        actionReadinessScore: readiness.actionReadinessScore,
      },
    });
  });

  return reconciled;
}
