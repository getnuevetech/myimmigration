import "server-only";
import { db } from "./db";
import { formatCaseNumber } from "./case-number";
import type { WizardStep } from "@/actions/forms";

export type KnownFact = { label: string; value: string };
export type FormPrefill = {
  // Values keyed by wizard field key, already validated against the template.
  values: Record<string, string>;
  // Everything we know, for the copy-panel next to the form.
  facts: KnownFact[];
  caseNumber: string | null;
};

/**
 * Builds prefill values + a "what we already know" fact sheet for a form,
 * from the customer's profile and the analyzed data of their most recent case
 * (extracted facts, issues, notices, deadlines). Field keys follow the
 * conventions used by the seeded templates; admin-created templates that use
 * the same keys (name, a_number, address, phone, case_years, receipt_number, ...)
 * prefilled automatically.
 */
export async function buildFormPrefill(userId: string, steps: WizardStep[]): Promise<FormPrefill> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { firstName: true, lastName: true, email: true, phone: true, address: true, idNumber: true },
  });
  const kase = await db.case.findFirst({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    include: {
      issues: true,
      notices: true,
      deadlines: { where: { status: "open" }, orderBy: { dueDate: "asc" }, take: 1 },
      runs: {
        where: { status: "complete" },
        orderBy: { startedAt: "desc" },
        take: 8,
        include: { consensus: true },
      },
    },
  });

  // Merged facts from the most recent analysis run that produced them.
  let merged: Record<string, unknown> = {};
  for (const run of kase?.runs ?? []) {
    try {
      const parsed = JSON.parse(run.consensus?.mergedJson || "{}");
      if (parsed && (parsed.case_years || parsed.forms_filed || parsed.receipt_numbers || parsed.notices_received || parsed.current_status)) {
        merged = parsed;
        break;
      }
    } catch { /* skip unparseable runs */ }
  }

  // ---- Derive the knowledge base ----
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim();

  const yearSet = new Set<number>();
  if (Array.isArray(merged.case_years)) for (const y of merged.case_years) if (typeof y === "number") yearSet.add(y);
  for (const i of kase?.issues ?? []) if (i.caseYear) yearSet.add(i.caseYear);
  for (const n of kase?.notices ?? []) if (n.caseYear) yearSet.add(n.caseYear);
  const years = Array.from(yearSet).sort();
  const yearsText = years.join(", ");

  const noticeSet = new Set<string>();
  if (Array.isArray(merged.notices_received)) for (const n of merged.notices_received) if (typeof n === "string" && n) noticeSet.add(n);
  for (const n of kase?.notices ?? []) if (n.noticeType) noticeSet.add(n.noticeType);
  const notices = Array.from(noticeSet);

  const forms = Array.isArray(merged.forms_filed) ? merged.forms_filed.map(String).filter(Boolean) : [];
  const receipts = Array.isArray(merged.receipt_numbers) ? merged.receipt_numbers.map(String).filter(Boolean) : [];
  const currentStatus = typeof merged.current_status === "string" ? merged.current_status : "";
  const nextDeadline = kase?.deadlines[0] ?? null;

  // ---- Candidate values by field-key convention ----
  const primaryYear = years.length ? String(years[years.length - 1]) : "";
  const candidates: Record<string, string> = {
    name: fullName,
    full_name: fullName,
    first_name: user?.firstName ?? "",
    last_name: user?.lastName ?? "",
    a_number: user?.idNumber ?? "",
    alien_number: user?.idNumber ?? "",
    uscis_number: user?.idNumber ?? "",
    id_number: user?.idNumber ?? "",
    address: user?.address ?? "",
    current_address: user?.address ?? "",
    mailing_address: user?.address ?? "",
    phone: user?.phone ?? "",
    phone_number: user?.phone ?? "",
    daytime_phone: user?.phone ?? "",
    email: user?.email ?? "",
    form_number: forms[0] ?? "",
    forms_filed: forms.join(", "),
    case_year: primaryYear,
    case_years: yearsText,
    years: yearsText,
    receipt_number: receipts[0] ?? "",
    receipt_numbers: receipts.join(", "),
    current_status: currentStatus,
    notice_number: notices.join(", "),
    notice_type: notices.join(", "),
  };

  // Only keep values that fit the template: known field keys, and for
  // select/boolean fields only values that match an actual option.
  const values: Record<string, string> = {};
  for (const step of steps) {
    for (const field of step.fields) {
      const candidate = candidates[field.key];
      if (!candidate) continue;
      if (field.type === "select") {
        if ((field.options ?? []).some((o) => o.value === candidate)) values[field.key] = candidate;
      } else if (field.type === "boolean") {
        if (candidate === "Yes" || candidate === "No") values[field.key] = candidate;
      } else {
        values[field.key] = candidate;
      }
    }
  }

  // ---- Fact sheet for the copy panel ----
  const facts: KnownFact[] = [];
  const add = (label: string, value: string | null | undefined) => {
    if (value) facts.push({ label, value });
  };
  add("Your name", fullName);
  add("Address", user?.address);
  add("Phone", user?.phone);
  add("Email", user?.email);
  add("ID number on file", user?.idNumber);
  if (kase) {
    add("Case", `${formatCaseNumber(kase.number)} — ${kase.title.slice(0, 60)}`);
    add("Case year(s)", yearsText);
    add("Forms filed", forms.join(", "));
    add("Receipt number(s)", receipts.join(", "));
    add("Current status", currentStatus);
    add("USCIS notice(s)", notices.join(", "));
    add("Next deadline", nextDeadline ? `${nextDeadline.title} — ${nextDeadline.dueDate.toLocaleDateString("en-US")}` : "");
    add("Your goal", kase.goal?.slice(0, 120));
  }

  return { values, facts, caseNumber: kase ? formatCaseNumber(kase.number) : null };
}
