import { immigrationDocumentTypeLabel, resolveImmigrationDocumentType } from "@/domain/documents";
import type { PresentationContract } from "@/lib/case-presentation-contract";
import type { SituationBrief, SituationFact, SituationFactState } from "@/lib/situation-brief";
import {
  ANTI_I130_MARRIAGE_ALONE,
  caseTypeLockFromBrief,
  detectI130ContaminationRisk,
  passesPresentationLock,
  passesRecommendationLock,
  scrubPresentationContamination,
  shouldEmitAntiI130,
} from "@/lib/case-type-lock";

export type V5FactMarker = SituationFactState;

export type V5SituationBullet = {
  text: string;
  state: V5FactMarker;
};

export type V5KeyPoint = {
  kind: "notice_meaning" | "most_important";
  heading: string;
  body: string[];
};

export type V5DocumentTakeaway = {
  fileName: string;
  documentType: string;
  label: string;
  confirms: string;
  whyItMatters: string;
};

export type V5NextAction = {
  what: string;
  why: string;
  now: string;
  whatChanges: string;
  actionKey?: string;
  status?: string;
};

export type V5CustomerPresentation = {
  version: 1;
  caseType: string;
  primaryForm: string | null;
  relatedProcess: string | null;
  customerQuestion: string;
  yourSituation: V5SituationBullet[];
  keyPoint: V5KeyPoint;
  currentProcess: string[];
  documentsTellUs: V5DocumentTakeaway[];
  stillNeedToConfirm: { text: string; why: string }[];
  whatToDoNext: V5NextAction[];
};

export type V5CustomerPresentationInput = {
  brief: SituationBrief | null;
  presentation?: PresentationContract | null;
  pathSteps?: { title: string; description: string; actionKey: string; status?: string }[];
  documents?: {
    id?: string | null;
    fileName: string;
    documentType?: string | null;
    docKind?: string | null;
    processingStatus?: string | null;
    contentHash?: string | null;
    duplicateOfId?: string | null;
  }[];
  neededDocs?: { kind: string; label: string; hint: string }[];
};

const MARKER_LABEL: Record<V5FactMarker, string> = {
  verified: "Verified from your documents",
  reported: "You told us",
  unknown: "We still need to confirm",
};

export function v5FactMarkerLabel(state: V5FactMarker): string {
  return MARKER_LABEL[state];
}

function uniqByText<T extends { text: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const key = item.text.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function detectNoticeKind(brief: SituationBrief | null, presentation?: PresentationContract | null): "prima_facie" | "rfe" | "noid" | null {
  const hay = [
    brief?.customerQuestion ?? "",
    brief?.caseType ?? "",
    ...(brief?.situationBullets ?? []).map((item) => item.text),
    ...(brief?.currentPosition ?? []),
    presentation?.hero.current_posture ?? "",
    ...(presentation?.findings ?? []).map((item) => item.title),
  ]
    .join("\n")
    .toLowerCase();
  if (/\bprima facie\b/.test(hay)) return "prima_facie";
  if (/\brfe\b|request for evidence/.test(hay)) return "rfe";
  if (/\bnoid\b|notice of intent to deny/.test(hay)) return "noid";
  return null;
}

function buildKeyPoint(brief: SituationBrief | null, presentation?: PresentationContract | null): V5KeyPoint {
  const notice = detectNoticeKind(brief, presentation);
  const lock = caseTypeLockFromBrief(brief);
  const primary = lock?.primaryForm ?? brief?.primaryForm ?? null;
  const related = brief?.relatedForm ?? null;
  const question = brief?.customerQuestion ?? "What does this immigration situation mean, and what should happen next?";
  const riskTexts = [
    brief?.customerQuestion ?? "",
    brief?.caseType ?? "",
    ...(brief?.situationBullets ?? []).map((item) => item.text),
    ...(brief?.reportedFacts ?? []).map((item) => item.text),
    ...(brief?.verifiedFacts ?? []).map((item) => item.text),
  ];
  const emitAntiI130 = shouldEmitAntiI130({
    lock,
    hasI130ShapedContaminationRisk: detectI130ContaminationRisk(riskTexts),
  });

  if (notice === "prima_facie") {
    const body = [
      "USCIS issued a Prima Facie Determination on your VAWA self-petition. That is a preliminary positive finding that the basic eligibility pieces look present so far.",
      "It is not a final approval of Form I-360, and it is not a green card.",
      related
        ? `Your green-card outcome, if available, is usually decided through the related ${related} adjustment process after the self-petition path is clear — not by starting a new family petition.`
        : "Any green-card step still depends on later USCIS decisions and on whether adjustment of status is available in your case.",
      "Keep following the VAWA I-360 case you already have on file.",
    ];
    if (emitAntiI130) body.push(ANTI_I130_MARRIAGE_ALONE);
    return {
      kind: "notice_meaning",
      heading: "What this notice means",
      body,
    };
  }

  if (notice === "rfe") {
    return {
      kind: "notice_meaning",
      heading: "What this notice means",
      body: [
        "USCIS sent a Request for Evidence. That means the agency needs more information or documents before it can decide the pending application.",
        primary
          ? `The notice belongs to your pending ${primary} matter. The next work is to respond to the RFE — not to start an unrelated new petition.`
          : "The next work is to respond to the RFE for the case already on file — not to start an unrelated new petition.",
        "Use the notice itself for the deadline, mailing or upload instructions, and the exact list of requested items.",
      ],
    };
  }

  if (notice === "noid") {
    return {
      kind: "notice_meaning",
      heading: "What this notice means",
      body: [
        "USCIS issued a Notice of Intent to Deny. That is a serious notice saying the agency plans to deny unless the problems listed are addressed.",
        "Read every ground listed on the notice and respond before the deadline. Licensed professional review is strongly recommended.",
      ],
    };
  }

  if (brief?.lockFamilyOpenOptionsI130 || primary === "I-130") {
    return {
      kind: "most_important",
      heading: "The most important thing to know",
      body: [
        "For a marriage-based green-card path when nothing has been filed yet, the usual first USCIS form is Form I-130 (family petition).",
        "Form I-485 (adjustment of status) comes later if that path fits — it is not the first form to prepare when no petition is on file.",
        `You asked: ${question}`,
      ],
    };
  }

  return {
    kind: "most_important",
    heading: "The most important thing to know",
    body: [
      question,
      primary
        ? `The primary immigration matter we are tracking is ${brief?.caseType ?? "this case"} on Form ${primary}.`
        : `We are organizing this as: ${brief?.caseType ?? "an immigration situation"}.`,
      brief?.relatedProcess
        ? `A related process on the record is ${brief.relatedProcess}${related ? ` (Form ${related})` : ""}.`
        : "We will stay with the filings already indicated before suggesting a different pathway.",
    ],
  };
}

function documentTakeaway(doc: {
  fileName: string;
  documentType?: string | null;
  docKind?: string | null;
}): V5DocumentTakeaway {
  // Prefer stored content classification. Never treat bare upload docKind "identity"
  // as Identity & Entry — re-resolve from filename when type is empty/other/identity.
  const resolvedType = resolveCustomerDocumentType(doc);
  const label = immigrationDocumentTypeLabel(resolvedType);
  const typeKey = String(resolvedType).toLowerCase();
  if (typeKey.includes("prima_facie")) {
    return {
      fileName: doc.fileName,
      documentType: resolvedType,
      label,
      confirms: "USCIS issued a Prima Facie Determination on the VAWA self-petition.",
      whyItMatters: "It shows a preliminary positive finding on the I-360 path, not a final approval or a green card.",
    };
  }
  if (typeKey.includes("i360") || (typeKey.includes("receipt") && /i-?360/i.test(doc.fileName))) {
    return {
      fileName: doc.fileName,
      documentType: resolvedType,
      label,
      confirms: "USCIS received Form I-360 and issued a filing receipt.",
      whyItMatters: "The receipt locks the VAWA self-petition as an existing filing already on record.",
    };
  }
  if (typeKey === "rfe" || typeKey.includes("rfe")) {
    return {
      fileName: doc.fileName,
      documentType: resolvedType,
      label,
      confirms: "USCIS issued a Request for Evidence on the pending case.",
      whyItMatters: "The notice controls the response deadline and the exact evidence USCIS still needs.",
    };
  }
  if (typeKey.includes("aos") || typeKey.includes("i485") || (/i-?485/i.test(doc.fileName) && typeKey.includes("receipt"))) {
    return {
      fileName: doc.fileName,
      documentType: resolvedType,
      label,
      confirms: "USCIS issued a receipt for Form I-485.",
      whyItMatters: "It confirms an adjustment-of-status filing is already part of the record.",
    };
  }
  if (typeKey.includes("relationship") || typeKey.includes("civil") || /marriage/i.test(doc.fileName)) {
    return {
      fileName: doc.fileName,
      documentType: resolvedType,
      label,
      confirms: "Your civil marriage / relationship record is on file.",
      whyItMatters: "It supports the relationship facts already used in the case reconstruction.",
    };
  }
  if (typeKey.includes("declaration")) {
    return {
      fileName: doc.fileName,
      documentType: resolvedType,
      label,
      confirms: "You uploaded a personal declaration / supporting statement.",
      whyItMatters: "It is part of the self-petitioner’s own evidence package, not a USCIS decision.",
    };
  }
  if (typeKey.includes("admission") || /i-?94/i.test(doc.fileName)) {
    return {
      fileName: doc.fileName,
      documentType: resolvedType,
      label,
      confirms: "An admission / entry record (such as an I-94) is on file.",
      whyItMatters: "It helps show how and when you were admitted to the United States.",
    };
  }
  if (typeKey === "identity_document" || (typeKey.includes("identity") && /passport|visa|biographic/i.test(doc.fileName))) {
    return {
      fileName: doc.fileName,
      documentType: resolvedType,
      label,
      confirms: "An identity or travel document is on file.",
      whyItMatters: "It helps confirm identity for the filings already under review.",
    };
  }
  return {
    fileName: doc.fileName,
    documentType: resolvedType,
    label,
    confirms: `We reviewed this upload as ${label}.`,
    whyItMatters: "It was classified from its contents so it can support the locked case, not a generic identity bucket.",
  };
}

function resolveCustomerDocumentType(doc: {
  fileName: string;
  documentType?: string | null;
  docKind?: string | null;
}): string {
  return resolveImmigrationDocumentType({
    fileName: doc.fileName,
    text: "",
    declaredType: doc.documentType,
    docKind: doc.docKind,
  });
}

/** INV-DEDUP-01: one customer evidence row per document identity / prima facie group. */
export function dedupeDocumentsForCustomerPresentation<T extends {
  fileName: string;
  documentType?: string | null;
  docKind?: string | null;
  contentHash?: string | null;
  duplicateOfId?: string | null;
  id?: string | null;
}>(docs: T[]): T[] {
  const out: T[] = [];
  const seenHash = new Set<string>();
  const seenGroup = new Set<string>();
  for (const doc of docs) {
    if (doc.duplicateOfId) continue;
    const hash = String(doc.contentHash ?? "").trim();
    if (hash) {
      if (seenHash.has(hash)) continue;
      seenHash.add(hash);
    }
    const type = resolveCustomerDocumentType(doc);
    const group =
      type.includes("prima_facie")
        ? "prima_facie_notice"
        : type.includes("i360") && type.includes("receipt")
          ? "i360_receipt"
          : hash
            ? `hash:${hash}`
            : `file:${doc.fileName.toLowerCase()}|${type}`;
    if (seenGroup.has(group)) continue;
    seenGroup.add(group);
    out.push(doc);
  }
  return out;
}

function whyForUnknown(text: string): string {
  if (/i-?485 receipt/i.test(text)) {
    return "The receipt lets us confirm when adjustment was filed and which case is pending.";
  }
  if (/waiver/i.test(text)) {
    return "The waiver type changes what still has to be proven and which forms apply.";
  }
  if (/i-360.*later|later uscis action/i.test(text)) {
    return "Later USCIS action on the I-360 changes whether the self-petition is still preliminary or finally decided.";
  }
  if (/medical/i.test(text)) {
    return "The immigration medical exam is often required before adjustment can finish.";
  }
  return "This detail materially affects how the locked immigration matter should be read.";
}

function nowLabel(status?: string): string {
  const key = String(status ?? "").toUpperCase();
  if (key === "READY" || key === "CURRENT" || key === "IN_PROGRESS") return "Can be done now";
  if (key === "COMPLETED" || key === "DONE") return "Already completed";
  if (key === "BLOCKED") return "Waiting on another step";
  return "Do this next";
}

function whatChangesForAction(title: string, actionKey?: string): string {
  const key = String(actionKey ?? "").toUpperCase();
  const hay = `${title} ${key}`.toLowerCase();
  if (/rfe|upload_notice|notice/.test(hay)) {
    return "We can confirm the deadline and requested items from the USCIS notice itself.";
  }
  if (/i-360|vawa/.test(hay)) {
    return "The review stays on the VAWA self-petition instead of switching to a new family petition.";
  }
  if (/i-130/.test(hay)) {
    return "You will have the correct first family-petition form in view before any adjustment filing.";
  }
  if (/i-485|adjust/.test(hay)) {
    return "The related adjustment filing can be checked against the locked petition path.";
  }
  if (/document|upload|evidence/.test(hay)) {
    return "Missing records move from unknown to verified once they are reviewed.";
  }
  if (/professional|consultant|review_analysis/.test(hay)) {
    return "A licensed reviewer can check high-stakes notice language before you respond.";
  }
  return "The next screen and recommendations update from the locked case record.";
}

function whyForAction(title: string, description: string, brief: SituationBrief | null): string {
  const desc = description.trim();
  if (desc) return desc;
  if (brief?.doNotRecommendNewPathway) {
    return `This step belongs to the locked ${brief.caseType} matter${brief.primaryForm ? ` (Form ${brief.primaryForm})` : ""}, not a new unrelated pathway.`;
  }
  return `This is one of the next actions that matter for: ${brief?.customerQuestion ?? title}.`;
}

function buildNextActions(input: V5CustomerPresentationInput): V5NextAction[] {
  const brief = input.brief;
  const fromPresentation = (input.presentation?.actions ?? []).map((action) => ({
    what: action.title,
    why: whyForAction(action.title, "", brief),
    now: nowLabel(action.status),
    whatChanges: whatChangesForAction(action.title, action.action_key),
    actionKey: action.action_key,
    status: action.status,
  }));
  const fromSteps = (input.pathSteps ?? []).map((step) => ({
    what: step.title,
    why: whyForAction(step.title, step.description, brief),
    now: nowLabel(step.status),
    whatChanges: whatChangesForAction(step.title, step.actionKey),
    actionKey: step.actionKey,
    status: step.status,
  }));
  const hero = input.presentation?.hero.next_best_action;
  const seeded: V5NextAction[] = [];
  if (hero) {
    seeded.push({
      what: hero.title,
      why: whyForAction(hero.title, "", brief),
      now: "Can be done now",
      whatChanges: whatChangesForAction(hero.title, hero.action_key),
      actionKey: hero.action_key,
      status: "READY",
    });
  }

  const combined = [...seeded, ...fromPresentation, ...fromSteps];
  const seen = new Set<string>();
  const out: V5NextAction[] = [];
  const lock = caseTypeLockFromBrief(brief);
  for (const item of combined) {
    const key = item.what.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    // Phase C recommendation lock — drop competing pathway recommendations.
    const blob = `${item.what}\n${item.why}\n${item.whatChanges}`;
    if (!passesRecommendationLock(blob, lock)) continue;
    if (!passesPresentationLock(blob, lock) && lock?.doNotRecommendNewPathway) {
      const scrubbedWhy = scrubPresentationContamination(item.why);
      if (!passesPresentationLock(`${item.what}\n${scrubbedWhy}`, lock)) continue;
      item.why = scrubbedWhy;
    }
    seen.add(key);
    out.push(item);
    if (out.length >= 5) break;
  }

  if (out.length >= 3) return out.slice(0, 5);

  // Deterministic fillers from the locked brief so fixtures always get 3–5 actions.
  const fillers: V5NextAction[] = [];
  if (brief?.doNotRecommendNewPathway && brief.primaryForm === "I-360") {
    fillers.push(
      {
        what: "Stay with the VAWA Form I-360 case already on file",
        why: "Existing filings take priority over a new family petition.",
        now: "Can be done now",
        whatChanges: "Recommendations stay on I-360 / related I-485 instead of I-130.",
      },
      {
        what: "Upload any missing I-485 receipt if adjustment was filed",
        why: "You told us an I-485 may exist; the receipt verifies that related filing.",
        now: "Can be done now",
        whatChanges: "The related adjustment process moves from reported to verified.",
      },
      {
        what: "Keep the prima facie notice with your case records",
        why: "It explains the preliminary USCIS finding customers usually ask about first.",
        now: "Can be done now",
        whatChanges: "The notice meaning stays tied to the locked VAWA matter.",
      },
    );
  } else if (brief?.lockFamilyOpenOptionsI130) {
    fillers.push(
      {
        what: "Review Form I-130 as the first family petition step",
        why: "When nothing is filed yet, matching official material starts with I-130.",
        now: "Can be done now",
        whatChanges: "I-485 stays later in the sequence instead of jumping ahead.",
      },
      {
        what: "Gather identity and marriage / relationship records",
        why: "Those are the core evidence types listed for a family petition.",
        now: "Can be done now",
        whatChanges: "Options progress can move from limited matching evidence to a clearer next step.",
      },
      {
        what: "Share any facts that change whether you will file from inside the United States",
        why: "Location and status change whether adjustment or consular processing comes after I-130.",
        now: "Can be done now",
        whatChanges: "The follow-up list narrows to the matching official path.",
      },
    );
  } else if (detectNoticeKind(brief, input.presentation) === "rfe" || brief?.primaryForm === "I-485") {
    fillers.push(
      {
        what: "Respond to the Request for Evidence",
        why: "USCIS already issued an RFE on the pending case; that notice controls the next deadline.",
        now: "Can be done now",
        whatChanges: "Each requested item can be checked off against the notice.",
      },
      {
        what: "Upload or confirm the RFE notice and deadline",
        why: "The printed deadline and evidence list must come from the notice itself.",
        now: "Can be done now",
        whatChanges: "The case posture stays on notice response instead of a new petition.",
      },
      {
        what: "Organize the exact evidence items USCIS listed",
        why: "A complete response answers every requested item, not a generic packet.",
        now: "Can be done now",
        whatChanges: "Gaps move from unknown to addressed before mailing or upload.",
      },
    );
  } else {
    fillers.push(
      {
        what: "Confirm the primary immigration filing on record",
        why: "The next steps depend on which matter is already locked.",
        now: "Can be done now",
        whatChanges: "Recommendations stay limited to that matter and related filings.",
      },
      {
        what: "Upload the most recent USCIS notice or receipt you have",
        why: "Notices turn reported facts into verified case posture.",
        now: "Can be done now",
        whatChanges: "Unknowns about pending action shrink once documents are reviewed.",
      },
      {
        what: "Answer the open confirmation items listed above",
        why: "Those gaps are the ones that materially change the analysis.",
        now: "Can be done now",
        whatChanges: "The situation brief can mark those facts verified or still unknown.",
      },
    );
  }

  for (const item of fillers) {
    const key = item.what.trim().toLowerCase();
    if (seen.has(key)) continue;
    const blob = `${item.what}\n${item.why}\n${item.whatChanges}`;
    if (!passesRecommendationLock(blob, lock)) continue;
    seen.add(key);
    out.push(item);
    if (out.length >= 5) break;
  }
  return out.slice(0, 5);
}

function situationBulletsFromBrief(brief: SituationBrief | null): V5SituationBullet[] {
  if (!brief) return [];
  const bullets: SituationFact[] = [
    ...brief.situationBullets,
    ...brief.unknownFacts.filter((item) => !brief.situationBullets.some((b) => b.text === item.text)),
  ];
  return uniqByText(
    bullets.map((item) => ({
      text: item.text.replace(/^\s*\[Clarified(?: evidence)?\]\s*/i, "").trim(),
      state: item.state,
    })),
  ).slice(0, 15);
}

export function assembleV5CustomerPresentation(input: V5CustomerPresentationInput): V5CustomerPresentation {
  const brief = input.brief;
  const lock = caseTypeLockFromBrief(brief);
  const docs = dedupeDocumentsForCustomerPresentation(
    (input.documents?.length
      ? input.documents
      : (input.presentation?.evidence ?? []).map((item) => ({
          fileName: item.file_name,
          documentType: item.document_type,
          processingStatus: item.processing_status,
        }))
    ).filter((doc) => doc.fileName),
  );

  const stillNeed = uniqByText([
    ...(brief?.unknownFacts ?? []).map((item) => ({ text: item.text, why: whyForUnknown(item.text) })),
    ...(input.presentation?.what_this_means.unknowns ?? []).map((text) => ({ text, why: whyForUnknown(text) })),
    ...(input.neededDocs ?? []).slice(0, 3).map((doc) => {
      const hint = scrubPresentationContamination(doc.hint || "");
      const why =
        hint && passesPresentationLock(hint, lock)
          ? hint
          : "This matching record is still missing from the locked matter.";
      return {
        text: `Upload or confirm: ${doc.label}`,
        why,
      };
    }),
  ])
    .filter((item) => !lock?.doNotRecommendNewPathway || passesPresentationLock(`${item.text}\n${item.why}`, lock))
    .slice(0, 8);

  const process = (brief?.currentPosition?.length
    ? brief.currentPosition
    : [input.presentation?.hero.current_posture].filter(Boolean) as string[]
  ).slice(0, 8);

  return {
    version: 1,
    caseType: brief?.caseType ?? "Immigration situation",
    primaryForm: brief?.primaryForm ?? null,
    relatedProcess: brief?.relatedProcess ?? null,
    customerQuestion: brief?.customerQuestion ?? "What does this immigration situation mean, and what should happen next?",
    yourSituation: situationBulletsFromBrief(brief),
    keyPoint: buildKeyPoint(brief, input.presentation),
    currentProcess: process,
    documentsTellUs: docs.slice(0, 8).map(documentTakeaway),
    stillNeedToConfirm: stillNeed,
    whatToDoNext: buildNextActions(input),
  };
}

/** Customer-facing copy must never include these patterns. */
export const V5_CUSTOMER_FORBIDDEN_RE =
  /\[Clarified|Most likely explanations|What this means|readiness reached|\b\d{1,3}%\s*(ready|options|case strength|readiness)|interview transcript|matching-as-analysis/i;

export function v5CustomerPresentationText(view: V5CustomerPresentation): string {
  return [
    view.caseType,
    view.customerQuestion,
    ...view.yourSituation.map((item) => item.text),
    view.keyPoint.heading,
    ...view.keyPoint.body,
    ...view.currentProcess,
    ...view.documentsTellUs.flatMap((item) => [item.label, item.confirms, item.whyItMatters]),
    ...view.stillNeedToConfirm.flatMap((item) => [item.text, item.why]),
    ...view.whatToDoNext.flatMap((item) => [item.what, item.why, item.now, item.whatChanges]),
  ].join("\n");
}
