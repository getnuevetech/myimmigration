/**
 * Opus document-intelligence output → ledger-shaped facts.
 * Claude establishes evidence; Sol must not invent these facts.
 */

export type DocumentIntelligenceFact = {
  fact: string;
  value: string | boolean | number | null;
  source_location?: string;
  confidence?: number;
};

export type DocumentIntelligenceFinding = {
  finding: string;
  source?: string;
  confidence?: number;
};

export type DocumentIntelligencePayload = {
  document_type?: string;
  document_id?: string;
  form_number?: string | null;
  receipt_number?: string | null;
  notice_type?: string | null;
  facts?: DocumentIntelligenceFact[];
  procedural_findings?: DocumentIntelligenceFinding[];
  unknowns?: string[];
  contradictions?: unknown[];
  important_dates?: unknown[];
  deadlines?: unknown[];
  key_fields?: Record<string, unknown>;
  /** @deprecated prose — ignored for ledger; Sol owns customer language */
  plain_english_explanation?: string;
};

export function parseDocumentIntelligence(raw: unknown): DocumentIntelligencePayload | null {
  if (!raw || typeof raw !== "object") return null;
  return raw as DocumentIntelligencePayload;
}

/** Flatten Opus structured findings into key/value facts for the evidence ledger. */
export function ledgerFactsFromDocumentIntelligence(
  payload: DocumentIntelligencePayload,
  opts?: { documentId?: string },
): { key: string; value: string; confidence: number; sourceLocation: string }[] {
  const rows: { key: string; value: string; confidence: number; sourceLocation: string }[] = [];
  const push = (key: string, value: unknown, confidence = 0.9, source = "document") => {
    if (value == null || value === "") return;
    rows.push({
      key: key.slice(0, 120),
      value: String(value).slice(0, 2000),
      confidence,
      sourceLocation: source.slice(0, 200),
    });
  };

  if (payload.document_type) push("document_type", payload.document_type, 0.95);
  if (payload.form_number) push("form_type", payload.form_number, 0.95);
  if (payload.receipt_number) push("receipt_number", payload.receipt_number, 0.95);
  if (payload.notice_type) push("notice_type", payload.notice_type, 0.95);

  for (const fact of payload.facts ?? []) {
    const key = String(fact.fact || "document_fact")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 80);
    push(key || "document_fact", fact.value, Number(fact.confidence ?? 0.9), fact.source_location || "document");
  }

  for (const finding of payload.procedural_findings ?? []) {
    push(
      "procedural_finding",
      finding.finding,
      Number(finding.confidence ?? 0.9),
      finding.source || "document",
    );
  }

  if (opts?.documentId) {
    for (const row of rows) {
      row.sourceLocation = `${opts.documentId}:${row.sourceLocation}`;
    }
  }
  return rows;
}

/** Legacy dual-extractor shape compatibility for situation stage grounding. */
export function documentsBlockFromIntelligence(payload: DocumentIntelligencePayload | null, fallback: unknown): unknown {
  if (!payload) return fallback;
  return {
    document_intelligence: true,
    document_type: payload.document_type ?? "",
    form_number: payload.form_number ?? null,
    receipt_number: payload.receipt_number ?? null,
    notice_type: payload.notice_type ?? null,
    facts: payload.facts ?? [],
    procedural_findings: payload.procedural_findings ?? [],
    unknowns: payload.unknowns ?? [],
    contradictions: payload.contradictions ?? [],
    important_dates: payload.important_dates ?? [],
    deadlines: payload.deadlines ?? [],
    key_fields: payload.key_fields ?? {},
  };
}
