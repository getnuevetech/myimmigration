# MyImmigration — Immigration Case Intelligence Platform

An AI-powered immigration case intelligence and preparation platform. Users tell their immigration story, upload documents, and receive a structured case dashboard with plain-language explanations, timeline reconstruction, issue detection, and next steps.

> **Not a law firm. Not legal advice.** This platform provides informational analysis and document organization only.

## Features

- **Narrative Input** — Write your immigration story naturally; AI structures it into a chronology
- **Goal Selector** — Choose what you need help with (status understanding, RFE prep, interview prep, etc.)
- **Document Upload** — Upload I-797s, I-485, I-130, I-765, RFEs, visa pages, and more
- **Multi-AI Pipeline** — 5 specialized AI agents handle extraction, reconstruction, research, analysis, and explanation
- **Case Dashboard** — Health indicator, timeline, findings checklist, inconsistency detection, plain-language summary
- **Attorney Handoff** — Export a complete case package for your immigration attorney

## Getting Started

```bash
npm install
cp .env.example .env.local
# Add your OPENAI_API_KEY to .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## AI Pipeline

| Agent | Role |
|---|---|
| Document Intelligence | Extract receipt numbers, A-numbers, dates, form types, statuses, deadlines |
| Case Reconstruction | Build structured timeline from narrative + documents |
| Immigration Research | Retrieve relevant USCIS policy context |
| Case Analyst | Cross-compare facts, documents, research, and user goals to surface issues |
| Explanation Engine | Convert analysis into plain language |

## Tech Stack

- **Next.js 14** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **OpenAI GPT-4o**
- **Lucide React** (icons)

## Legal Notice

This platform is for informational and organizational purposes only. It does not constitute legal advice and does not create an attorney-client relationship. Please consult a licensed immigration attorney or accredited representative before making any immigration decisions.
