/**
 * Phase C — three locks (retrieval / presentation / recommendation).
 * Run: npx tsx scripts/phase-c-locks-check.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ANTI_I130_MARRIAGE_ALONE,
  VAWA_CONTAMINATION_PHRASES,
  caseTypeLockFromBrief,
  detectI130ContaminationRisk,
  filterByRetrievalLock,
  isVawaI360Lock,
  passesPresentationLock,
  passesRecommendationLock,
  passesRetrievalLock,
  shouldEmitAntiI130,
} from "../src/lib/case-type-lock";
import { DOCUMENT_CATALOG, documentHintForLock, rankMatchingDocuments } from "../src/lib/goal-documents";
import { rankKnowledgeSources, type KnowledgeRecord } from "../src/lib/knowledge-retrieval";
import { assembleV5CustomerPresentation, v5CustomerPresentationText } from "../src/lib/v5-customer-presentation";
import { buildSituationBrief, VAWA_PRIMA_FACIE_FIXTURE } from "../src/lib/situation-brief";

function main() {
  const brief = buildSituationBrief(VAWA_PRIMA_FACIE_FIXTURE);
  const lock = caseTypeLockFromBrief(brief);
  assert.ok(lock, "VAWA brief must produce a case-type lock");
  assert.equal(lock.doNotRecommendNewPathway, true);
  assert.equal(isVawaI360Lock(lock), true);

  // Catalog must not ship golden contamination phrases.
  const catalogBlob = DOCUMENT_CATALOG.map((d) => d.hint).join("\n");
  for (const phrase of VAWA_CONTAMINATION_PHRASES) {
    assert.equal(catalogBlob.includes(phrase), false, `catalog must not include: ${phrase}`);
  }

  // Presentation lock on ranked document hints under VAWA.
  const ranked = rankMatchingDocuments({
    themes: ["family", "humanitarian"],
    inquiryMode: "existing_case",
    query: "VAWA I-360 prima facie married to USC",
    caseLock: lock,
  });
  for (const item of ranked) {
    assert.ok(passesPresentationLock(item.hint, lock), `hint fails presentation lock: ${item.kind} → ${item.hint}`);
    for (const phrase of VAWA_CONTAMINATION_PHRASES) {
      assert.equal(item.hint.includes(phrase), false);
    }
  }
  assert.equal(
    documentHintForLock("relationship", "as Form I-130 instructions describe for spouses", lock).includes(
      "Form I-130 instructions describe",
    ),
    false,
  );

  // Retrieval lock hard-filters competing pathway knowledge.
  const sources: KnowledgeRecord[] = [
    {
      title: "VAWA Form I-360 self-petition",
      reference: "I-360",
      tags: "vawa",
      content: "USCIS Form I-360 for battered spouses.",
    },
    {
      title: "Form I-130 instructions",
      reference: "I-130",
      tags: "family",
      content: "Form I-130 instructions describe marriage evidence for a family petition.",
    },
    {
      title: "Asylum Form I-589 packet",
      reference: "I-589",
      tags: "asylum",
      content: "Form I-589 and similar packets request country-conditions material.",
    },
  ];
  assert.equal(passesRetrievalLock(sources[0].content, lock), true);
  assert.equal(passesRetrievalLock(sources[1].content, lock), false);
  assert.equal(passesRetrievalLock(sources[2].content, lock), false);

  const filtered = filterByRetrievalLock(sources, lock, (s) => `${s.title} ${s.reference} ${s.content}`);
  assert.equal(filtered.length, 1);
  assert.match(filtered[0].title, /I-360|VAWA/i);

  const rankedKnowledge = rankKnowledgeSources(
    sources,
    { query: "VAWA I-360 prima facie", caseLock: lock, themes: ["humanitarian"] },
    5,
  );
  assert.ok(rankedKnowledge.every((s) => /i-?360|vawa/i.test(`${s.title} ${s.reference}`)));
  assert.ok(!rankedKnowledge.some((s) => /i-?589|i-?130 instructions/i.test(`${s.title} ${s.content}`)));

  // Recommendation lock.
  assert.equal(passesRecommendationLock("Stay with the VAWA Form I-360 case already on file", lock), true);
  assert.equal(
    passesRecommendationLock("Do not treat marriage alone as a reason to file a new Form I-130 instead.", lock),
    true,
  );
  assert.equal(passesRecommendationLock("Review Form I-130 as the first family petition step", lock), false);
  assert.equal(passesRecommendationLock("File Form I-589 asylum application", lock), false);

  // Anti-I-130 allowed, not global.
  const risk = detectI130ContaminationRisk([
    ...(brief.situationBullets ?? []).map((b) => b.text),
    brief.customerQuestion ?? "",
  ]);
  assert.equal(risk, true, "VAWA marriage-to-USC fixture should flag I-130 contamination risk");
  assert.equal(shouldEmitAntiI130({ lock, hasI130ShapedContaminationRisk: true }), true);
  assert.equal(shouldEmitAntiI130({ lock, hasI130ShapedContaminationRisk: false }), false);
  assert.equal(
    shouldEmitAntiI130({
      lock: { primaryForm: "I-130", relatedForm: null, doNotRecommendNewPathway: false, lockFamilyOpenOptionsI130: true },
      hasI130ShapedContaminationRisk: true,
    }),
    false,
  );

  // Customer presentation: no contamination; anti-I-130 present for this fixture.
  const view = assembleV5CustomerPresentation({
    brief,
    documents: (VAWA_PRIMA_FACIE_FIXTURE.documents ?? []).map((d) => ({
      fileName: d.fileName ?? "document",
      documentType: d.documentType,
    })),
    neededDocs: ranked.slice(0, 3).map((d) => ({ kind: d.kind, label: d.label, hint: d.hint })),
  });
  const text = v5CustomerPresentationText(view);
  for (const phrase of VAWA_CONTAMINATION_PHRASES) {
    assert.equal(text.includes(phrase), false, `customer text must not include: ${phrase}`);
  }
  assert.equal(text.includes("Identity & Entry Document"), false);
  assert.equal(text.includes("file Form I-130 first"), false);
  assert.ok(text.includes(ANTI_I130_MARRIAGE_ALONE), "fixture requires anti-I-130 when contamination risk present");
  assert.ok(text.includes("What this notice means"));
  assert.ok(!/Review Form I-130|File Form I-589|country-conditions material/i.test(text));

  // INV-LOCK helpers present in source.
  const lockSrc = readFileSync(join(process.cwd(), "src/lib/case-type-lock.ts"), "utf8");
  assert.ok(lockSrc.includes("passesRetrievalLock"));
  assert.ok(lockSrc.includes("passesPresentationLock"));
  assert.ok(lockSrc.includes("passesRecommendationLock"));
  assert.ok(lockSrc.includes("shouldEmitAntiI130"));

  console.log("phase-c-locks-check: ok");
}

main();
