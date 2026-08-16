# MyImmigration

A friendly AI immigration case assistant that helps people understand USCIS notices, immigration documents, deadlines, and case questions in plain English — and turns every situation into a simple, step-by-step plan. MyImmigration is **not** USCIS and is **not** a law firm; it is an informational guidance tool with optional referral or handoff to vetted immigration professionals.

## What's in V1

| Feature | Status |
| --- | --- |
| Upload / photograph USCIS notices | ✅ |
| Identify notice type, filing context, important dates, and deadlines | ✅ |
| Plain-English explanations + personalized next steps | ✅ |
| AI immigration Q&A (guest-friendly) | ✅ |
| Upload & explain USCIS notices, receipts, forms, visas, passports, RFEs, and evidence | ✅ |
| Response-letter generator (user reviews & mails) | ✅ |
| Deadline reminders | ✅ |
| Private document vault (user-deletable) | ✅ |
| Immigration professional referral with mutual-consent connection | ✅ |
| Simplified "video-game" USCIS form wizards → regenerated standard forms | ✅ |
| Subscriptions with admin-controlled feature access | ✅ |
| File with USCIS or provide legal representation | ❌ (later) |

## Architecture

Six layers, exactly as designed:

1. **Customer input** — situation + goal + documents. Works without an account; a guest session stores everything and attaches it to the user's account on registration.
2. **Document intelligence** — two independent AI extractors (e.g. Claude + Gemini) map each document into the standardized MyImmigration schema.
3. **Fact normalization** — parsed model outputs merged field-by-field.
4. **Immigration intelligence** — analysis grounded in an admin-curated **USCIS knowledge base** (forms, instructions, notices, timelines, evidence rules, and interview/RFE guidance), answered as structured questions (issue, evidence, USCIS basis, conditions, confidence, professional review).
5. **Verification** — a deterministic consensus engine: agreement merges, disagreement is flagged **"verification required"** (never guessed). Case readiness (0–100%) is computed by our own formula: documents + verified facts + USCIS source confirmation − contradictions.
6. **MyImmigration UI** — models return JSON only; the frontend renders evidence cards, product states (✓ Resolved, ◐ Review, ! Action Needed, ▲ Urgent, ? Information Needed), timelines, deadlines, and progress deterministically. The AI never writes the customer's screen.

If no AI provider is configured yet, the platform runs in a labeled deterministic fallback mode so the product remains usable end-to-end.

### Nothing is hardcoded

Every business variable is managed from the admin backend (`/admin`):

- **AI providers** — add 3–5 providers (OpenAI-compatible, Anthropic, Google) with base URL, API key, model, tokens, temperature.
- **AI pipelines** — per stage (summary, goal, document, situation, presenter, Q&A, notice, letter), pick which providers run, in which role (fact extractor / interpreter / skeptic / extractor A+B / analyst / reviewer / presenter), with fully editable prompt templates.
- **Plans & access control** — plan CRUD plus a feature/limit matrix gating every app capability by subscription level.
- **Payment gateways** — pluggable gateway configs (Stripe, PayPal, manual/dev) stored as JSON config; no vendor keys in code.
- **Content & agreements** — terms, privacy, policy, legal, blog, and the three versioned agreements (user, consultant, user↔consultant connection) with acceptance tracking.
- **USCIS form templates** — wizard steps (JSON) + output templates that regenerate the standard form layout.
- **USCIS knowledge base** — the authoritative material AI analysis cites.
- **App settings** — branding, hero copy, disclaimer, OAuth keys, URLs, analysis parameters, consultant auto-approval rules.
- **Admin roles** — the super admin can create sub-admins scoped to specific admin areas.

### User types

- **Admin** — super admin + granular sub-admin roles.
- **Regular users** — guest-first onboarding; registration (email compulsory; Google OAuth optional) with agreement checkbox; basic profile (name, address, phone, optional ID, bio, avatar); can delete files and their entire profile at will.
- **Immigration professionals / consultants** — onboarding for attorneys, accredited representatives, or qualified consultants, including credentials, specialties, languages, and proof uploads. Manual admin approval with optional auto-approval rules. Client assignments require **both** the user's and the consultant's explicit consent before anything is shared.

## Stack

Next.js 15 (App Router, server actions) · TypeScript · Tailwind CSS 4 · Prisma + PostgreSQL · JWT sessions (jose) · bcryptjs.

## Getting started (development)

Requires Node.js 20+ and a PostgreSQL database (`createdb myimmigration`).

```bash
npm install
cp .env.example .env        # point DATABASE_URL at your PostgreSQL instance
npx prisma migrate deploy   # create the schema
npm run db:seed             # seed settings, plans, pipelines, content, forms, knowledge
npm run dev
```

## Deploying to a local server

See **[DEPLOYMENT.md](./DEPLOYMENT.md)** — one-command Docker Compose stack (app + PostgreSQL + persistent volumes), or a bare-metal script (`sudo bash scripts/deploy-local.sh`) that installs PostgreSQL, migrates, seeds, builds, and sets up a systemd service.

- App: http://localhost:3000
- Admin: http://localhost:3000/admin — seeded super admin: `admin@myimmigration.com` / `ChangeMe!2026` (override with `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`; change immediately).

To enable real AI analysis, sign in as admin → **AI providers** → paste API keys for the seeded provider slots (or add your own), then review **AI pipelines**.
