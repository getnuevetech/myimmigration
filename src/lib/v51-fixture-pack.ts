/**
 * V5.1 Phase G — multi-fixture pack with positive and negative isolation tests.
 * Correction Spec §13.G: every intelligence change runs the full pack.
 */

import type { SituationBriefInput } from "@/lib/situation-brief";
import {
  AOS_WITHOUT_PETITION_FIXTURE,
  ASYLUM_I589_FIXTURE,
  CONSULAR_I130_FIXTURE,
  COURT_NOTICE_EOIR_FIXTURE,
  EAD_I765_FIXTURE,
  FAMILY_OPEN_OPTIONS_FIXTURE,
  MARRIAGE_I130_FILED_FIXTURE,
  N400_NATURALIZATION_FIXTURE,
  NOID_I485_FIXTURE,
  RFE_I485_FIXTURE,
  VAWA_PRIMA_FACIE_FIXTURE,
} from "@/lib/situation-brief";

export type FixtureIsolationRule = {
  /** Patterns that MUST appear in customer-facing text / brief signals. */
  must_allow?: RegExp[];
  /** Patterns that MUST NOT appear (cross-contamination). */
  must_forbid?: RegExp[];
  /** Expected primary form after brief build. */
  primary_form?: string | null;
  /** Expected lock flags. */
  do_not_recommend_new_pathway?: boolean;
  lock_family_open_options_i130?: boolean;
  /** Document kinds that must be ranked when locked. */
  must_include_doc_kinds?: string[];
  /** Document kinds that must be excluded when locked. */
  must_exclude_doc_kinds?: string[];
};

export type V51PackFixture = {
  id: string;
  label: string;
  kind: "positive" | "negative";
  input: SituationBriefInput;
  isolation: FixtureIsolationRule;
};

export const V51_FIXTURE_PACK: V51PackFixture[] = [
  {
    id: "vawa_i360_pending_i485",
    label: "VAWA I-360 + pending I-485",
    kind: "positive",
    input: VAWA_PRIMA_FACIE_FIXTURE,
    isolation: {
      primary_form: "I-360",
      do_not_recommend_new_pathway: true,
      must_allow: [/\bi-?360\b/i, /\bprima facie\b/i, /\bi-?485\b/i],
      must_forbid: [
        /\bfile Form I-130 first\b/i,
        /\bReview Form I-130\b/i,
        /\bForm I-130 instructions describe\b/i,
        /\bForm I-589 and similar packets\b/i,
        /\bcountry-conditions material\b/i,
        /\bfile Form I-589\b/i,
      ],
      must_exclude_doc_kinds: ["country_conditions"],
    },
  },
  {
    id: "vawa_neg_i589_country_conditions",
    label: "VAWA (neg) — forbid I-589 / country conditions",
    kind: "negative",
    input: VAWA_PRIMA_FACIE_FIXTURE,
    isolation: {
      primary_form: "I-360",
      do_not_recommend_new_pathway: true,
      must_forbid: [
        /\bForm I-589\b/i,
        /\bcountry-conditions material\b/i,
        /\basylum packet\b/i,
        /\bPrepare Form I-589\b/i,
      ],
      must_exclude_doc_kinds: ["country_conditions"],
    },
  },
  {
    id: "marriage_i130_open_options",
    label: "Marriage I-130 / I-485 open options",
    kind: "positive",
    input: FAMILY_OPEN_OPTIONS_FIXTURE,
    isolation: {
      primary_form: "I-130",
      lock_family_open_options_i130: true,
      do_not_recommend_new_pathway: false,
      must_allow: [/\bi-?130\b/i],
      must_forbid: [/start with (?:form )?i-485/i, /\bForm I-589\b/i],
    },
  },
  {
    id: "marriage_i130_filed",
    label: "Marriage I-130 filed pathway",
    kind: "positive",
    input: MARRIAGE_I130_FILED_FIXTURE,
    isolation: {
      primary_form: "I-130",
      do_not_recommend_new_pathway: true,
      must_allow: [/\bi-?130\b/i, /\bfamily petition\b/i],
      must_forbid: [/\bForm I-589\b/i, /\bcountry-conditions material\b/i],
    },
  },
  {
    id: "asylum_i589",
    label: "Asylum I-589",
    kind: "positive",
    input: ASYLUM_I589_FIXTURE,
    isolation: {
      primary_form: "I-589",
      do_not_recommend_new_pathway: true,
      must_allow: [/\bi-?589\b/i, /\basylum\b/i, /\bcountry-conditions\b/i],
      must_forbid: [/\bReview Form I-130\b/i, /\bfile Form I-130 first\b/i],
      must_include_doc_kinds: ["country_conditions", "declaration"],
    },
  },
  {
    id: "rfe_i485",
    label: "RFE on I-485",
    kind: "positive",
    input: RFE_I485_FIXTURE,
    isolation: {
      primary_form: "I-485",
      do_not_recommend_new_pathway: true,
      must_allow: [/request for evidence|\brfe\b/i],
      must_forbid: [/\bReview Form I-130\b/i, /\bForm I-589\b/i],
    },
  },
  {
    id: "noid_i485",
    label: "NOID on I-485",
    kind: "positive",
    input: NOID_I485_FIXTURE,
    isolation: {
      primary_form: "I-485",
      do_not_recommend_new_pathway: true,
      must_allow: [/notice of intent to deny|\bnoid\b/i],
      must_forbid: [/\bReview Form I-130\b/i, /\bcountry-conditions material\b/i],
    },
  },
  {
    id: "ead_i765",
    label: "EAD / I-765",
    kind: "positive",
    input: EAD_I765_FIXTURE,
    isolation: {
      primary_form: "I-765",
      do_not_recommend_new_pathway: true,
      must_allow: [/\bi-?765\b/i],
      must_forbid: [/\bReview Form I-130\b/i, /\bForm I-589\b/i],
    },
  },
  {
    id: "n400_naturalization",
    label: "N-400 naturalization",
    kind: "positive",
    input: N400_NATURALIZATION_FIXTURE,
    isolation: {
      primary_form: "N-400",
      do_not_recommend_new_pathway: true,
      must_allow: [/\bn-?400\b/i, /\bnaturaliz/i],
      must_forbid: [/\bReview Form I-130\b/i, /\bForm I-589\b/i],
    },
  },
  {
    id: "consular_i130",
    label: "Consular processing after I-130",
    kind: "positive",
    input: CONSULAR_I130_FIXTURE,
    isolation: {
      primary_form: "I-130",
      do_not_recommend_new_pathway: true,
      must_allow: [/\bi-?130\b/i, /\bconsular\b/i],
      must_forbid: [/\bForm I-589\b/i, /\bcountry-conditions material\b/i],
    },
  },
  {
    id: "aos_without_petition",
    label: "AOS without petition",
    kind: "positive",
    input: AOS_WITHOUT_PETITION_FIXTURE,
    isolation: {
      primary_form: "I-485",
      do_not_recommend_new_pathway: true,
      must_allow: [/\bi-?485\b/i, /\badjustment\b/i],
      must_forbid: [/\bReview Form I-130\b/i, /\bForm I-589\b/i],
    },
  },
  {
    id: "court_notice_eoir",
    label: "Court notice / EOIR",
    kind: "positive",
    input: COURT_NOTICE_EOIR_FIXTURE,
    isolation: {
      do_not_recommend_new_pathway: true,
      must_allow: [/\beoir\b|\bimmigration court\b|\bnotice to appear\b|\bmaster calendar\b/i],
      must_forbid: [/\bReview Form I-130\b/i, /\bfile Form I-130 first\b/i],
    },
  },
];

export function listV51FixtureIds(): string[] {
  return V51_FIXTURE_PACK.map((f) => f.id);
}
