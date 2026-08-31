# TaxOnMe to ImmigrationOnMe domain map

ImmigrationOnMe should port TaxOnMe engine behavior, not TaxOnMe language.
Generic evidence modules may keep shared concepts such as facts, events,
relationships, unknowns, audits, and reconstruction. Anything customer-facing or
domain-specific must pass through this map.

**Reverse direction (optimize TaxOnMe from current ImmigrationOnMe):**  
see `docs/TAXONME-OPTIMIZATION-EXECUTION-PLAN.md`.

## Product boundary

| TaxOnMe primitive | ImmigrationOnMe equivalent |
| --- | --- |
| IRS | USCIS, EOIR, Department of State, or another immigration agency named by the record |
| Taxpayer | Applicant, petitioner, beneficiary, respondent, or sponsor |
| CPA / EA | Immigration attorney, DOJ-accredited representative, or qualified immigration professional |
| Letter to the IRS | Response to USCIS or another immigration agency |
| Account transcript | USCIS online case status, I-797 notice, receipt notice, RFE, NOID, approval, denial, biometrics notice, interview notice |
| Transcript parser | Immigration document classifier and extractor |

## Evidence concepts

| TaxOnMe primitive | ImmigrationOnMe equivalent |
| --- | --- |
| Tax year / tax period | Receipt number + form type + filing date, notice date, priority date, or deadline |
| Tax module state | Immigration case posture: filed, received, pending, RFE issued, interview scheduled, approved, denied, administratively closed |
| Transaction code | Notice type, form type, receipt status, appointment type, decision type |
| Account balance | Case status, pending action, deadline, or fee issue named in a USCIS notice |
| Credit transfer between years | Concurrent filing, derivative case, cross-petition, transferred case, linked receipt |
| Missing return | Missing filing, missing form, missing response packet, missing supporting evidence |

## Document type mapping

| TaxOnMe document family | ImmigrationOnMe document family |
| --- | --- |
| Account transcript | `case_status_record` |
| Return transcript | `uscis_form` |
| IRS notice | `uscis_notice`, `i797_notice`, `rfe`, `noid` |
| Wage and income document | `supporting_evidence`, `identity_document`, `financial_support_document` |
| Payment confirmation | `fee_receipt` |

## Fact key mapping

| TaxOnMe fact key | ImmigrationOnMe fact key |
| --- | --- |
| `tax_year` | `case_year` |
| `tax_period` | `receipt_number`, `form_type`, `priority_date` |
| `balance_due` | `case_status`, `pending_action`, `fee_issue` |
| `notice_deadline` | `response_deadline`, `appointment_date`, `filing_deadline` |
| `transcript_code` | `notice_type`, `decision_type`, `appointment_type` |
| `irs_address` | `agency_address`, `filing_location` |

## Porting rules

1. Do not copy TaxOnMe prompt bodies directly. Preserve JSON shape, translate
   terms and examples.
2. Do not expose IRS, transcript, tax balance, refund, Form 9465, or tax-period
   language unless the user uploaded an immigration record that explicitly
   mentions a tax document as supporting evidence.
3. Evidence modules should be generic where possible. Domain-specific classifiers,
   fact keys, event names, prompts, and copy belong under `src/domain`.
4. Every customer-facing claim should trace to an evidence fact, case event,
   knowledge source, or an explicit unknown.
5. Suppress clarifying questions only when the evidence ledger already answers
   the question.
