import type { SharedEvidenceBrief } from "./brief";

export type LetterGuardFinding = {
  kind: "receipt_number" | "form_type" | "date";
  value: string;
};

export type LetterGuardResult = {
  text: string;
  findings: LetterGuardFinding[];
  changed: boolean;
};

const RECEIPT_RE = /\b[A-Z]{3}\d{10}\b/g;
const FORM_RE = /\b(?:I|N|G)-\d{2,4}[A-Z]?\b/g;
const DATE_RE = /\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2},?\s+20\d{2}\b/g;

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function unsupported(kind: LetterGuardFinding["kind"], values: string[], supportedText: string): LetterGuardFinding[] {
  return unique(values).filter((value) => !supportedText.includes(value.toUpperCase())).map((value) => ({ kind, value }));
}

function placeholder(kind: LetterGuardFinding["kind"]): string {
  if (kind === "receipt_number") return "[VERIFY RECEIPT NUMBER FROM RECORD]";
  if (kind === "form_type") return "[VERIFY FORM TYPE FROM RECORD]";
  return "[VERIFY DATE FROM RECORD]";
}

export function guardLetterDraftWithEvidence(draft: string, brief: SharedEvidenceBrief | null): LetterGuardResult {
  if (!brief) return { text: draft, findings: [], changed: false };

  const findings = [
    ...unsupported("receipt_number", draft.match(RECEIPT_RE) ?? [], brief.supportedText),
    ...unsupported("form_type", draft.match(FORM_RE) ?? [], brief.supportedText),
    ...unsupported("date", draft.match(DATE_RE) ?? [], brief.supportedText),
  ];
  if (findings.length === 0) return { text: draft, findings, changed: false };

  let guarded = draft;
  for (const finding of findings) {
    guarded = guarded.split(finding.value).join(placeholder(finding.kind));
  }
  const note = [
    "[Evidence guard: unsupported receipt numbers, form types, or dates were replaced with verification placeholders. Review the USCIS record before mailing.]",
    "",
  ].join("\n");
  return { text: `${note}${guarded}`, findings, changed: true };
}
