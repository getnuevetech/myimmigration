// Shared enumerations. These are code-level identifiers, not business values —
// all business-configurable values (plans, prices, prompts, providers, copy) live in the database.

export const ROLES = {
  SUPER_ADMIN: "super_admin",
  ADMIN: "admin",
  USER: "user",
  CONSULTANT: "consultant",
} as const;
export type Role = (typeof ROLES)[keyof typeof ROLES];

// Granular admin areas. Super admin has all; sub-admins get a subset.
export const ADMIN_AREAS = [
  { key: "admin.dashboard", name: "Dashboard" },
  { key: "admin.cases", name: "Cases" },
  { key: "admin.users", name: "Customers" },
  { key: "admin.admins", name: "Admin users" },
  { key: "admin.roles", name: "Roles & permissions" },
  { key: "admin.consultants", name: "Immigration Consultants" },
  { key: "admin.assignments", name: "Assignments" },
  { key: "admin.plans", name: "Plans & access control" },
  { key: "admin.payments", name: "Payment gateways" },
  { key: "admin.transactions", name: "Transactions" },
  { key: "admin.ai", name: "AI providers" },
  { key: "admin.pipelines", name: "AI pipelines" },
  { key: "admin.evidence", name: "Evidence diagnostics" },
  { key: "admin.content", name: "Content & agreements" },
  { key: "admin.forms", name: "USCIS form templates" },
  { key: "admin.knowledge", name: "USCIS knowledge base" },
  { key: "admin.settings", name: "App settings" },
  { key: "admin.notifications", name: "Notifications" },
  { key: "admin.tickets", name: "Support tickets" },
  { key: "admin.messages", name: "System messages" },
  { key: "admin.logs", name: "System logs" },
] as const;

// Feature keys gate what plans can access. The plan/feature matrix is edited in the admin backend.
export const FEATURE_KEYS = {
  NOTICE_UPLOAD: "notice.upload",
  NOTICE_EXPLAIN: "notice.explain",
  DOC_UPLOAD: "documents.upload",
  DOC_EXPLAIN: "documents.explain",
  CASE_ANALYSIS: "case.analysis",
  CASE_FULL_RESULTS: "case.full_results",
  QA: "qa.chat",
  LETTERS: "letters.generate",
  DEADLINES: "deadlines.reminders",
  VAULT: "vault.storage",
  FORMS: "forms.wizard",
  CONSULTANT_REFERRAL: "consultant.referral",
  GUIDE_CHATBOT: "guide.chatbot",
  CASE_REPORT: "case.report",
  FORMS_DOWNLOAD: "forms.download",
} as const;

export const STAGE_KEYS = {
  SUMMARY: "summary",
  GOAL: "goal",
  DOCUMENT: "document",
  SITUATION: "situation",
  PRESENTER: "presenter",
  QA: "qa",
  NOTICE: "notice",
  LETTER: "letter",
  GUIDE: "guide",
  MATCH: "match",
  MATCH_REASON: "match_reason",
  CLOSING: "closing",
} as const;
export type StageKey = (typeof STAGE_KEYS)[keyof typeof STAGE_KEYS];

export const STEP_ROLES = {
  FACT_EXTRACTOR: "fact_extractor",
  INTERPRETER: "interpreter",
  SKEPTIC: "skeptic",
  EXTRACTOR_A: "extractor_a",
  EXTRACTOR_B: "extractor_b",
  ANALYST: "analyst",
  REVIEWER: "reviewer",
  PRESENTER: "presenter",
  ASSISTANT: "assistant",
} as const;

export const AI_KINDS = [
  { key: "openai_compatible", name: "OpenAI-compatible (OpenAI, xAI, Mistral, DeepSeek, ...)" },
  { key: "anthropic", name: "Anthropic (Claude)" },
  { key: "google", name: "Google (Gemini)" },
] as const;

export const ISSUE_STATES = {
  resolved: { label: "Resolved", mark: "\u2713" },
  review: { label: "Review", mark: "\u25D0" },
  action_needed: { label: "Action Needed", mark: "!" },
  urgent: { label: "Urgent", mark: "\u25B2" },
  info_needed: { label: "Information Needed", mark: "?" },
} as const;

export const CONSULTANT_SPECIALTIES = [
  { key: "notices", name: "USCIS notices & letters" },
  { key: "family", name: "Family-based immigration" },
  { key: "employment", name: "Employment-based immigration" },
  { key: "asylum", name: "Asylum and humanitarian relief" },
  { key: "removal", name: "Removal defense" },
  { key: "naturalization", name: "Naturalization and citizenship" },
  { key: "rfe", name: "RFE and NOID responses" },
  { key: "interviews", name: "Interview preparation" },
  { key: "appeals", name: "Appeals and motions" },
  { key: "international", name: "Consular processing" },
] as const;

export const DOC_KINDS = [
  { key: "case_record", name: "USCIS case record / online account" },
  { key: "receipt", name: "USCIS receipt notice" },
  { key: "approval", name: "USCIS approval notice" },
  { key: "rfe", name: "Request for Evidence (RFE)" },
  { key: "form", name: "Immigration form" },
  { key: "identity", name: "Passport / visa / identity document" },
  { key: "evidence", name: "Supporting evidence" },
  { key: "notice", name: "USCIS notice or letter" },
  { key: "other", name: "Other" },
] as const;
