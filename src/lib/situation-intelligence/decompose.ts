import type { ActivatedDimension, DecomposeClaim, DecomposeResult } from "./types";

/**
 * AI1 — Narrative Decomposer (heuristic Phase 1; LLM can replace later).
 * Extracts explicit facts, soft claims, goals, activated dimensions.
 * Must not invent relationships (spouse/employer) that were not stated.
 */
export function decomposeNarrative(message: string, goal = ""): DecomposeResult {
  const text = [message, goal].filter(Boolean).join("\n");
  const out: DecomposeClaim[] = [];
  const activated = new Set<ActivatedDimension>();
  const notes: string[] = [];

  // WHO / ORIGIN — "from X", "I am Xian", nationality words
  const fromMatch = text.match(
    /\b(?:from|citizen of|national of)\s+([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)?)\b/,
  );
  const demonymMatch = text.match(
    /\b(?:I am|I'm)\s+(Haitian|Ukrainian|Venezuelan|Mexican|Zimbabwean|Cuban|Salvadoran|Guatemalan|Honduran|Colombian|Chinese|Indian|Nigerian|Filipino|Filipina)\b/i,
  );
  if (fromMatch?.[1]) {
    out.push({
      key: "country_of_origin",
      value: fromMatch[1],
      dimension: "who_origin",
      source_text: fromMatch[0],
      confidence: 0.92,
      claim_strength: "explicit",
    });
  } else if (demonymMatch?.[1]) {
    const map: Record<string, string> = {
      haitian: "Haiti",
      ukrainian: "Ukraine",
      venezuelan: "Venezuela",
      mexican: "Mexico",
      zimbabwean: "Zimbabwe",
      cuban: "Cuba",
      salvadoran: "El Salvador",
      guatemalan: "Guatemala",
      honduran: "Honduras",
      colombian: "Colombia",
      chinese: "China",
      indian: "India",
      nigerian: "Nigeria",
      filipino: "Philippines",
      filipina: "Philippines",
    };
    const country = map[demonymMatch[1].toLowerCase()];
    if (country) {
      out.push({
        key: "country_of_origin",
        value: country,
        dimension: "who_origin",
        source_text: demonymMatch[0],
        confidence: 0.9,
        claim_strength: "explicit",
      });
    }
  }

  // WHERE — prefer explicit outside/inside; do not treat goal "live in the US" as current location
  const explicitOutside = /\b(outside|not in)\s+the\s+(u\.?s\.?|united states)\b/i.test(text);
  const explicitInside =
    /\b(?:currently\s+)?(?:inside|within)\s+the\s+(u\.?s\.?|united states)\b/i.test(text) ||
    /\b(?:currently\s+)?(?:living|live|residing)\s+in\s+the\s+(u\.?s\.?|united states)\b/i.test(text) ||
    /\bbeen\s+(?:here|living\s+in\s+the\s+(?:u\.?s\.?|united states))\b/i.test(text);

  if (explicitOutside) {
    out.push({
      key: "current_location",
      value: "outside_us",
      dimension: "where",
      source_text: "outside the United States",
      confidence: 0.92,
      claim_strength: "explicit",
    });
  } else if (explicitInside) {
    out.push({
      key: "current_location",
      value: "inside_us",
      dimension: "where",
      source_text: "in the United States",
      confidence: 0.9,
      claim_strength: "explicit",
    });
  }

  // Presence duration often implies inside_us (soft) — only if not explicitly outside
  const yearsMatch = text.match(
    /\b(?:been|living|lived)\s+(?:here|in the (?:u\.?s\.?|united states))\s+(?:for\s+)?(\d+)\s+years?\b/i,
  );
  if (yearsMatch && !explicitOutside) {
    out.push({
      key: "current_location",
      value: "inside_us",
      dimension: "where",
      source_text: yearsMatch[0],
      confidence: 0.85,
      claim_strength: "explicit",
    });
    out.push({
      key: "presence_years_approx",
      value: Number(yearsMatch[1]),
      dimension: "immigration_position",
      source_text: yearsMatch[0],
      confidence: 0.85,
      claim_strength: "explicit",
    });
  }

  // ENTRY / POSITION
  if (/\b(through the border|crossed|came in from|entered)\b/i.test(text)) {
    out.push({
      key: "entry_mentioned",
      value: true,
      dimension: "immigration_position",
      source_text: "entry mentioned",
      confidence: 0.8,
      claim_strength: "explicit",
    });
  }
  if (/\b(without inspection|ewi|entered illegally|never inspected)\b/i.test(text)) {
    out.push({
      key: "entry_manner",
      value: "ewi",
      dimension: "immigration_position",
      source_text: "without inspection / EWI",
      confidence: 0.9,
      claim_strength: "explicit",
    });
  }
  if (/\b(parole|paroled|inspected|admitted|i-?94)\b/i.test(text)) {
    out.push({
      key: "entry_manner",
      value: "inspected_or_paroled",
      dimension: "immigration_position",
      source_text: "inspected/paroled/I-94",
      confidence: 0.88,
      claim_strength: "explicit",
    });
  }
  if (/\b(b-?2|tourist visa|visitor visa|f-?1|h-?1b)\b/i.test(text)) {
    out.push({
      key: "entry_or_status_document",
      value: text.match(/\b(b-?2|tourist visa|visitor visa|f-?1|h-?1b)\b/i)?.[0] ?? "visa",
      dimension: "immigration_position",
      source_text: "visa/status document",
      confidence: 0.86,
      claim_strength: "explicit",
    });
  }

  // GOVERNMENT HISTORY
  if (/\b(haven'?t filed|have not filed|yet to file|never filed|no (uscis )?application)\b/i.test(text)) {
    out.push({
      key: "prior_filing",
      value: "none_reported",
      dimension: "government_history",
      source_text: "no filing reported",
      confidence: 0.9,
      claim_strength: "explicit",
    });
  }
  if (/\b(immigration court|removal|deport|nta|i-?862)\b/i.test(text)) {
    out.push({
      key: "court_or_removal_signal",
      value: true,
      dimension: "government_history",
      source_text: "court/removal language",
      confidence: 0.88,
      claim_strength: "explicit",
    });
    activated.add("court_removal");
  }

  // BASIS — family (only if stated)
  if (/\b(wife|husband|spouse)\b/i.test(text) && /\b(u\.?s\.?\s*citizen|usc|green.?card|permanent resident|lpr)\b/i.test(text)) {
    out.push({
      key: "family_basis",
      value: "usc_or_lpr_spouse",
      dimension: "family",
      source_text: "spouse + USC/LPR",
      confidence: 0.93,
      claim_strength: "explicit",
    });
    activated.add("family");
  } else if (/\b(wife|husband|spouse|married)\b/i.test(text)) {
    out.push({
      key: "family_basis",
      value: "spouse_mentioned",
      dimension: "family",
      source_text: "spouse/married mentioned",
      confidence: 0.75,
      claim_strength: "soft",
    });
    activated.add("family");
  }
  if (/\b(daughter|son|child)\b/i.test(text) && /\b(born in the (u\.?s\.?|united states)|u\.?s\.?\s*citizen)\b/i.test(text)) {
    out.push({
      key: "usc_child",
      value: true,
      dimension: "family",
      source_text: "USC child",
      confidence: 0.9,
      claim_strength: "explicit",
    });
    activated.add("family");
  }

  // BASIS — humanitarian / return concern
  if (/\b(cannot go back|can'?t go back|can'?t return|cannot return|unable to return|afraid to return|fear|persecut|insurgency|war|violence|asylum|refugee)\b/i.test(text)) {
    // Soft: "cannot go back" ≠ established fear of persecution
    const explicitFear = /\b(afraid|fear|persecut|threatened|harmed)\b/i.test(text);
    out.push({
      key: "inability_or_concern_about_return",
      value: true,
      dimension: "humanitarian",
      source_text: "cannot/afraid to return or country harm",
      confidence: 0.9,
      claim_strength: "explicit",
    });
    activated.add("humanitarian");
    if (explicitFear) {
      out.push({
        key: "fear_of_persecution",
        value: true,
        dimension: "humanitarian",
        source_text: "fear/persecution language",
        confidence: 0.7,
        claim_strength: "soft",
      });
    } else {
      out.push({
        key: "fear_of_persecution",
        value: null,
        dimension: "humanitarian",
        source_text: "return concern without explicit fear wording",
        confidence: 0.4,
        claim_strength: "ambiguous",
      });
      notes.push("Return concern stated; fear_of_persecution not explicitly established.");
    }
    if (/\binsurgency|war|conflict|violence\b/i.test(text)) {
      out.push({
        key: "country_condition_claim",
        value: text.match(/\b(insurgency|war|conflict|violence)\b/i)?.[0] ?? "country_conditions",
        dimension: "humanitarian",
        source_text: "country condition",
        confidence: 0.85,
        claim_strength: "explicit",
      });
    }
  }

  // Employment / school soft activations
  if (/\b(employer|job offer|sponsor(?:ship)?|work permit|employment)\b/i.test(text)) {
    activated.add("employment");
    out.push({
      key: "employment_signal",
      value: true,
      dimension: "employment",
      source_text: "employment language",
      confidence: 0.7,
      claim_strength: "soft",
    });
  }
  if (/\b(student|university|school|f-?1)\b/i.test(text)) {
    activated.add("education");
  }

  // GOAL
  if (/\b(live and work|work and live|live.*?work|green card|options|what are my options)\b/i.test(text) || goal.trim()) {
    const goalValue =
      /\blive and work|work and live\b/i.test(text)
        ? "live_and_work_in_us"
        : goal.trim() || "immigration_options";
    out.push({
      key: "goal",
      value: goalValue,
      dimension: "goal",
      source_text: goal.trim() || "live/work/options",
      confidence: 0.9,
      claim_strength: "explicit",
    });
  }

  return {
    claims: out,
    activated_dimensions: [...activated],
    notes,
  };
}
