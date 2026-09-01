import { PrismaClient } from "@prisma/client";
import { createHash } from "crypto";
import bcrypt from "bcryptjs";
import { DEFAULT_PROMPTS, PROMPT_SUPERSEDES } from "../src/lib/ai/prompts";
import {
  PUBLIC_FAQ_BODY,
  PUBLIC_FEATURE_SORT_ORDER,
  PUBLIC_HERO,
  PUBLIC_HOW_IT_WORKS_PAGE,
  PUBLIC_PLAN_DESCRIPTIONS,
  PUBLIC_TAGLINE,
  STALE_PLAN_DESCRIPTIONS,
  STALE_PUBLIC_HERO_SUBTITLES,
  STALE_PUBLIC_HERO_TITLES,
  STALE_PUBLIC_PRIMARY_CTAS,
  STALE_PUBLIC_TAGLINES,
} from "../src/lib/goal-public";
import { CASE_REPORT_FEATURE_NAME, SUPPORT_PLAYBOOK_MATCHING } from "../src/lib/goal-chrome";
import { ACCOUNT_CREATED_EMAIL } from "../src/lib/goal-conversation";
import { LEGAL_CONTENT_PAGES } from "../src/lib/legal/documents";

const db = new PrismaClient();

function promptHash(prompt: string): string {
  return createHash("sha256").update(prompt).digest("hex");
}

function hasLegacyTaxonmePromptMarker(prompt: string): boolean {
  return [
    "TaxOnMe",
    "expected_amount",
    "tax_year",
    "irs_basis",
    "account_transcript",
    "tax_period",
    "AGI",
    "W-2",
    "1040",
  ].some((marker) => prompt.includes(marker));
}

async function seedSettings() {
  const settings: [string, string, string, string, string, string?][] = [
    // key, value, group, label, description, type
    ["app.name", "ImmigrationOnMe", "branding", "App name", "Shown in the header, titles, and emails."],
    ["app.tagline", PUBLIC_TAGLINE, "branding", "Tagline", "Short slogan shown on the landing page."],
    ["app.url", "http://localhost:3000", "general", "App URL", "Public base URL, used for OAuth callbacks and payment redirects."],
    ["app.disclaimer", "ImmigrationOnMe is an immigration case assistant that helps you understand your immigration situation and USCIS documents in plain English. We are not USCIS and we are not a law firm. We provide informational guidance only, not legal advice. For high-stakes decisions, consult a licensed immigration attorney or accredited representative.", "branding", "Footer disclaimer", "Compliance disclaimer shown in the site footer."],
    ["analytics.tiktok_pixel_id", "DAASLUJC77U47UVQELH0", "analytics", "TikTok Pixel ID", "Sitewide TikTok Ads base pixel. Leave empty to disable."],
    ["analytics.tiktok_access_token", "", "analytics", "TikTok Events API access token", "Server-side Events API token from TikTok Events Manager. Leave empty to skip server events. Generate once — TikTok will not show it again.", "secret"],
    ["home.hero_title", PUBLIC_HERO.title, "branding", "Homepage hero title", ""],
    ["home.hero_subtitle", PUBLIC_HERO.subtitle, "branding", "Homepage hero subtitle", ""],
    ["home.cta_primary", PUBLIC_HERO.primaryCta.label, "branding", "Primary call to action", ""],
    ["home.cta_secondary", PUBLIC_HERO.secondaryCta.label, "branding", "Secondary call to action", ""],
    ["home.hero_images", '["/hero/hero-1.png", "/hero/hero-2.png", "/hero/hero-3.png"]', "branding", "Hero images (JSON array)", "Rotating homepage hero images. JSON array of image URLs or paths — add, remove, or reorder freely."],
    ["font.body", "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif", "typography", "Body font", "Main text and interface font. Use a CSS font stack or one of the provided font variables.", "font"],
    ["font.heading", "var(--font-playfair), Georgia, 'Times New Roman', serif", "typography", "Heading / display font", "Headlines, logo text, editorial numbers, hero display text, and large design typography.", "font"],
    ["font.mono", "var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace", "typography", "Mono / label font", "Small uppercase labels, technical metadata, and monospace accents.", "font"],
    ["auth.google_client_id", "", "auth", "Google OAuth client ID", "Leave empty to hide the Google sign-in button."],
    ["auth.google_client_secret", "", "auth", "Google OAuth client secret", ""],
    ["billing.free_plan_key", "free", "billing", "Free plan key", "Plan applied to users without a paid subscription."],
    ["uscis.account_url", "https://my.uscis.gov/", "uscis", "USCIS online account URL", "Official page users are guided to for USCIS account access."],
    ["analysis.expected_documents", "3", "analysis", "Expected documents per case", "Used by the deterministic case-readiness formula."],
    ["consultants.auto_approve_enabled", "false", "consultants", "Auto-approve consultants", "Automatically approve immigration professional applications meeting requirements."],
    ["consultants.auto_approve_min_years", "3", "consultants", "Auto-approve minimum years", "Minimum years of experience for automated approval."],
    ["consultants.auto_criteria", '["credential","ptin","proof","min_years","attestation"]', "consultants", "Auto-approval required criteria", "JSON array of immigration credential criteria keys required for automated approval (managed on the immigration professional auto-approval page)."],
    ["consultants.auto_assign_enabled", "false", "consultants", "AI auto-assign consultants", "Automatically match flagged cases to the best-fitting consultant (managed on the Assignments page)."],
    ["consultants.auto_assign_min_readiness", "60", "consultants", "Auto-assign minimum readiness (%)", "Flagged cases are only auto-assigned to a consultant when case readiness is at least this percentage; below it, admins are notified instead."],
    ["consultants.subscriptions_enabled", "false", "consultants", "Consultant subscriptions", "Require consultants to hold an active partner plan to accept clients (toggle on the Plans page)."],
    ["users.deleted_retention_days", "90", "users", "Deleted account retention (days)", "How long deleted accounts stay recoverable before being expunged permanently."],
    ["tickets.sla_first_response_hours", "24", "tickets", "Ticket first-response SLA (hours)", "Open tickets without a staff reply within this window are flagged SLA overdue."],
    ["tickets.inbound_email_secret", "", "tickets", "Inbound email webhook secret", "Set to a long random value to enable email-to-ticket at /api/inbound-email?secret=<value>. Empty disables it."],
    ["tickets.auto_close_days", "7", "tickets", "Ticket auto-close (days)", "Tickets are closed automatically when the customer doesn't respond for this many days after a staff reply. 0 disables."],
    ["cases.autoclose_completed_days", "14", "cases", "Case auto-close after completion (days)", "Completed cases (every path step done) close automatically with AI closing remarks this many days after the last activity. 0 disables."],
    ["cases.autoclose_abandoned_days", "60", "cases", "Case auto-close when abandoned (days)", "Cases with no activity for this many days are closed automatically with closing remarks. Documents stay in the customer's account. 0 disables."],
    ["billing.proration_enabled", "true", "billing", "Proration on plan changes", "Credit the unused value of the current plan when a subscriber upgrades (toggle on the Plans page)."],
    ["billing.proration_downgrade_enabled", "false", "billing", "Proration on downgrades", "Also apply the credit when subscribers downgrade (toggle on the Plans page)."],
    ["billing.case_report_overage_cents", "500", "billing", "Additional case report download fee (cents)", "Charged when a customer exceeds their plan's case report download allowance."],
    ["qa.guest_question_limit", "1", "qa", "Guest Q&A question limit", "How many general Q&A questions a visitor can ask before creating an account.", "number"],
    ["qa.guest_max_sentences", "2", "qa", "Guest Q&A excerpt sentences", "How many sentences of official material a guest answer may include.", "number"],
    ["qa.guest_max_excerpts", "1", "qa", "Guest Q&A official excerpts", "How many official sources a guest answer may quote.", "number"],
    ["qa.guest_follow_ups", "1", "qa", "Guest Q&A official follow-ups", "How many official follow-up questions a guest thread may include.", "number"],
    ["qa.free_max_sentences", "3", "qa", "Free-plan Q&A excerpt sentences", "How many sentences of official material a Free-plan general answer may include.", "number"],
    ["qa.free_max_excerpts", "1", "qa", "Free-plan Q&A official excerpts", "How many official sources a Free-plan general answer may quote.", "number"],
    ["qa.free_follow_ups", "1", "qa", "Free-plan Q&A official follow-ups", "How many official follow-up questions a Free-plan general thread may include.", "number"],
    ["suggestions.guest_max_steps", "1", "suggestions", "Guest suggested next steps", "How many official next steps a visitor sees on the first-results page.", "number"],
    ["suggestions.free_max_steps", "1", "suggestions", "Free-plan suggested next steps", "How many official path steps a Free-plan case shows before upgrade.", "number"],
    ["suggestions.free_max_clarify", "3", "suggestions", "Free-plan follow-up answers per case", "How many clarify answers a Free-plan case may record before upgrade.", "number"],
    ["forms.paid_downloads", "true", "forms", "Paid form downloads", "Whether downloading completed USCIS forms requires a plan with the forms.download feature (toggle on the USCIS form templates page)."],
    ["comments.customer_private_enabled", "true", "comments", "Customer private notes", "Allow customers to mark case comments as private (hidden from consultants AND admins)."],
    ["comments.consultant_hide_from_customer_enabled", "true", "comments", "Consultant hidden comments", "Allow consultants to hide case comments from the customer. Admins always see consultant comments."],
    ["comments.admin_hide_from_customer_enabled", "true", "comments", "Admin internal comments", "Allow admins to mark case comments as internal (hidden from the customer, visible to consultants)."],
    ["mail.host", "", "mail", "SMTP host", "Leave empty to disable outbound email (reset links are then shown to admins for manual delivery)."],
    ["mail.port", "587", "mail", "SMTP port", ""],
    ["mail.username", "", "mail", "SMTP username", ""],
    ["mail.password", "", "mail", "SMTP password", ""],
    ["mail.from", "", "mail", "From address", "e.g. ImmigrationOnMe <no-reply@immigrationonme.com>"],
    ["mail.secure", "false", "mail", "SMTP TLS (implicit)", "true for port 465, false for STARTTLS on 587."],
  ];
  for (const [key, value, group, label, description, type] of settings) {
    await db.setting.upsert({
      where: { key },
      update: {},
      create: { key, value, group, label, description, type: type ?? (key.includes("secret") ? "secret" : "text") },
    });
  }
  await db.setting.updateMany({
    where: {
      key: {
        in: [
          "qa.guest_question_limit",
          "qa.guest_max_sentences",
          "qa.guest_max_excerpts",
          "qa.guest_follow_ups",
          "qa.free_max_sentences",
          "qa.free_max_excerpts",
          "qa.free_follow_ups",
          "suggestions.guest_max_steps",
          "suggestions.free_max_steps",
          "suggestions.free_max_clarify",
        ],
      },
    },
    data: { type: "number" },
  });
  // Repair common TaxOnMe leftovers on existing installs without overwriting
  // administrator-customized values that are already immigration-specific.
  await db.setting.updateMany({ where: { key: "app.name", value: { in: ["TaxOnMe", "MyImmigration"] } }, data: { value: "ImmigrationOnMe" } });
  await db.$executeRaw`UPDATE "Setting" SET value = 'ImmigrationOnMe' WHERE key = 'app.name' AND lower(trim(value)) IN ('taxonme', 'myimmigration')`;
  await db.setting.updateMany({ where: { key: "app.tagline", value: { in: STALE_PUBLIC_TAGLINES } }, data: { value: PUBLIC_TAGLINE } });
  await db.setting.updateMany({ where: { key: "app.tagline", value: { contains: "tax" } }, data: { value: PUBLIC_TAGLINE } });
  await db.setting.updateMany({ where: { key: "home.hero_title", value: { in: STALE_PUBLIC_HERO_TITLES } }, data: { value: PUBLIC_HERO.title } });
  await db.setting.updateMany({ where: { key: "home.hero_title", value: { contains: "tax" } }, data: { value: PUBLIC_HERO.title } });
  await db.setting.updateMany({ where: { key: "home.hero_subtitle", value: { in: STALE_PUBLIC_HERO_SUBTITLES } }, data: { value: PUBLIC_HERO.subtitle } });
  await db.setting.updateMany({ where: { key: "home.hero_subtitle", value: { contains: "tax" } }, data: { value: PUBLIC_HERO.subtitle } });
  await db.setting.updateMany({ where: { key: "home.cta_primary", value: { in: STALE_PUBLIC_PRIMARY_CTAS } }, data: { value: PUBLIC_HERO.primaryCta.label } });
  await db.setting.deleteMany({ where: { key: "irs.account_url" } });
  await repairBrandName();
}

async function repairBrandName() {
  await db.$executeRaw`UPDATE "Setting" SET value = replace(replace(value, 'MyImmigration', 'ImmigrationOnMe'), 'TaxOnMe', 'ImmigrationOnMe') WHERE value LIKE '%MyImmigration%' OR value LIKE '%TaxOnMe%'`;
  await db.$executeRaw`UPDATE "ContentPage" SET title = replace(replace(title, 'MyImmigration', 'ImmigrationOnMe'), 'TaxOnMe', 'ImmigrationOnMe'), body = replace(replace(body, 'MyImmigration', 'ImmigrationOnMe'), 'TaxOnMe', 'ImmigrationOnMe') WHERE title LIKE '%MyImmigration%' OR title LIKE '%TaxOnMe%' OR body LIKE '%MyImmigration%' OR body LIKE '%TaxOnMe%'`;
  await db.$executeRaw`UPDATE "MessageTemplate" SET name = replace(replace(name, 'MyImmigration', 'ImmigrationOnMe'), 'TaxOnMe', 'ImmigrationOnMe'), subject = replace(replace(subject, 'MyImmigration', 'ImmigrationOnMe'), 'TaxOnMe', 'ImmigrationOnMe'), "bodyHtml" = replace(replace("bodyHtml", 'MyImmigration', 'ImmigrationOnMe'), 'TaxOnMe', 'ImmigrationOnMe') WHERE name LIKE '%MyImmigration%' OR name LIKE '%TaxOnMe%' OR subject LIKE '%MyImmigration%' OR subject LIKE '%TaxOnMe%' OR "bodyHtml" LIKE '%MyImmigration%' OR "bodyHtml" LIKE '%TaxOnMe%'`;
  await db.$executeRaw`UPDATE "PipelineStep" SET "promptTemplate" = replace(replace("promptTemplate", 'MyImmigration', 'ImmigrationOnMe'), 'TaxOnMe', 'ImmigrationOnMe') WHERE "promptTemplate" LIKE '%MyImmigration%' OR "promptTemplate" LIKE '%TaxOnMe%'`;
}

async function seedAdmin() {
  const email = process.env.SEED_ADMIN_EMAIL || "admin@immigrationonme.com";
  const password = process.env.SEED_ADMIN_PASSWORD || "ChangeMe!2026";
  await db.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      firstName: "Super",
      lastName: "Admin",
      role: "super_admin",
      passwordHash: await bcrypt.hash(password, 10),
      emailVerifiedAt: new Date(),
    },
  });
  console.log(`Super admin: ${email} / ${password}`);
}

async function seedAdminRoles() {
  // Example roles the super admin can edit, delete, or extend.
  const roles = [
    {
      name: "Operations",
      description: "Day-to-day platform operations: customers, cases, consultants.",
      areas: ["admin.dashboard", "admin.cases", "admin.users", "admin.consultants", "admin.assignments", "admin.notifications"],
    },
    {
      name: "Finance",
      description: "Billing: plans, payment gateways, and transactions.",
      areas: ["admin.dashboard", "admin.plans", "admin.payments", "admin.transactions"],
    },
    {
      name: "Content manager",
      description: "Site content, agreements, form templates, and the USCIS knowledge base.",
      areas: ["admin.dashboard", "admin.content", "admin.forms", "admin.knowledge"],
    },
    {
      name: "AI engineer",
      description: "AI providers, pipelines, and the knowledge base.",
      areas: ["admin.dashboard", "admin.ai", "admin.pipelines", "admin.knowledge", "admin.experience", "admin.cases"],
    },
  ];
  for (const r of roles) {
    await db.adminRole.upsert({
      where: { name: r.name },
      update: {},
      create: { name: r.name, description: r.description, areasJson: JSON.stringify(r.areas) },
    });
  }
}

async function seedPlansAndFeatures() {
  const features: [string, string, string, number][] = [
    ["notice.upload", "Upload & photograph USCIS notices", "notices", 1],
    ["notice.explain", "Plain-English notice explanations", "notices", 2],
    ["documents.upload", "Document vault storage", "documents", 3],
    ["documents.explain", "Immigration document explanations", "documents", 4],
    ["case.analysis", "In-depth case analysis", "analysis", 5],
    ["case.full_results", "Full analysis results & action plan", "analysis", 6],
    ["qa.chat", "Immigration Q&A assistant", "assistant", 7],
    ["letters.generate", "USCIS letter drafts", "letters", 8],
    ["deadlines.reminders", "Deadline tracking & reminders", "deadlines", 9],
    ["vault.storage", "Secure document vault", "documents", 10],
    ["forms.wizard", "Simplified USCIS form wizards", "forms", 11],
    ["consultant.referral", "immigration professional referral service", "consultants", 12],
    ["guide.chatbot", "Personal immigration guide chatbot", "assistant", 13],
    ["case.report", CASE_REPORT_FEATURE_NAME, "analysis", 14],
    ["uscis.updates_analysis", "USCIS update impact analysis", "analysis", 15],
    ["forms.download", "Downloadable completed USCIS forms", "forms", 16],
    ["qa.personalized", "Personalized Q&A follow-ups from official material", "assistant", 17],
    ["suggestions.personalized", "Personalized suggested next steps from official material", "assistant", 18],
    ["filing_plan.build", "Build a Filing Plan from a Situation", "filing", 19],
  ];
  for (const [key, name, category, sortOrder] of features) {
    await db.featureDef.upsert({
      where: { key },
      update: { sortOrder: PUBLIC_FEATURE_SORT_ORDER[key] ?? sortOrder },
      create: { key, name, category, sortOrder: PUBLIC_FEATURE_SORT_ORDER[key] ?? sortOrder },
    });
  }
  // Corrective renames for existing installs: customer-facing copy must never
  // reference AI models (standard product-language policy).
  await db.featureDef.updateMany({ where: { key: "case.analysis", name: "AI case analysis" }, data: { name: "In-depth case analysis" } });
  await db.featureDef.updateMany({ where: { key: "letters.generate" }, data: { name: "USCIS letter drafts" } });
  await db.featureDef.updateMany({ where: { key: "guide.chatbot" }, data: { name: "Personal immigration guide chatbot" } });
  await db.featureDef.updateMany({ where: { key: "case.report" }, data: { name: CASE_REPORT_FEATURE_NAME } });
  await db.pipelineStage.updateMany({
    where: { key: "guide", name: "In-account case guide" },
    data: {
      name: "In-account immigration guide",
      description: "The floating chatbot that coaches users through the next matching step — options, a letter, or a filed case. Models are tried in order until one answers — all five providers are chained by default.",
    },
  });
  await db.subscriptionPlan.updateMany({
    where: { description: { contains: "AI-matched client assignments" } },
    data: { description: "For immigration professional partners: receive expertly matched client assignments and manage them in your workspace." },
  });

  const plans = [
    {
      key: "free",
      name: "Free",
      description: PUBLIC_PLAN_DESCRIPTIONS.free,
      priceMonthlyCents: 0,
      priceYearlyCents: 0,
      sortOrder: 0,
      badge: "",
      features: {
        "notice.upload": { enabled: true, limit: 2 },
        "notice.explain": { enabled: true, limit: 2 },
        "documents.upload": { enabled: true, limit: 5 },
        "case.analysis": { enabled: true, limit: 1 },
        "case.report": { enabled: true, limit: 1 },
        "qa.chat": { enabled: true, limit: 3 },
        "qa.personalized": { enabled: false, limit: null },
        "suggestions.personalized": { enabled: false, limit: null },
        "vault.storage": { enabled: true, limit: 5 },
        "deadlines.reminders": { enabled: true, limit: null },
      },
    },
    {
      key: "plus",
      name: "Plus",
      description: PUBLIC_PLAN_DESCRIPTIONS.plus,
      priceMonthlyCents: 1900,
      priceYearlyCents: 18900,
      sortOrder: 1,
      badge: "Most popular",
      features: {
        "notice.upload": { enabled: true, limit: null },
        "notice.explain": { enabled: true, limit: null },
        "documents.upload": { enabled: true, limit: null },
        "documents.explain": { enabled: true, limit: null },
        "case.analysis": { enabled: true, limit: null },
        "case.full_results": { enabled: true, limit: null },
        "qa.chat": { enabled: true, limit: null },
        "qa.personalized": { enabled: true, limit: null },
        "suggestions.personalized": { enabled: true, limit: null },
        "letters.generate": { enabled: true, limit: 3 },
        "deadlines.reminders": { enabled: true, limit: null },
        "vault.storage": { enabled: true, limit: null },
        "filing_plan.build": { enabled: true, limit: 2 },
        "forms.wizard": { enabled: true, limit: 2 },
        "guide.chatbot": { enabled: true, limit: null },
        "case.report": { enabled: true, limit: 3 },
        "uscis.updates_analysis": { enabled: true, limit: null },
        "forms.download": { enabled: true, limit: 1 },
      },
    },
    {
      key: "pro",
      name: "Pro",
      description: PUBLIC_PLAN_DESCRIPTIONS.pro,
      priceMonthlyCents: 4900,
      priceYearlyCents: 49900,
      sortOrder: 2,
      badge: "",
      features: {
        "notice.upload": { enabled: true, limit: null },
        "notice.explain": { enabled: true, limit: null },
        "documents.upload": { enabled: true, limit: null },
        "documents.explain": { enabled: true, limit: null },
        "case.analysis": { enabled: true, limit: null },
        "case.full_results": { enabled: true, limit: null },
        "qa.chat": { enabled: true, limit: null },
        "qa.personalized": { enabled: true, limit: null },
        "suggestions.personalized": { enabled: true, limit: null },
        "letters.generate": { enabled: true, limit: null },
        "deadlines.reminders": { enabled: true, limit: null },
        "vault.storage": { enabled: true, limit: null },
        "filing_plan.build": { enabled: true, limit: null },
        "forms.wizard": { enabled: true, limit: null },
        "consultant.referral": { enabled: true, limit: null },
        "guide.chatbot": { enabled: true, limit: null },
        "case.report": { enabled: true, limit: 7 },
        "uscis.updates_analysis": { enabled: true, limit: null },
        "forms.download": { enabled: true, limit: null },
      },
    },
  ];

  // Partner plan for immigration professional/consultants (used when consultant subscriptions are enabled).
  await db.subscriptionPlan.upsert({
    where: { key: "partner" },
    update: {},
    create: {
      key: "partner",
      name: "Partner",
      audience: "consultant",
      description: "For immigration professional partners: receive expertly matched client assignments and manage them in your workspace.",
      priceMonthlyCents: 4900,
      priceYearlyCents: 49900,
      sortOrder: 10,
    },
  });

  for (const p of plans) {
    const plan = await db.subscriptionPlan.upsert({
      where: { key: p.key },
      update: {},
      create: {
        key: p.key,
        name: p.name,
        description: p.description,
        priceMonthlyCents: p.priceMonthlyCents,
        priceYearlyCents: p.priceYearlyCents,
        sortOrder: p.sortOrder,
        badge: p.badge,
      },
    });
    for (const [featureKey, cfg] of Object.entries(p.features)) {
      await db.planFeature.upsert({
        where: { planId_featureKey: { planId: plan.id, featureKey } },
        update: {},
        create: { planId: plan.id, featureKey, enabled: cfg.enabled, limitValue: cfg.limit },
      });
    }
  }
  await db.planFeature.updateMany({ where: { plan: { key: "free" }, featureKey: "case.report" }, data: { enabled: true, limitValue: 1 } });
  await db.planFeature.updateMany({ where: { plan: { key: "plus" }, featureKey: "case.report" }, data: { enabled: true, limitValue: 3 } });
  await db.planFeature.updateMany({ where: { plan: { key: "pro" }, featureKey: "case.report" }, data: { enabled: true, limitValue: 7 } });
  await db.planFeature.updateMany({ where: { plan: { key: "free" }, featureKey: "qa.chat", limitValue: 10 }, data: { limitValue: 3 } });
  await db.planFeature.updateMany({ where: { plan: { key: "plus" }, featureKey: "qa.personalized" }, data: { enabled: true } });
  await db.planFeature.updateMany({ where: { plan: { key: "pro" }, featureKey: "qa.personalized" }, data: { enabled: true } });
  await db.planFeature.updateMany({ where: { plan: { key: "plus" }, featureKey: "suggestions.personalized" }, data: { enabled: true } });
  await db.planFeature.updateMany({ where: { plan: { key: "pro" }, featureKey: "suggestions.personalized" }, data: { enabled: true } });
  for (const [key, description] of Object.entries(PUBLIC_PLAN_DESCRIPTIONS)) {
    const stale = STALE_PLAN_DESCRIPTIONS[key] ?? [];
    if (!stale.length) continue;
    await db.subscriptionPlan.updateMany({
      where: { key, description: { in: stale } },
      data: { description },
    });
  }

  // Phase Billing — Free explores only; Plus caps Filing Plan / forms; Pro unlimited.
  const billingMatrix: Array<{
    planKey: string;
    featureKey: string;
    enabled: boolean;
    limit: number | null;
  }> = [
    { planKey: "free", featureKey: "filing_plan.build", enabled: false, limit: null },
    { planKey: "free", featureKey: "forms.wizard", enabled: false, limit: null },
    { planKey: "free", featureKey: "forms.download", enabled: false, limit: null },
    { planKey: "plus", featureKey: "filing_plan.build", enabled: true, limit: 2 },
    { planKey: "plus", featureKey: "forms.wizard", enabled: true, limit: 2 },
    { planKey: "plus", featureKey: "forms.download", enabled: true, limit: 1 },
    { planKey: "pro", featureKey: "filing_plan.build", enabled: true, limit: null },
    { planKey: "pro", featureKey: "forms.wizard", enabled: true, limit: null },
    { planKey: "pro", featureKey: "forms.download", enabled: true, limit: null },
  ];
  for (const row of billingMatrix) {
    const plan = await db.subscriptionPlan.findUnique({ where: { key: row.planKey } });
    if (!plan) continue;
    await db.planFeature.upsert({
      where: { planId_featureKey: { planId: plan.id, featureKey: row.featureKey } },
      update: { enabled: row.enabled, limitValue: row.limit },
      create: {
        planId: plan.id,
        featureKey: row.featureKey,
        enabled: row.enabled,
        limitValue: row.limit,
      },
    });
  }
}

async function seedGateway() {
  const existing = await db.paymentGatewayConfig.count();
  if (existing === 0) {
    await db.paymentGatewayConfig.create({
      data: {
        name: "Manual / development",
        kind: "manual",
        mode: "test",
        isActive: true,
        isDefault: true,
        configJson: "{}",
      },
    });
    await db.paymentGatewayConfig.create({
      data: {
        name: "Stripe",
        kind: "stripe",
        mode: "test",
        isActive: false,
        isDefault: false,
        configJson: JSON.stringify({ secretKey: "", publishableKey: "", webhookSecret: "", currency: "usd", appUrl: "http://localhost:3000" }, null, 2),
      },
    });
  }
}

async function seedAiAndPipelines() {
  const providerDefs = [
    { name: "OpenAI GPT-5.6 Sol", kind: "openai_compatible", baseUrl: "https://api.openai.com/v1", model: "gpt-5.6-sol", supportsVision: true, notes: "Flagship reasoning model for complex professional work." },
    { name: "OpenAI GPT-5.6 Terra", kind: "openai_compatible", baseUrl: "https://api.openai.com/v1", model: "gpt-5.6-terra", supportsVision: false, notes: "Fast model used for presentation-layer structuring." },
    { name: "Anthropic Claude Sonnet 5", kind: "anthropic", baseUrl: "https://api.anthropic.com", model: "claude-sonnet-5", supportsVision: true, notes: "Strong document analysis with visual PDF understanding." },
    { name: "Anthropic Claude Opus 5", kind: "anthropic", baseUrl: "https://api.anthropic.com", model: "claude-opus-5", supportsVision: true, notes: "High-capability independent analysis / review." },
    { name: "Google Gemini 3.1 Pro", kind: "google", baseUrl: "https://generativelanguage.googleapis.com/v1beta", model: "gemini-3.1-pro", supportsVision: true, notes: "Long-context document reasoning, native PDF understanding." },
  ];
  const providers: Record<string, string> = {};
  for (const p of providerDefs) {
    const existing = await db.aiProvider.findFirst({ where: { name: p.name } });
    const row = existing ?? (await db.aiProvider.create({ data: { ...p, apiKey: "" } }));
    providers[p.name] = row.id;
  }

  const stages: { key: string; name: string; description: string; steps: { provider: string; role: string; prompt: string; order: number }[] }[] = [
    {
      key: "summary",
      name: "1 · Summary analysis",
      description: "PRIMARY_REASONING (Sol): understands the person's narrative. Single specialized brain — not multi-model competition.",
      steps: [
        { provider: "OpenAI GPT-5.6 Sol", role: "interpreter", prompt: DEFAULT_PROMPTS.interpreter, order: 0 },
      ],
    },
    {
      key: "goal",
      name: "2 · Goal analysis",
      description: "PRIMARY_REASONING (Sol): interprets what the person wants to achieve.",
      steps: [
        { provider: "OpenAI GPT-5.6 Sol", role: "interpreter", prompt: DEFAULT_PROMPTS.interpreter, order: 0 },
      ],
    },
    {
      key: "document",
      name: "3 · Document analysis",
      description: "DOCUMENT_INTELLIGENCE (Opus): structured findings + provenance + confidence into the evidence ledger. Does not decide case strategy.",
      steps: [
        { provider: "Anthropic Claude Opus 5", role: "document_intelligence", prompt: DEFAULT_PROMPTS.document_intelligence, order: 0 },
      ],
    },
    {
      key: "situation",
      name: "4 · Immigration situation analysis",
      description: "PRIMARY_REASONING (Sol): case/options reasoning from user statements + ledger evidence + authorities.",
      steps: [
        { provider: "OpenAI GPT-5.6 Sol", role: "analyst", prompt: DEFAULT_PROMPTS.analyst, order: 0 },
      ],
    },
    {
      key: "presenter",
      name: "5 · Results presentation",
      description: "PRESENTATION (Sol): formats locked analysis for the UI — does not redo case reasoning.",
      steps: [
        { provider: "OpenAI GPT-5.6 Sol", role: "presenter", prompt: DEFAULT_PROMPTS.presenter, order: 0 },
      ],
    },
    {
      key: "qa",
      name: "AI immigration Q&A",
      description: "PRIMARY_REASONING (Sol): conversational Q&A and clarifications. Single brain — no competing assistants.",
      steps: [
        { provider: "OpenAI GPT-5.6 Sol", role: "assistant", prompt: DEFAULT_PROMPTS.assistant, order: 0 },
      ],
    },
    {
      key: "notice",
      name: "USCIS notice explanation",
      description: "Opus extracts structured document findings; Sol writes the customer-facing explanation from those findings.",
      steps: [
        { provider: "Anthropic Claude Opus 5", role: "document_intelligence", prompt: DEFAULT_PROMPTS.document_intelligence, order: 0 },
        { provider: "OpenAI GPT-5.6 Sol", role: "presenter", prompt: DEFAULT_PROMPTS.notice_customer_explain, order: 1 },
      ],
    },
    {
      key: "letter",
      name: "Response letter drafting",
      description: "PRIMARY_REASONING (Sol): drafts a professional USCIS response letter the user reviews and edits.",
      steps: [
        { provider: "OpenAI GPT-5.6 Sol", role: "assistant", prompt: DEFAULT_PROMPTS.letter_writer, order: 0 },
      ],
    },
    {
      key: "guide",
      name: "In-account immigration guide",
      description: "PRIMARY_REASONING (Sol): coaches the next matching step. Single brain.",
      steps: [
        { provider: "OpenAI GPT-5.6 Sol", role: "assistant", prompt: DEFAULT_PROMPTS.guide, order: 0 },
      ],
    },
    {
      key: "match",
      name: "Consultant matching",
      description: "PRIMARY_REASONING (Sol): ranks candidate consultants for a case.",
      steps: [
        { provider: "OpenAI GPT-5.6 Sol", role: "analyst", prompt: DEFAULT_PROMPTS.match_rank, order: 0 },
      ],
    },
    {
      key: "match_reason",
      name: "Assignment recommendation reason",
      description: "PRIMARY_REASONING (Sol): recommendation shown to both parties.",
      steps: [
        { provider: "OpenAI GPT-5.6 Sol", role: "analyst", prompt: DEFAULT_PROMPTS.match_reason, order: 0 },
      ],
    },
    {
      key: "closing",
      name: "Closing remarks & final review",
      description: "PRESENTATION (Sol): customer closing summary when a case completes.",
      steps: [
        { provider: "OpenAI GPT-5.6 Sol", role: "presenter", prompt: DEFAULT_PROMPTS.closing, order: 0 },
      ],
    },
  ];

  for (const s of stages) {
    const stage = await db.pipelineStage.upsert({
      where: { key: s.key },
      update: { name: s.name, description: s.description },
      create: { key: s.key, name: s.name, description: s.description },
    });
    // Model Responsibility Contract: only the designated specialized steps stay enabled.
    const allowedKeys = new Set(s.steps.map((step) => `${providers[step.provider]}::${step.role}`));
    const existing = await db.pipelineStep.findMany({ where: { stageKey: stage.key } });
    for (const row of existing) {
      const key = `${row.providerId}::${row.role}`;
      if (!allowedKeys.has(key)) {
        await db.pipelineStep.update({ where: { id: row.id }, data: { isEnabled: false } });
      }
    }
    for (const step of s.steps) {
      const providerId = providers[step.provider];
      if (!providerId) continue;
      const existingStep = await db.pipelineStep.findFirst({
        where: { stageKey: stage.key, providerId, role: step.role },
      });
      if (!existingStep) {
        await db.pipelineStep.create({
          data: {
            stageKey: stage.key,
            providerId,
            role: step.role,
            promptTemplate: step.prompt,
            sortOrder: step.order,
            isEnabled: true,
          },
        });
      } else {
        await db.pipelineStep.update({
          where: { id: existingStep.id },
          data: {
            promptTemplate: step.prompt,
            sortOrder: step.order,
            isEnabled: true,
          },
        });
      }
    }
  }

  // Capability aliases — architecture stays fixed when provider versions change.
  const capabilitySettings: Record<string, string> = {
    "ai.capability.primary_reasoning": "OpenAI GPT-5.6 Sol",
    "ai.capability.document_intelligence": "Anthropic Claude Opus 5",
    "ai.capability.presentation": "OpenAI GPT-5.6 Sol",
  };
  for (const [key, value] of Object.entries(capabilitySettings)) {
    await db.setting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }

  const promptRepairs: { stageKey: string; role: string; promptKey: string; prompt: string }[] = [
    { stageKey: "summary", role: "interpreter", promptKey: "interpreter", prompt: DEFAULT_PROMPTS.interpreter },
    { stageKey: "goal", role: "interpreter", promptKey: "interpreter", prompt: DEFAULT_PROMPTS.interpreter },
    { stageKey: "document", role: "document_intelligence", promptKey: "document_intelligence", prompt: DEFAULT_PROMPTS.document_intelligence },
    { stageKey: "situation", role: "analyst", promptKey: "analyst", prompt: DEFAULT_PROMPTS.analyst },
    { stageKey: "presenter", role: "presenter", promptKey: "presenter", prompt: DEFAULT_PROMPTS.presenter },
    { stageKey: "qa", role: "assistant", promptKey: "assistant", prompt: DEFAULT_PROMPTS.assistant },
    { stageKey: "notice", role: "document_intelligence", promptKey: "document_intelligence", prompt: DEFAULT_PROMPTS.document_intelligence },
    { stageKey: "notice", role: "presenter", promptKey: "notice_customer_explain", prompt: DEFAULT_PROMPTS.notice_customer_explain },
    { stageKey: "letter", role: "assistant", promptKey: "letter_writer", prompt: DEFAULT_PROMPTS.letter_writer },
    { stageKey: "guide", role: "assistant", promptKey: "guide", prompt: DEFAULT_PROMPTS.guide },
    { stageKey: "match", role: "analyst", promptKey: "match_rank", prompt: DEFAULT_PROMPTS.match_rank },
    { stageKey: "match_reason", role: "analyst", promptKey: "match_reason", prompt: DEFAULT_PROMPTS.match_reason },
    { stageKey: "closing", role: "presenter", promptKey: "closing", prompt: DEFAULT_PROMPTS.closing },
  ];
  for (const repair of promptRepairs) {
    const stepsToCheck = await db.pipelineStep.findMany({
      where: { stageKey: repair.stageKey, role: repair.role },
      select: { id: true, promptTemplate: true },
    });
    for (const step of stepsToCheck) {
      const superseded = (PROMPT_SUPERSEDES[repair.promptKey] ?? []).includes(promptHash(step.promptTemplate));
      if (superseded || hasLegacyTaxonmePromptMarker(step.promptTemplate) || step.promptTemplate !== repair.prompt) {
        await db.pipelineStep.update({ where: { id: step.id }, data: { promptTemplate: repair.prompt } });
      }
    }
  }
}

async function seedContent() {
  const pages = [
    {
      slug: "faq",
      title: "Frequently asked questions",
      kind: "page",
      body: PUBLIC_FAQ_BODY,
    },
    {
      slug: "how-it-works",
      title: "How it works",
      kind: "page",
      body: PUBLIC_HOW_IT_WORKS_PAGE,
    },
    ...LEGAL_CONTENT_PAGES,
    {
      slug: "consultant-agreement",
      title: "Consultant Partner Agreement",
      kind: "agreement_consultant",
      body: `By registering as an Immigration Consultant partner you agree:

1. The credentials you provide are accurate and current, and you will keep them updated.
2. You will handle client materials confidentially and only for the engaged purpose.
3. Client connections require the client's explicit consent before any material is shared.
4. ImmigrationOnMe may verify your credentials and approve or suspend partner accounts at its discretion.`,
    },
    {
      slug: "connection-agreement",
      title: "Client–Consultant Connection Agreement",
      kind: "agreement_connection",
      body: `This agreement governs the connection between an ImmigrationOnMe user and a consultant.

1. Both parties must accept before any sensitive material is shared.
2. The consultant may view the client's cases and shared documents solely to assist with the client's immigration situation.
3. Either party or an ImmigrationOnMe administrator may revoke the connection at any time, ending access immediately.
4. Confidentiality obligations survive the end of the connection.`,
    },
  ];
  for (const p of pages) {
    await db.contentPage.upsert({
      where: { slug: p.slug },
      update: {},
      create: { ...p, isPublished: true },
    });
  }
  for (const page of LEGAL_CONTENT_PAGES) {
    const existing = await db.contentPage.findUnique({ where: { slug: page.slug } });
    if (!existing) {
      await db.contentPage.create({ data: { ...page, isPublished: true, version: 1 } });
    } else if (existing.body !== page.body || existing.title !== page.title || existing.kind !== page.kind) {
      await db.contentPage.update({
        where: { slug: page.slug },
        data: {
          title: page.title,
          body: page.body,
          kind: page.kind,
          isPublished: true,
          version: { increment: 1 },
        },
      });
    } else if (!existing.isPublished) {
      await db.contentPage.update({ where: { slug: page.slug }, data: { isPublished: true } });
    }
  }
  const faq = await db.contentPage.findUnique({ where: { slug: "faq" } });
  if (faq && /How do I check my USCIS case\?/.test(faq.body) && !/Do I need a USCIS receipt to start\?/.test(faq.body)) {
    await db.contentPage.update({
      where: { slug: "faq" },
      data: { body: PUBLIC_FAQ_BODY, version: { increment: 1 } },
    });
  }
  const howItWorks = await db.contentPage.findUnique({ where: { slug: "how-it-works" } });
  if (howItWorks && /Add documents — USCIS notices, receipts/.test(howItWorks.body)) {
    await db.contentPage.update({
      where: { slug: "how-it-works" },
      data: { body: PUBLIC_HOW_IT_WORKS_PAGE, version: { increment: 1 } },
    });
  }
}

async function seedKnowledge() {
  const sources = [
    {
      title: "USCIS receipt notices",
      sourceType: "notice_guide",
      reference: "I-797C",
      url: "https://www.uscis.gov/forms/filing-guidance/form-i-797-types-and-functions",
      tags: "receipt, i-797, case status, priority date",
      content: "A USCIS receipt notice confirms that USCIS accepted a filing for processing. It usually includes a receipt number, received date, notice date, form type, applicant or petitioner information, and the service center or field office. The receipt number can be used to check case status. A receipt notice is not an approval, but it is important evidence that a filing was received and may preserve a priority date or filing deadline.",
    },
    {
      title: "Requests for Evidence (RFE)",
      sourceType: "notice_guide",
      reference: "RFE",
      url: "https://www.uscis.gov/forms/filing-guidance/requests-for-evidence-and-notices-of-intent-to-deny",
      tags: "rfe, evidence, deadline, response",
      content: "A Request for Evidence means USCIS needs additional documents or clarification before deciding a case. The notice identifies the missing evidence, the response deadline, where to send the response, and whether copies or originals are required. A complete response should address every listed item, include a cover letter or index, and be sent before the deadline. Missing the deadline can result in denial.",
    },
    {
      title: "Notice of Intent to Deny (NOID)",
      sourceType: "notice_guide",
      reference: "NOID",
      url: "https://www.uscis.gov/forms/filing-guidance/requests-for-evidence-and-notices-of-intent-to-deny",
      tags: "noid, denial, rebuttal, deadline",
      content: "A Notice of Intent to Deny means USCIS believes the application may not be approvable unless the applicant overcomes specific concerns. A NOID is more serious than an RFE. The response should directly address each stated reason, provide supporting evidence, and explain why the case is eligible under the relevant standard. Professional review is strongly recommended.",
    },
    {
      title: "Adjustment of status overview",
      sourceType: "form_instruction",
      reference: "Form I-485",
      url: "https://www.uscis.gov/i-485",
      tags: "i-485, adjustment, green card, eligibility",
      content: "Form I-485 is used by eligible applicants in the United States to apply for lawful permanent residence. A case review should check the immigrant category, lawful entry or eligibility exception, priority date if applicable, required medical exam, affidavit of support where required, and any admissibility issues. Supporting documents vary by category and facts.",
    },
    {
      title: "Family petition overview",
      sourceType: "form_instruction",
      reference: "Form I-130",
      url: "https://www.uscis.gov/i-130",
      tags: "i-130, family, petitioner, beneficiary, relationship evidence",
      content: "Form I-130 is used by a U.S. citizen or lawful permanent resident petitioner to establish a qualifying family relationship with a beneficiary. Evidence usually includes identity documents, proof of status, relationship documents, and bona fide marriage evidence when based on marriage. Approval of I-130 alone does not grant status.",
    },
    {
      title: "Naturalization overview",
      sourceType: "form_instruction",
      reference: "Form N-400",
      url: "https://www.uscis.gov/n-400",
      tags: "n-400, naturalization, citizenship, continuous residence",
      content: "Form N-400 is used to apply for naturalization. A review should consider lawful permanent resident period, continuous residence, physical presence, good moral character, selective service if applicable, support obligations, trips outside the United States, and interview/civics requirements. Complex issues should be reviewed by a qualified professional.",
    },
    {
      title: "Optional Practical Training for F-1 students",
      sourceType: "form_instruction",
      reference: "F-1 OPT",
      url: "https://www.uscis.gov/working-in-the-united-states/students-and-exchange-visitors/optional-practical-training-opt-for-f-1-students",
      tags: "student, f-1, opt, graduation, i-20, work, i-765",
      content: "F-1 students may apply for Optional Practical Training (OPT) to work in a field related to their major after or during studies. Evidence usually includes a valid Form I-20 with an OPT recommendation, passport identity page, Form I-94, and transcripts or enrollment records. OPT is requested on Form I-765. Timing, unemployment limits, and STEM extensions depend on the student's facts. A receipt notice is not required to explain these options, and OPT is not an automatic grant of status after graduation.",
    },
    {
      title: "Employment authorization overview",
      sourceType: "form_instruction",
      reference: "Form I-765",
      url: "https://www.uscis.gov/i-765",
      tags: "i-765, ead, employment, student, opt, work",
      content: "Form I-765 is used to apply for an Employment Authorization Document. Eligibility categories include F-1 OPT, pending adjustment of status, asylum-related categories, and others listed on the form instructions. Evidence usually includes identity documents, proof of the qualifying status or pending application, prior EADs if any, and category-specific records such as an I-20 for OPT. Filing the form does not by itself authorize employment until USCIS approves the category.",
    },
    {
      title: "Asylum and withholding overview",
      sourceType: "form_instruction",
      reference: "Form I-589",
      url: "https://www.uscis.gov/i-589",
      tags: "asylum, i-589, refugee, persecution, humanitarian",
      content: "Form I-589 is used to apply for asylum and for withholding of removal. Evidence usually includes a personal declaration, country-conditions material, identity documents, and any prior immigration records. Deadlines, bars, and credibility are fact-specific under INA and 8 CFR standards. These claims are high-stakes and should be reviewed by a licensed immigration attorney or accredited representative.",
    },
    {
      title: "Immigration court and removal proceedings",
      sourceType: "rule",
      reference: "EOIR",
      url: "https://www.justice.gov/eoir/find-immigration-court-and-access-eoir-information",
      tags: "eoir, immigration court, removal, nta, doj",
      content: "The Executive Office for Immigration Review (EOIR) in the Department of Justice conducts removal proceedings in immigration court. Cases usually include a Notice to Appear, hearing notices, and any applications filed with the court. Court deadlines, relief forms, and appeals are separate from USCIS benefit filings. A person in removal proceedings should get licensed professional help before filing or missing a hearing.",
    },
  ];

  for (const source of sources) {
    const exists = await db.knowledgeSource.findFirst({ where: { title: source.title } });
    if (!exists) await db.knowledgeSource.create({ data: source });
  }
}

async function seedAuthoritySources() {
  const sources = [
    {
      key: "uscis_policy_manual",
      sourceType: "policy_manual",
      publisher: "USCIS",
      title: "USCIS Policy Manual",
      url: "https://www.uscis.gov/policy-manual",
      authorityRank: "high",
      jurisdictionOrScope: "USCIS adjudicative policy and guidance",
    },
    {
      key: "uscis_forms",
      sourceType: "form_instruction",
      publisher: "USCIS",
      title: "USCIS Forms and Instructions",
      url: "https://www.uscis.gov/forms/all-forms",
      authorityRank: "high",
      jurisdictionOrScope: "Current USCIS form editions and filing instructions",
    },
    {
      key: "uscis_alerts",
      sourceType: "alert",
      publisher: "USCIS",
      title: "USCIS Alerts",
      url: "https://www.uscis.gov/newsroom/alerts",
      authorityRank: "high",
      jurisdictionOrScope: "Current USCIS alerts and operational updates",
    },
    {
      key: "ecfr_title_8",
      sourceType: "regulation",
      publisher: "eCFR",
      title: "8 CFR Aliens and Nationality",
      url: "https://www.ecfr.gov/current/title-8",
      authorityRank: "highest",
      jurisdictionOrScope: "Federal immigration regulations",
    },
    {
      key: "ina",
      sourceType: "statute",
      publisher: "USCIS",
      title: "Immigration and Nationality Act",
      url: "https://www.uscis.gov/laws-and-policy/legislation/immigration-and-nationality-act",
      authorityRank: "highest",
      jurisdictionOrScope: "Primary immigration statute",
    },
    {
      key: "eoir_immigration_courts",
      sourceType: "agency_manual",
      publisher: "EOIR",
      title: "EOIR Immigration Court information",
      url: "https://www.justice.gov/eoir/find-immigration-court-and-access-eoir-information",
      authorityRank: "high",
      jurisdictionOrScope: "DOJ immigration court locations, case information, and practice resources",
    },
    {
      key: "uscis_opt_f1",
      sourceType: "form_instruction",
      publisher: "USCIS",
      title: "Optional Practical Training (OPT) for F-1 Students",
      url: "https://www.uscis.gov/working-in-the-united-states/students-and-exchange-visitors/optional-practical-training-opt-for-f-1-students",
      authorityRank: "high",
      jurisdictionOrScope: "F-1 Optional Practical Training eligibility and filing",
    },
    {
      key: "uscis_i130",
      sourceType: "form_instruction",
      publisher: "USCIS",
      title: "Form I-130, Petition for Alien Relative",
      url: "https://www.uscis.gov/i-130",
      authorityRank: "high",
      jurisdictionOrScope: "Family-based immigrant petition by a U.S. citizen or LPR",
    },
    {
      key: "uscis_i485",
      sourceType: "form_instruction",
      publisher: "USCIS",
      title: "Form I-485, Application to Register Permanent Residence or Adjust Status",
      url: "https://www.uscis.gov/i-485",
      authorityRank: "high",
      jurisdictionOrScope: "Adjustment of status to lawful permanent resident",
    },
    {
      key: "uscis_i765",
      sourceType: "form_instruction",
      publisher: "USCIS",
      title: "Form I-765, Application for Employment Authorization",
      url: "https://www.uscis.gov/i-765",
      authorityRank: "high",
      jurisdictionOrScope: "Employment authorization, including F-1 OPT and pending adjustment",
    },
    {
      key: "uscis_n400",
      sourceType: "form_instruction",
      publisher: "USCIS",
      title: "Form N-400, Application for Naturalization",
      url: "https://www.uscis.gov/n-400",
      authorityRank: "high",
      jurisdictionOrScope: "Naturalization eligibility and filing",
    },
    {
      key: "uscis_i589",
      sourceType: "form_instruction",
      publisher: "USCIS",
      title: "Form I-589, Application for Asylum and for Withholding of Removal",
      url: "https://www.uscis.gov/i-589",
      authorityRank: "high",
      jurisdictionOrScope: "Affirmative asylum and withholding of removal",
    },
    {
      key: "uscis_i797",
      sourceType: "notice_guide",
      publisher: "USCIS",
      title: "Form I-797 types and functions",
      url: "https://www.uscis.gov/forms/filing-guidance/form-i-797-types-and-functions",
      authorityRank: "high",
      jurisdictionOrScope: "USCIS receipt, approval, and other I-797 notices",
    },
    {
      key: "uscis_rfe_noid",
      sourceType: "notice_guide",
      publisher: "USCIS",
      title: "Requests for Evidence and Notices of Intent to Deny",
      url: "https://www.uscis.gov/forms/filing-guidance/requests-for-evidence-and-notices-of-intent-to-deny",
      authorityRank: "high",
      jurisdictionOrScope: "RFE and NOID response standards and deadlines",
    },
  ];
  for (const source of sources) {
    await db.authoritySource.upsert({
      where: { key: source.key },
      update: { ...source, isActive: true },
      create: source,
    });
  }
}

async function seedDemoConsultant() {
  const email = "consultant@immigrationonme.com";
  const password = process.env.SEED_CONSULTANT_PASSWORD || "ChangeMe!2026";
  const user = await db.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      firstName: "Alex",
      lastName: "Rivera",
      role: "consultant",
      status: "active",
      passwordHash: await bcrypt.hash(password, 10),
      emailVerifiedAt: new Date(),
      bio: "Licensed immigration attorney focusing on family petitions, adjustment of status, and RFE responses.",
    },
  });
  await db.consultantProfile.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      credentialType: "attorney",
      credentialNumber: "CA-IMM-1001",
      licenseState: "CA",
      specialties: JSON.stringify(["family", "rfe", "notices", "employment"]),
      yearsExperience: 8,
      status: "approved",
      attestedCompliance: true,
      languages: "English, Spanish",
      statesServed: "CA, NY, TX",
      experiences: "Family petitions\nAdjustment of status\nRFE responses",
      approvedAt: new Date(),
    },
  });
}

async function seedFormTemplates() {
  const templates = [
    {
      formNumber: "I-130",
      title: "Petition for Alien Relative",
      description: "Prepare a family-based petition checklist and draft answers for review before filing with USCIS.",
      category: "family",
      sortOrder: 1,
      requiredFeature: "forms.wizard",
      pdfSourceUrl: "https://www.uscis.gov/sites/default/files/document/forms/i-130.pdf",
      steps: [
        { title: "Petitioner", questions: [
          { key: "petitioner_name", label: "Petitioner's full legal name", type: "text", required: true },
          { key: "petitioner_status", label: "Petitioner's immigration status", type: "select", required: true, options: ["U.S. citizen", "Lawful permanent resident"] },
        ]},
        { title: "Beneficiary", questions: [
          { key: "beneficiary_name", label: "Beneficiary's full legal name", type: "text", required: true },
          { key: "relationship", label: "Relationship to petitioner", type: "select", required: true, options: ["Spouse", "Parent", "Child", "Sibling"] },
        ]},
        { title: "Evidence", questions: [
          { key: "relationship_evidence", label: "What relationship evidence do you have?", type: "textarea", required: true },
        ]},
      ],
      outputTemplate: `FORM I-130 PREPARATION SUMMARY\n\nPetitioner: {{petitioner_name}}\nPetitioner status: {{petitioner_status}}\nBeneficiary: {{beneficiary_name}}\nRelationship: {{relationship}}\nEvidence notes: {{relationship_evidence}}\n\nReview all answers against official USCIS instructions before filing.`,
    },
    {
      formNumber: "I-485",
      title: "Application to Register Permanent Residence or Adjust Status",
      description: "Collect core adjustment-of-status facts and evidence gaps for professional review.",
      category: "green_card",
      sortOrder: 2,
      requiredFeature: "forms.wizard",
      pdfSourceUrl: "https://www.uscis.gov/sites/default/files/document/forms/i-485.pdf",
      steps: [
        { title: "Applicant", questions: [
          { key: "applicant_name", label: "Applicant's full legal name", type: "text", required: true },
          { key: "current_status", label: "Current immigration status", type: "text", required: true },
        ]},
        { title: "Eligibility", questions: [
          { key: "basis", label: "Adjustment basis", type: "select", required: true, options: ["Family-based", "Employment-based", "Asylum/refugee", "Other"] },
          { key: "last_entry", label: "Last entry date and manner of entry", type: "text", required: true },
        ]},
        { title: "Concerns", questions: [
          { key: "concerns", label: "Any arrests, overstays, prior denials, or removal history?", type: "textarea" },
        ]},
      ],
      outputTemplate: `FORM I-485 PREPARATION SUMMARY\n\nApplicant: {{applicant_name}}\nCurrent status: {{current_status}}\nBasis: {{basis}}\nLast entry: {{last_entry}}\nPotential concerns: {{concerns}}\n\nThis summary is informational and should be reviewed before filing.`,
    },
    {
      formNumber: "I-765",
      title: "Application for Employment Authorization",
      description: "Prepare work permit eligibility and category notes.",
      category: "work_authorization",
      sortOrder: 3,
      requiredFeature: "forms.wizard",
      pdfSourceUrl: "https://www.uscis.gov/sites/default/files/document/forms/i-765.pdf",
      steps: [
        { title: "Applicant", questions: [
          { key: "name", label: "Applicant's full legal name", type: "text", required: true },
          { key: "eligibility_category", label: "Eligibility category", type: "text", required: true, placeholder: "e.g. (c)(9), (c)(8), (a)(5)" },
        ]},
        { title: "Prior EAD", questions: [
          { key: "prior_ead", label: "Have you previously received an EAD?", type: "boolean" },
          { key: "receipt", label: "Related receipt number, if any", type: "text" },
        ]},
      ],
      outputTemplate: `FORM I-765 PREPARATION SUMMARY\n\nApplicant: {{name}}\nEligibility category: {{eligibility_category}}\nPrior EAD: {{prior_ead}}\nRelated receipt: {{receipt}}`,
    },
    {
      formNumber: "I-864",
      title: "Affidavit of Support",
      description: "Collect sponsor and household-size facts for affidavit-of-support review.",
      category: "support",
      sortOrder: 4,
      requiredFeature: "forms.wizard",
      pdfSourceUrl: "https://www.uscis.gov/sites/default/files/document/forms/i-864.pdf",
      steps: [
        { title: "Sponsor", questions: [
          { key: "sponsor_name", label: "Sponsor's full legal name", type: "text", required: true },
          { key: "household_size", label: "Household size", type: "number", required: true },
          { key: "income", label: "Current annual income", type: "money", required: true },
        ]},
        { title: "Documents", questions: [
          { key: "documents", label: "Which income documents are available?", type: "textarea", required: true },
        ]},
      ],
      outputTemplate: `FORM I-864 PREPARATION SUMMARY\n\nSponsor: {{sponsor_name}}\nHousehold size: {{household_size}}\nAnnual income: {{income}}\nAvailable documents: {{documents}}`,
    },
    {
      formNumber: "N-400",
      title: "Application for Naturalization",
      description: "Prepare naturalization eligibility facts and issue checklist.",
      category: "citizenship",
      sortOrder: 5,
      requiredFeature: "forms.wizard",
      pdfSourceUrl: "https://www.uscis.gov/sites/default/files/document/forms/n-400.pdf",
      steps: [
        { title: "Eligibility", questions: [
          { key: "lpr_since", label: "Date you became a permanent resident", type: "date", required: true },
          { key: "basis", label: "Naturalization basis", type: "select", required: true, options: ["5-year permanent resident", "3-year marriage to U.S. citizen", "Military", "Other"] },
        ]},
        { title: "Travel and history", questions: [
          { key: "long_trips", label: "Any trips outside the U.S. longer than 6 months?", type: "textarea" },
          { key: "issues", label: "Any arrests, citations, child-support obligations, prior denials, or other issues to review?", type: "textarea" },
        ]},
      ],
      outputTemplate: `FORM N-400 PREPARATION SUMMARY\n\nPermanent resident since: {{lpr_since}}\nBasis: {{basis}}\nLong trips: {{long_trips}}\nIssues to review: {{issues}}`,
    },
    {
      formNumber: "I-589",
      title: "Application for Asylum and Withholding of Removal",
      description: "Organize asylum claim facts, deadline concerns, and supporting evidence.",
      category: "humanitarian",
      sortOrder: 6,
      requiredFeature: "forms.wizard",
      pdfSourceUrl: "https://www.uscis.gov/sites/default/files/document/forms/i-589.pdf",
      steps: [
        { title: "Claim basis", questions: [
          { key: "country", label: "Country of feared persecution", type: "text", required: true },
          { key: "protected_ground", label: "Protected ground", type: "select", required: true, options: ["Race", "Religion", "Nationality", "Political opinion", "Particular social group"] },
        ]},
        { title: "Timeline", questions: [
          { key: "entry_date", label: "Most recent U.S. entry date", type: "date", required: true },
          { key: "story", label: "Briefly describe what happened and what you fear", type: "textarea", required: true },
        ]},
      ],
      outputTemplate: `FORM I-589 PREPARATION SUMMARY\n\nCountry: {{country}}\nProtected ground: {{protected_ground}}\nEntry date: {{entry_date}}\nClaim summary: {{story}}`,
    },
  ];

  for (const template of templates) {
    const { steps, ...data } = template;
    const existing = await db.uscisFormTemplate.findFirst({
      where: { formNumber: data.formNumber },
      select: { id: true },
    });
    if (existing) {
      await db.uscisFormTemplate.update({
        where: { id: existing.id },
        data: {
          ...data,
          stepsJson: JSON.stringify(steps),
          isPublished: true,
        },
      });
    } else {
      await db.uscisFormTemplate.create({
        data: {
        ...data,
        stepsJson: JSON.stringify(steps),
        isPublished: true,
      },
      });
    }
  }
}

async function seedCannedResponses() {
  const responses = [
    {
      title: SUPPORT_PLAYBOOK_MATCHING.title,
      category: SUPPORT_PLAYBOOK_MATCHING.category,
      body: SUPPORT_PLAYBOOK_MATCHING.body,
    },
    {
      title: "Recommend professional review",
      category: "customer_service",
      body: "Because this situation may involve a high-stakes deadline or eligibility question, we recommend reviewing the documents with a licensed immigration attorney or accredited representative before acting.",
    },
    {
      title: "Troubleshooting upload",
      category: "tech_support",
      body: "If the upload failed, try a PDF, JPG, or PNG under the size limit. If it still fails, reply with the file type and approximate size so we can investigate.",
    },
  ];

  await db.cannedResponse.updateMany({
    where: { title: SUPPORT_PLAYBOOK_MATCHING.staleTitle },
    data: { title: SUPPORT_PLAYBOOK_MATCHING.title, body: SUPPORT_PLAYBOOK_MATCHING.body },
  });
  await db.cannedResponse.updateMany({
    where: { title: SUPPORT_PLAYBOOK_MATCHING.title },
    data: { body: SUPPORT_PLAYBOOK_MATCHING.body },
  });

  for (const response of responses) {
    const existing = await db.cannedResponse.findFirst({ where: { title: response.title } });
    if (!existing) await db.cannedResponse.create({ data: response });
    else if (response.title === "Recommend professional review") {
      await db.cannedResponse.update({ where: { id: existing.id }, data: { body: response.body } });
    }
  }
}

async function seedMessageTemplates() {
  const templates = [
    {
      key: ACCOUNT_CREATED_EMAIL.key,
      name: ACCOUNT_CREATED_EMAIL.name,
      subject: ACCOUNT_CREATED_EMAIL.subject,
      bodyHtml: ACCOUNT_CREATED_EMAIL.bodyHtml,
      kind: "event",
    },
    {
      key: "password_reset",
      name: "Password reset",
      subject: "Reset your ImmigrationOnMe password",
      bodyHtml: "<p>Use this link to reset your password: {{link}}</p><p>This link expires soon. If you did not request it, you can ignore this message.</p>",
      kind: "event",
    },
    {
      key: "case_needs_review",
      name: "Case needs review",
      subject: "Your immigration situation may need review",
      bodyHtml: "<p>Your immigration situation includes an item that may benefit from professional review. Sign in to review the next matching steps.</p>",
      kind: "event",
    },
  ];

  for (const template of templates) {
    await db.messageTemplate.upsert({
      where: { key: template.key },
      update: {},
      create: template,
    });
  }
  await db.messageTemplate.updateMany({
    where: { key: ACCOUNT_CREATED_EMAIL.key },
    data: {
      subject: ACCOUNT_CREATED_EMAIL.subject,
      bodyHtml: ACCOUNT_CREATED_EMAIL.bodyHtml,
    },
  });
  await db.messageTemplate.updateMany({
    where: { key: "case_needs_review" },
    data: {
      subject: "Your immigration situation may need review",
      bodyHtml: "<p>Your immigration situation includes an item that may benefit from professional review. Sign in to review the next matching steps.</p>",
    },
  });
}

async function main() {
  await seedSettings();
  await seedAdmin();
  await seedAdminRoles();
  await seedPlansAndFeatures();
  await seedGateway();
  await seedAiAndPipelines();
  await seedContent();
  await seedKnowledge();
  await seedAuthoritySources();
  await seedFormTemplates();
  await seedCannedResponses();
  await seedMessageTemplates();
  await seedDemoConsultant();
  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
