/**
 * Phase S3 — Filing Plan builder (not a Case).
 * Created only when the customer chooses to pursue a pathway.
 */

export type FilingPlanContent = {
  selectedPathway: string;
  pathwayLabel: string;
  eligibility: {
    summary: string;
    requirements: string[];
  };
  blockers: string[];
  filings: { form: string; role: string; notes: string }[];
  evidenceNeeds: string[];
  sequence: string[];
  preparationStatus: "draft" | "in_progress" | "ready" | "filed";
  consultantHint: string;
  selfFileHint: string;
};

type PathwayHint = { id: string; condition?: string; explanation?: string };

const FAMILY_AOS: FilingPlanContent = {
  selectedPathway: "adjustment_of_status",
  pathwayLabel: "Marriage-based adjustment from inside the U.S.",
  eligibility: {
    summary:
      "Typically involves a U.S.-citizen spouse filing Form I-130 and, if you were inspected/admitted/paroled and otherwise eligible, filing Form I-485 to adjust status inside the United States.",
    requirements: [
      "Valid marriage to a U.S. citizen (or qualifying LPR in other categories)",
      "Manner of entry that may support adjustment (inspection, admission, or parole) — confirm for your facts",
      "You are not barred from adjustment by other grounds that apply to your history",
    ],
  },
  blockers: [
    "Entry without inspection may block adjustment unless an exception applies",
    "Prior removal orders, certain criminal issues, or misrepresentation can change or block the path",
    "Missing civil documents (marriage certificate, identity) will delay filing",
  ],
  filings: [
    { form: "I-130", role: "Family petition by U.S.-citizen spouse", notes: "Establishes the qualifying relationship" },
    { form: "I-485", role: "Application to adjust status", notes: "Only if adjustment inside the U.S. is available" },
    { form: "I-765", role: "Optional work authorization", notes: "Often filed with I-485 when eligible" },
    { form: "I-131", role: "Optional advance parole travel", notes: "Often filed with I-485 when eligible" },
  ],
  evidenceNeeds: [
    "Proof of U.S. citizenship of the petitioning spouse",
    "Marriage certificate",
    "Identity documents for both spouses",
    "Evidence of bona fide marriage (joint life)",
    "Financial sponsorship package (typically Form I-864)",
    "Entry/inspection evidence when available (e.g. I-94) — do not invent missing records",
  ],
  sequence: [
    "Confirm manner of entry and any removal history",
    "Gather civil and relationship evidence",
    "Prepare I-130 (and I-485 package if adjustment applies)",
    "Consultant review (recommended for high-stakes decisions)",
    "File with USCIS when the package is complete",
    "After filing / receipt → this becomes a government Case to track",
  ],
  preparationStatus: "draft",
  consultantHint: "Talk to an immigration professional before filing if entry, prior orders, or bars are unclear.",
  selfFileHint: "If you file yourself, follow current USCIS form instructions and filing addresses — this plan is guidance, not a filed Case.",
};

const FAMILY_CONSULAR: FilingPlanContent = {
  selectedPathway: "consular_processing",
  pathwayLabel: "Marriage petition + consular / alternative processing",
  eligibility: {
    summary:
      "A U.S.-citizen spouse can usually still file Form I-130. Completing permanent residence often involves consular processing abroad and may raise unlawful-presence or waiver issues depending on your history.",
    requirements: [
      "Valid marriage to a U.S. citizen",
      "I-130 approval (or concurrent strategy as advised for your facts)",
      "Consular processing readiness and any waiver analysis if required",
    ],
  },
  blockers: [
    "Unlawful presence can trigger multi-year bars upon departure",
    "Prior removal or certain grounds of inadmissibility may require waivers",
    "Travel without advice can create serious problems",
  ],
  filings: [
    { form: "I-130", role: "Family petition by U.S.-citizen spouse", notes: "Starts the petition" },
    { form: "DS-260", role: "Immigrant visa application (consular)", notes: "After NVC / consular stage when applicable" },
    { form: "I-601 / I-601A", role: "Waiver (if required)", notes: "Only if a waiver ground actually applies — do not file blindly" },
  ],
  evidenceNeeds: [
    "Proof of U.S. citizenship of the petitioning spouse",
    "Marriage certificate and relationship evidence",
    "Identity and civil documents",
    "Any prior immigration paperwork (NTA, removal, prior filings)",
  ],
  sequence: [
    "Confirm entry history and any prior orders",
    "Build I-130 petition package",
    "Assess whether departure / consular processing and waivers apply",
    "Consultant review strongly recommended before travel",
    "File petition; later stages may create a government Case to track",
  ],
  preparationStatus: "draft",
  consultantHint: "Consular and waiver issues are high-stakes — professional review is strongly recommended.",
  selfFileHint: "Do not leave the United States based only on this plan. Confirm strategy with current official guidance or a professional.",
};

const GENERIC: FilingPlanContent = {
  selectedPathway: "general_immigration_path",
  pathwayLabel: "Immigration path preparation",
  eligibility: {
    summary: "A structured plan to pursue the pathway discussed in your Situation — still not a government Case until something is filed or pending with the government.",
    requirements: [
      "Confirm the pathway that fits your facts",
      "Identify eligibility requirements for that pathway",
      "Gather required evidence before filing",
    ],
  },
  blockers: [
    "Unresolved decision-changing facts (for example manner of entry)",
    "Missing civil or identity documents",
  ],
  filings: [
    { form: "TBD", role: "Primary filing for the selected pathway", notes: "Confirm the correct form after the controlling facts are known" },
  ],
  evidenceNeeds: [
    "Identity documents",
    "Relationship or status documents that support the path",
    "Any notices or prior filings already in your possession",
  ],
  sequence: [
    "Resolve controlling unknowns from your Situation",
    "Confirm pathway and forms",
    "Gather evidence",
    "Consultant review or self-file preparation",
    "File → then track as a Case if a government matter exists",
  ],
  preparationStatus: "draft",
  consultantHint: "Connect with an immigration professional when you are ready for review.",
  selfFileHint: "Use official USCIS (or court) instructions for any form you prepare.",
};

export function buildFilingPlanContent(opts: {
  selectedPathway?: string | null;
  pathways?: PathwayHint[];
  narrative?: string;
}): FilingPlanContent {
  const selected =
    opts.selectedPathway ||
    opts.pathways?.[0]?.id ||
    inferPathwayFromNarrative(opts.narrative ?? "");

  if (selected === "adjustment_of_status" || selected === "i130_filing") {
    return { ...FAMILY_AOS, selectedPathway: selected === "i130_filing" ? "adjustment_of_status" : selected };
  }
  if (selected === "consular_processing" || selected === "green_card_path") {
    return {
      ...FAMILY_CONSULAR,
      selectedPathway: selected === "green_card_path" ? "consular_processing" : selected,
    };
  }

  const fromBranch = opts.pathways?.find((p) => p.id === selected);
  if (fromBranch) {
    return {
      ...GENERIC,
      selectedPathway: fromBranch.id,
      pathwayLabel: fromBranch.condition || GENERIC.pathwayLabel,
      eligibility: {
        summary: fromBranch.explanation || GENERIC.eligibility.summary,
        requirements: GENERIC.eligibility.requirements,
      },
    };
  }

  return { ...GENERIC, selectedPathway: selected || GENERIC.selectedPathway };
}

function inferPathwayFromNarrative(text: string): string {
  if (/\b(wife|husband|spouse|married|usc|citizen)\b/i.test(text) && /\b(border|mexico|entered)\b/i.test(text)) {
    return "adjustment_of_status";
  }
  if (/\b(wife|husband|spouse|married)\b/i.test(text)) return "adjustment_of_status";
  return "general_immigration_path";
}

export function parsePathwaysJson(raw: string): PathwayHint[] {
  try {
    const parsed = JSON.parse(raw || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.map((p: PathwayHint) => ({
      id: String(p.id || ""),
      condition: p.condition ? String(p.condition) : undefined,
      explanation: p.explanation ? String(p.explanation) : undefined,
    })).filter((p) => p.id);
  } catch {
    return [];
  }
}
