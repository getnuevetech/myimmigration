import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEFAULT_PROMPTS } from "../src/lib/ai/prompts";

const db = new PrismaClient();

async function seedSettings() {
  const settings: [string, string, string, string, string][] = [
    // key, value, group, label, description
    ["app.name", "MyImmigration", "branding", "App name", "Shown in the header, titles, and emails."],
    ["app.tagline", "Your friendly immigration case assistant", "branding", "Tagline", "Short slogan shown on the landing page."],
    ["app.url", "http://localhost:3000", "general", "App URL", "Public base URL, used for OAuth callbacks and payment redirects."],
    ["app.disclaimer", "MyImmigration is an immigration case assistant that helps you understand your immigration situation and USCIS documents in plain English. We are not USCIS and we are not a law firm. We provide informational guidance only, not legal advice. For high-stakes decisions, consult a licensed immigration attorney or accredited representative.", "branding", "Footer disclaimer", "Compliance disclaimer shown in the site footer."],
    ["home.hero_title", "USCIS letters and immigration cases, explained like you're human", "branding", "Homepage hero title", ""],
    ["home.hero_subtitle", "MyImmigration turns confusing USCIS notices, immigration documents, and case questions into a simple step-by-step plan. Start free — no account needed.", "branding", "Homepage hero subtitle", ""],
    ["home.cta_primary", "Explain my immigration situation", "branding", "Primary call to action", ""],
    ["home.cta_secondary", "Ask a quick question", "branding", "Secondary call to action", ""],
    ["home.hero_images", '["/hero/hero-1.png", "/hero/hero-2.png", "/hero/hero-3.png"]', "branding", "Hero images (JSON array)", "Rotating homepage hero images. JSON array of image URLs or paths — add, remove, or reorder freely."],
    ["auth.google_client_id", "", "auth", "Google OAuth client ID", "Leave empty to hide the Google sign-in button."],
    ["auth.google_client_secret", "", "auth", "Google OAuth client secret", ""],
    ["billing.free_plan_key", "free", "billing", "Free plan key", "Plan applied to users without a paid subscription."],
    ["irs.account_url", "https://my.uscis.gov/", "uscis", "USCIS online account URL", "Official page users are guided to for USCIS account access."],
    ["analysis.expected_documents", "3", "analysis", "Expected documents per case", "Used by the deterministic case-readiness formula."],
    ["consultants.auto_approve_enabled", "false", "consultants", "Auto-approve consultants", "Automatically approve immigration professional applications meeting requirements."],
    ["consultants.auto_approve_min_years", "3", "consultants", "Auto-approve minimum years", "Minimum years of experience for automated approval."],
    ["consultants.auto_criteria", '["credential","ptin","proof","min_years","attestation"]', "consultants", "Auto-approval required criteria", "JSON array of criteria keys required for automated approval (managed on the immigration professional auto-approval page)."],
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
    ["forms.paid_downloads", "true", "forms", "Paid form downloads", "Whether downloading completed USCIS forms requires a plan with the forms.download feature (toggle on the USCIS form templates page)."],
    ["comments.customer_private_enabled", "true", "comments", "Customer private notes", "Allow customers to mark case comments as private (hidden from consultants AND admins)."],
    ["comments.consultant_hide_from_customer_enabled", "true", "comments", "Consultant hidden comments", "Allow consultants to hide case comments from the customer. Admins always see consultant comments."],
    ["comments.admin_hide_from_customer_enabled", "true", "comments", "Admin internal comments", "Allow admins to mark case comments as internal (hidden from the customer, visible to consultants)."],
    ["mail.host", "", "mail", "SMTP host", "Leave empty to disable outbound email (reset links are then shown to admins for manual delivery)."],
    ["mail.port", "587", "mail", "SMTP port", ""],
    ["mail.username", "", "mail", "SMTP username", ""],
    ["mail.password", "", "mail", "SMTP password", ""],
    ["mail.from", "", "mail", "From address", "e.g. MyImmigration <no-reply@myimmigration.com>"],
    ["mail.secure", "false", "mail", "SMTP TLS (implicit)", "true for port 465, false for STARTTLS on 587."],
  ];
  for (const [key, value, group, label, description] of settings) {
    await db.setting.upsert({
      where: { key },
      update: {},
      create: { key, value, group, label, description, type: key.includes("secret") ? "secret" : "text" },
    });
  }
}

async function seedAdmin() {
  const email = process.env.SEED_ADMIN_EMAIL ?? "admin@myimmigration.com";
  const password = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe!2026";
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
      areas: ["admin.dashboard", "admin.ai", "admin.pipelines", "admin.knowledge", "admin.cases"],
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
    ["letters.generate", "Response-letter generator", "letters", 8],
    ["deadlines.reminders", "Deadline tracking & reminders", "deadlines", 9],
    ["vault.storage", "Secure document vault", "documents", 10],
    ["forms.wizard", "Simplified USCIS form wizards", "forms", 11],
    ["consultant.referral", "immigration professional referral service", "consultants", 12],
    ["guide.chatbot", "Personal case guide chatbot", "assistant", 13],
    ["case.report", "Downloadable full case report (with document copies)", "analysis", 14],
    ["forms.download", "Downloadable completed USCIS forms", "forms", 15],
  ];
  for (const [key, name, category, sortOrder] of features) {
    await db.featureDef.upsert({ where: { key }, update: {}, create: { key, name, category, sortOrder } });
  }
  // Corrective renames for existing installs: customer-facing copy must never
  // reference AI models (standard product-language policy).
  await db.featureDef.updateMany({ where: { key: "case.analysis", name: "AI case analysis" }, data: { name: "In-depth case analysis" } });
  await db.featureDef.updateMany({ where: { key: "qa.chat" }, data: { name: "Immigration Q&A assistant" } });
  await db.subscriptionPlan.updateMany({
    where: { description: { contains: "AI-matched client assignments" } },
    data: { description: "For immigration professional partners: receive expertly matched client assignments and manage them in your workspace." },
  });

  const plans = [
    {
      key: "free",
      name: "Free",
      description: "Understand what's going on — no credit card needed.",
      priceMonthlyCents: 0,
      priceYearlyCents: 0,
      sortOrder: 0,
      badge: "",
      features: {
        "notice.upload": { enabled: true, limit: 2 },
        "notice.explain": { enabled: true, limit: 2 },
        "documents.upload": { enabled: true, limit: 5 },
        "case.analysis": { enabled: true, limit: 1 },
        "qa.chat": { enabled: true, limit: 10 },
        "vault.storage": { enabled: true, limit: 5 },
        "deadlines.reminders": { enabled: true, limit: null },
      },
    },
    {
      key: "plus",
      name: "Plus",
      description: "The full toolkit for handling one immigration situation end to end.",
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
        "letters.generate": { enabled: true, limit: 3 },
        "deadlines.reminders": { enabled: true, limit: null },
        "vault.storage": { enabled: true, limit: null },
        "forms.wizard": { enabled: true, limit: null },
        "guide.chatbot": { enabled: true, limit: null },
        "forms.download": { enabled: true, limit: null },
      },
    },
    {
      key: "pro",
      name: "Pro",
      description: "Everything, unlimited — plus professional referrals.",
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
        "letters.generate": { enabled: true, limit: null },
        "deadlines.reminders": { enabled: true, limit: null },
        "vault.storage": { enabled: true, limit: null },
        "forms.wizard": { enabled: true, limit: null },
        "consultant.referral": { enabled: true, limit: null },
        "guide.chatbot": { enabled: true, limit: null },
        "case.report": { enabled: true, limit: null },
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
      description: "Analyzes the user's situation summary with 2–3 models (fact extractor, case interpreter, skeptic) and merges results into one simple result.",
      steps: [
        { provider: "OpenAI GPT-5.6 Sol", role: "fact_extractor", prompt: DEFAULT_PROMPTS.fact_extractor, order: 0 },
        { provider: "Anthropic Claude Sonnet 5", role: "interpreter", prompt: DEFAULT_PROMPTS.interpreter, order: 1 },
        { provider: "Google Gemini 3.1 Pro", role: "skeptic", prompt: DEFAULT_PROMPTS.skeptic, order: 2 },
      ],
    },
    {
      key: "goal",
      name: "2 · Goal analysis",
      description: "Analyzes what the user wants to achieve and merges model outputs into a single result.",
      steps: [
        { provider: "OpenAI GPT-5.6 Sol", role: "fact_extractor", prompt: DEFAULT_PROMPTS.fact_extractor, order: 0 },
        { provider: "Anthropic Claude Sonnet 5", role: "interpreter", prompt: DEFAULT_PROMPTS.interpreter, order: 1 },
      ],
    },
    {
      key: "document",
      name: "3 · Document analysis",
      description: "Two models independently extract each document into the standardized MyImmigration schema; disagreements are marked 'verification required' — never guessed.",
      steps: [
        { provider: "Anthropic Claude Sonnet 5", role: "extractor_a", prompt: DEFAULT_PROMPTS.extractor_a, order: 0 },
        { provider: "Google Gemini 3.1 Pro", role: "extractor_b", prompt: DEFAULT_PROMPTS.extractor_b, order: 1 },
      ],
    },
    {
      key: "situation",
      name: "4 · Immigration situation analysis",
      description: "Grounded in the USCIS knowledge base: each model answers the same structured questions (issue, evidence, USCIS basis, conditions, confidence, professional review).",
      steps: [
        { provider: "OpenAI GPT-5.6 Sol", role: "analyst", prompt: DEFAULT_PROMPTS.analyst, order: 0 },
        { provider: "Anthropic Claude Opus 5", role: "reviewer", prompt: DEFAULT_PROMPTS.reviewer, order: 1 },
        { provider: "Google Gemini 3.1 Pro", role: "reviewer", prompt: DEFAULT_PROMPTS.reviewer, order: 2 },
      ],
    },
    {
      key: "presenter",
      name: "5 · Results presentation",
      description: "A single model converts internal analysis into structured JSON. The UI renders it deterministically — the AI never writes the customer's screen.",
      steps: [
        { provider: "OpenAI GPT-5.6 Terra", role: "presenter", prompt: DEFAULT_PROMPTS.presenter, order: 0 },
      ],
    },
    {
      key: "qa",
      name: "AI immigration Q&A",
      description: "Conversational assistant grounded in the USCIS knowledge base.",
      steps: [
        { provider: "OpenAI GPT-5.6 Sol", role: "assistant", prompt: DEFAULT_PROMPTS.assistant, order: 0 },
      ],
    },
    {
      key: "notice",
      name: "USCIS notice explanation",
      description: "Identifies notice type, form number, receipt number, important dates, and deadline; produces a plain-English explanation and next steps.",
      steps: [
        { provider: "Anthropic Claude Sonnet 5", role: "analyst", prompt: DEFAULT_PROMPTS.notice_explainer, order: 0 },
      ],
    },
    {
      key: "letter",
      name: "Response letter drafting",
      description: "Drafts a professional USCIS response letter the user reviews and edits.",
      steps: [
        { provider: "OpenAI GPT-5.6 Sol", role: "assistant", prompt: DEFAULT_PROMPTS.letter_writer, order: 0 },
      ],
    },
    {
      key: "guide",
      name: "In-account case guide",
      description: "The floating chatbot that coaches users through their next step. Models are tried in order until one answers — all five providers are chained by default.",
      steps: [
        { provider: "OpenAI GPT-5.6 Sol", role: "assistant", prompt: DEFAULT_PROMPTS.guide, order: 0 },
        { provider: "Anthropic Claude Sonnet 5", role: "assistant", prompt: DEFAULT_PROMPTS.guide, order: 1 },
        { provider: "Google Gemini 3.1 Pro", role: "assistant", prompt: DEFAULT_PROMPTS.guide, order: 2 },
        { provider: "Anthropic Claude Opus 5", role: "assistant", prompt: DEFAULT_PROMPTS.guide, order: 3 },
        { provider: "OpenAI GPT-5.6 Terra", role: "assistant", prompt: DEFAULT_PROMPTS.guide, order: 4 },
      ],
    },
    {
      key: "match",
      name: "Consultant matching",
      description: "Ranks candidate consultants for a case (specialty fit, experience, past cases, workload) on top of the deterministic score.",
      steps: [
        { provider: "OpenAI GPT-5.6 Sol", role: "analyst", prompt: DEFAULT_PROMPTS.match_rank, order: 0 },
        { provider: "Anthropic Claude Sonnet 5", role: "reviewer", prompt: DEFAULT_PROMPTS.match_rank, order: 1 },
      ],
    },
    {
      key: "match_reason",
      name: "Assignment recommendation reason",
      description: "Two models produce the recommendation shown to both parties: the first drafts a summary + detailed outline, the second reviews and refines it.",
      steps: [
        { provider: "OpenAI GPT-5.6 Sol", role: "analyst", prompt: DEFAULT_PROMPTS.match_reason, order: 0 },
        { provider: "Anthropic Claude Sonnet 5", role: "reviewer", prompt: DEFAULT_PROMPTS.match_reason_review, order: 1 },
      ],
    },
    {
      key: "closing",
      name: "Closing remarks & final review",
      description: "Writes the customer's closing summary when a case completes or is auto-closed: what was covered, what was resolved, and what to keep for their records.",
      steps: [
        { provider: "OpenAI GPT-5.6 Sol", role: "presenter", prompt: DEFAULT_PROMPTS.closing, order: 0 },
      ],
    },
  ];

  for (const s of stages) {
    const stage = await db.pipelineStage.upsert({
      where: { key: s.key },
      update: {},
      create: { key: s.key, name: s.name, description: s.description },
    });
    const stepCount = await db.pipelineStep.count({ where: { stageKey: stage.key } });
    if (stepCount === 0) {
      for (const step of s.steps) {
        await db.pipelineStep.create({
          data: {
            stageKey: stage.key,
            providerId: providers[step.provider],
            role: step.role,
            promptTemplate: step.prompt,
            sortOrder: step.order,
          },
        });
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
      body: `Q: Is MyImmigration the USCIS or a law firm?
No. MyImmigration is a immigration case assistant that explains your situation and guides your next steps in plain English. For high-stakes decisions we connect you with licensed professionals.

Q: How do I check my USCIS case?
Use your USCIS receipt number at the official USCIS case status site or sign in at my.uscis.gov when available. Upload receipts and notices here so we can organize the case timeline.

Q: What happens to documents I upload?
They're stored in your private vault. Only you can see them — and a consultant only after you explicitly approve the connection. You can delete files or your whole account anytime.

Q: How does the analysis work?
We extract facts from your answers and documents, compare them with USCIS reference material, and turn everything into issues and a step-by-step plan. When something can't be verified, we say so — we never guess.

Q: Can MyImmigration file with USCIS for me?
No. MyImmigration helps organize information and prepare draft materials for review. You are responsible for filings, and complex or high-stakes matters should be reviewed by a licensed immigration attorney or accredited representative.

Q: How do I cancel my subscription?
Plan & billing → Cancel subscription. You keep access until the end of the paid period.

Q: Something in the app isn't working.
Open a tech support ticket under Support tickets (or ask the guide chatbot to create one) and our team will fix it.

(Edit this FAQ in the admin backend under Content & agreements.)`,
    },
    {
      slug: "how-it-works",
      title: "How it works",
      kind: "page",
      body: `MyImmigration helps you understand and resolve immigration situations in plain English.

1. Tell us what happened — in your own words.
2. Tell us your goal — what a great outcome looks like.
3. Add documents — USCIS notices, receipts, forms, visas, passports, RFEs, and evidence.

Our analysis engine breaks your situation into clear issues, checks facts against your documents, and builds a step-by-step path forward. When facts can't be verified, we say so — we never guess.

If your case needs a licensed professional, we can help prepare a handoff to an immigration attorney, accredited representative, or vetted immigration professional — only with your approval.`,
    },
    {
      slug: "terms-of-service",
      title: "Terms of Service",
      kind: "terms",
      body: `Welcome to MyImmigration. By using this service you agree to these terms.

1. MyImmigration is an immigration case assistant, not USCIS, a law firm, or a government agency. We help you understand your immigration situation and USCIS documents; we do not provide legal advice.
2. You are responsible for the accuracy of the information you provide and for any filings or responses you make.
3. Analysis results are informational. Verify important dates, deadlines, eligibility, and filing requirements against official USCIS records or qualified professional advice.
4. You may delete your documents and your account at any time.

(Replace this placeholder text with your reviewed terms in the admin backend.)`,
    },
    {
      slug: "privacy-policy",
      title: "Privacy Policy",
      kind: "privacy",
      body: `Your privacy matters.

- We collect only the basic information needed to run your account: name, email, phone (optional), and the documents you choose to upload.
- Your documents are visible only to you, and to a consultant only after you explicitly approve the connection.
- You can delete your files and your entire profile at any time.

(Replace this placeholder text with your reviewed policy in the admin backend.)`,
    },
    {
      slug: "user-agreement",
      title: "User Agreement",
      kind: "agreement_user",
      body: `By creating a MyImmigration account you acknowledge:

1. MyImmigration is an immigration case assistant that provides plain-English informational guidance, not legal advice.
2. Information you provided before registering will be attached to your account and visible only to you.
3. You control your data: you can delete documents or your entire account at any time.
4. You will verify important dates, deadlines, and filing requirements against official USCIS records before acting.`,
    },
    {
      slug: "consultant-agreement",
      title: "Consultant Partner Agreement",
      kind: "agreement_consultant",
      body: `By registering as a Immigration Consultant partner you agree:

1. The credentials you provide are accurate and current, and you will keep them updated.
2. You will handle client materials confidentially and only for the engaged purpose.
3. Client connections require the client's explicit consent before any material is shared.
4. MyImmigration may verify your credentials and approve or suspend partner accounts at its discretion.`,
    },
    {
      slug: "connection-agreement",
      title: "Client–Consultant Connection Agreement",
      kind: "agreement_connection",
      body: `This agreement governs the connection between a MyImmigration user and a consultant.

1. Both parties must accept before any sensitive material is shared.
2. The consultant may view the client's cases and shared documents solely to assist with the client's immigration situation.
3. Either party or a MyImmigration administrator may revoke the connection at any time, ending access immediately.
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
      content: "Form N-400 is used to apply for naturalization. A review should consider lawful permanent resident period, continuous residence, physical presence, good moral character, selective service if applicable, tax and support obligations, trips outside the United States, and interview/civics requirements. Complex issues should be reviewed by a qualified professional.",
    },
  ];

  for (const source of sources) {
    const exists = await db.knowledgeSource.findFirst({ where: { title: source.title } });
    if (!exists) await db.knowledgeSource.create({ data: source });
  }
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
          { key: "issues", label: "Any arrests, citations, tax, or support issues to review?", type: "textarea" },
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
    await db.irsFormTemplate.upsert({
      where: { formNumber: data.formNumber },
      update: {
        ...data,
        stepsJson: JSON.stringify(steps),
        isPublished: true,
      },
      create: {
        ...data,
        stepsJson: JSON.stringify(steps),
        isPublished: true,
      },
    });
  }
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
  await seedFormTemplates();
  await seedCannedResponses();
  await seedMessageTemplates();
  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
