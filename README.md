# MyImmigration — Immigration Case Intelligence Platform

An AI-powered immigration case intelligence and preparation platform. Users tell their immigration story, upload documents, and receive a structured case dashboard with plain-language explanations, timeline reconstruction, issue detection, and next steps.

> **Not a law firm. Not legal advice.** This platform provides informational analysis and document organization only.

## Features

- **Narrative Input** — Write your immigration story naturally; AI structures it into a chronology
- **Goal Selector** — Choose what you need help with (status understanding, RFE prep, interview prep, etc.)
- **Document Upload** — Upload I-797s, I-485, I-130, I-765, RFEs, visa pages, and more
- **Configurable Multi-AI Pipeline** — staged orchestration with deterministic consensus/verification hooks
- **Case Dashboard** — Health indicator, timeline, findings checklist, inconsistency detection, plain-language summary
- **Attorney Handoff** — Export a complete case package for your immigration attorney
- **Admin Control Plane (foundation)** — `/admin` shell for AI providers, pipelines, plans, agreements, payment and settings modules
- **Persistence Foundation (Phase A)** — Prisma schema for users, guest sessions, cases, documents, subscriptions, consultant assignments, agreements, AI runs, and audit logs

## Getting Started

```bash
npm install
cp .env.example .env
# set DATABASE_URL (AI keys can be set in /admin/platform-settings)
npx prisma generate
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

For production Docker deployment on AWS Lightsail, see [DEPLOYMENT.md](./DEPLOYMENT.md).

To enable the admin shell route during development, set `ADMIN_PREVIEW_ENABLED=true`.

Set runtime variables (AI keys/models, app URL, auth/payment secrets) at `/admin/platform-settings`.

## AI Pipeline (redesign foundation)

| Stage | Intent |
|---|---|
| Summary | Convert user narrative into structured facts |
| Goal | Interpret user goals and constraints |
| Document | Extract and normalize structured data from uploaded evidence |
| Situation | Build case-level assessment with conflict/verification handling |
| Presentation | Deterministic customer output rendering inputs |

Current implementation includes deterministic merge behavior and disagreement flagging (`verification required`) as architecture groundwork.

## Data model foundation

The repository now includes `prisma/schema.prisma` for the redesign baseline. It introduces models for:

- Admin settings and role-based permissions
- AI providers and stage pipelines
- Users (admin/regular/consultant), guest sessions, and account-linking
- Cases, documents, analysis runs/results, and issue records
- Subscription plans, plan features, subscriptions, and payment transactions
- Consultant profiles, assignments, and consent tracking
- Agreement versioning/acceptance, USCIS form templates/submissions, notifications, and audit logs

## Tech Stack

- **Next.js 16** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **OpenAI SDK** (with staged orchestration fallback)
- **Prisma 6** (schema + generated client foundation)
- **Lucide React** (icons)

## Legal Notice

This platform is for informational and organizational purposes only. It does not constitute legal advice and does not create an attorney-client relationship. Please consult a licensed immigration attorney or accredited representative before making any immigration decisions.
