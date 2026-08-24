import type { ImmigrationDocumentType } from "@/domain/documents";

export type UniversalExtractedFact = {
  fact_type: string;
  original_label: string;
  value: string;
  normalized_value: string;
  date_context: string | null;
  entity_context: string | null;
  source_anchor: { page: number | null; section: string; field: string };
  readability: "CLEAR" | "PARTIAL" | "UNREADABLE";
};

export type UniversalDocumentExtraction = {
  document_identity: { file_name?: string; document_type?: ImmigrationDocumentType | "other" };
  pages: { page_number: number; text: string }[];
  sections: { title: string; text: string; page: number | null }[];
  facts: UniversalExtractedFact[];
  tables: unknown[];
  events: unknown[];
  relationships: unknown[];
  instructions_and_conditions: string[];
  references: string[];
  unclassified_content: string[];
  unreadable_items: string[];
  completeness_notes: string[];
};

const LABEL_RE = /^([A-Za-z][A-Za-z0-9 /#().'-]{1,80}):\s*(.+)$/;
const DATE_RE = /\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2},?\s+20\d{2}\b/gi;
const RECEIPT_RE = /\b[A-Z]{3}\d{10}\b/g;
const FORM_RE = /\b(?:Form\s+)?((?:I|N|G)-?\d{2,4}[A-Z]?)\b/gi;

function normalizeLabel(label: string): string {
  return label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function normalizeValue(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function sectionTitle(line: string): boolean {
  if (/\b(submit|provide|send|include|bring|must|deadline|required|respond|response)\b/i.test(line)) return false;
  return /^[A-Z][A-Za-z0-9 /&(),'-]{3,90}$/.test(line) && !line.includes(":") && line.split(/\s+/).length <= 8;
}

export function extractUniversalDocumentIntelligence(input: {
  fileName?: string;
  documentType?: ImmigrationDocumentType | "other";
  text: string;
}): UniversalDocumentExtraction {
  const lines = input.text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const sections: UniversalDocumentExtraction["sections"] = [];
  const facts: UniversalExtractedFact[] = [];
  const instructions = new Set<string>();
  const references = new Set<string>();
  const unclassified: string[] = [];
  let currentSection = "";

  for (const line of lines) {
    if (sectionTitle(line)) {
      currentSection = line;
      sections.push({ title: line, text: "", page: 1 });
      continue;
    }
    const current = sections[sections.length - 1];
    if (current) current.text = [current.text, line].filter(Boolean).join("\n");

    const labelMatch = line.match(LABEL_RE);
    if (labelMatch) {
      const [, label, rawValue] = labelMatch;
      const value = normalizeValue(rawValue);
      facts.push({
        fact_type: normalizeLabel(label),
        original_label: label.trim(),
        value,
        normalized_value: value,
        date_context: (value.match(DATE_RE) ?? [])[0] ?? null,
        entity_context: null,
        source_anchor: { page: 1, section: currentSection, field: label.trim() },
        readability: "CLEAR",
      });
      continue;
    }

    for (const receipt of line.match(RECEIPT_RE) ?? []) references.add(receipt);
    for (const form of Array.from(line.matchAll(FORM_RE)).map((match) => match[1] ?? match[0])) references.add(form.toUpperCase().replace(/^([ING])(\d)/, "$1-$2"));
    if (/\b(submit|provide|send|include|bring|must|deadline|required|respond|response)\b/i.test(line)) instructions.add(line);
    if (!labelMatch) unclassified.push(line);
  }

  return {
    document_identity: { file_name: input.fileName, document_type: input.documentType },
    pages: [{ page_number: 1, text: input.text }],
    sections,
    facts,
    tables: [],
    events: [],
    relationships: [],
    instructions_and_conditions: Array.from(instructions),
    references: Array.from(references),
    unclassified_content: unclassified.slice(0, 100),
    unreadable_items: input.text.trim() ? [] : ["No machine-readable text was available."],
    completeness_notes: input.text.trim() ? [] : ["Document requires OCR, manual review, or a vision-capable extractor."],
  };
}
