import Link from "next/link";
import { SiteHeader, SiteFooter } from "@/components/site-nav";
import { ButtonLink } from "@/components/ui";
import { HeroCarousel } from "@/components/hero-carousel";
import { Accent, Kicker } from "@/components/accent";
import { getSettingsMap } from "@/lib/settings";
import { IconShield, IconSparkle, IconCheckCircle } from "@/components/icons";

export default async function HomePage() {
  const s = await getSettingsMap([
    "app.name",
    "app.tagline",
    "home.hero_title",
    "home.hero_subtitle",
    "home.cta_primary",
    "home.cta_secondary",
    "home.hero_images",
  ]);
  const appName = s["app.name"] ?? "MyImmigration";
  let heroImages: string[] = [];
  try {
    const parsed = JSON.parse(s["home.hero_images"] ?? "[]");
    if (Array.isArray(parsed)) heroImages = parsed.map(String);
  } catch {
    heroImages = [];
  }
  if (heroImages.length === 0) heroImages = ["/hero/hero-1.png", "/hero/hero-2.png", "/hero/hero-3.png"];

  const steps = [
    { n: "01", title: "Build the timeline", body: "Start with what you know: status history, filings, receipt numbers, notices, travel, interviews, and deadlines." },
    { n: "02", title: "Map the evidence", body: "Upload USCIS notices, receipts, forms, visas, passports, RFEs, translations, and supporting records into one organized vault." },
    { n: "03", title: "Leave with a case brief", body: "Get a structured summary, issue list, missing-document checklist, and professional-ready handoff packet." },
  ];

  const features = [
    { title: "Notice intelligence", body: "Identify the form, notice type, receipt number, response deadline, and evidence requested in a USCIS letter." },
    { title: "Case timeline builder", body: "Turn scattered filings, status changes, appointments, and approvals into a readable immigration history." },
    { title: "Evidence gap finder", body: "See what appears to be missing before you respond to an RFE, prepare for an interview, or organize an attorney handoff." },
    { title: "Deadline control", body: "Capture dates from notices and keep the next required action visible before it becomes urgent." },
    { title: "USCIS form preparation", body: "Use guided worksheets for common immigration forms and keep draft answers organized for review." },
    { title: "Professional-ready packet", body: "Package the timeline, notices, documents, and questions so an attorney or accredited representative can move faster." },
  ];

  const trust = [
    { icon: <IconShield className="h-5 w-5" />, text: "Private document vault with user-controlled deletion" },
    { icon: <IconSparkle className="h-5 w-5" />, text: "Evidence-first analysis built around your actual records" },
    { icon: <IconCheckCircle className="h-5 w-5" />, text: "Unverified facts stay flagged instead of being guessed" },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-[#fbfaf7]">
      <SiteHeader />
      <main className="flex-1">
        {/* Hero — editorial serif with italic accent, imagery right */}
        <section className="relative overflow-hidden border-b border-slate-200 bg-[#fbfaf7]">
          <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-4 py-16 lg:grid-cols-[1.1fr_0.9fr] lg:py-24">
            <div>
              <Kicker>{s["app.tagline"] ?? "Immigration paperwork, organized"}</Kicker>
              <h1 className="mt-6 font-serif text-5xl font-bold leading-[1.05] tracking-tight text-slate-900 sm:text-6xl xl:text-[4.2rem]">
                <Accent text={s["home.hero_title"] ?? "Turn immigration paperwork into a clear *case plan*."} />
              </h1>
              <p className="mt-6 max-w-md text-base leading-relaxed text-slate-600">
                {s["home.hero_subtitle"] ??
                  `${appName} organizes notices, forms, timelines, evidence gaps, and deadlines so you can understand what is happening and what to prepare next.`}
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <ButtonLink href="/start" className="rounded-full px-7 py-3.5 text-base shadow-lg shadow-orange-700/25">
                  {s["home.cta_primary"] ?? "Start a case review"} →
                </ButtonLink>
                <ButtonLink href="/start/qa" variant="secondary" className="rounded-full px-7 py-3.5 text-base">
                  {s["home.cta_secondary"] ?? "Ask an immigration question"}
                </ButtonLink>
              </div>
              <p className="mt-7 font-mono text-[11px] uppercase tracking-widest text-slate-400">
                Private by design &nbsp;·&nbsp; Evidence-first &nbsp;·&nbsp; Built for handoff
              </p>
            </div>
            <HeroCarousel images={heroImages} />
          </div>
        </section>

        {/* How it works — numbered editorial rows */}
        <section id="how-it-works" className="border-b border-slate-200 bg-[#eef1fb]">
          <div className="mx-auto max-w-6xl px-4 py-20">
            <div className="max-w-md">
              <h2 className="font-serif text-4xl font-bold leading-tight text-slate-900 sm:text-5xl">
                <Accent text="From scattered records to a *case brief*" />
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-slate-600">
                A durable workflow for notices, deadlines, evidence, and professional review.
              </p>
            </div>
            <div className="mt-12 divide-y divide-slate-300/60 border-t border-slate-300/60">
              {steps.map((step) => (
                <div key={step.n} className="grid gap-3 py-9 md:grid-cols-[100px_1fr_1.2fr] md:items-baseline md:gap-8">
                  <p className="font-serif text-4xl font-medium italic text-orange-600">{step.n}</p>
                  <h3 className="font-serif text-2xl font-bold text-slate-900">{step.title}</h3>
                  <p className="text-sm leading-relaxed text-slate-600">{step.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* What you get — sticky heading left, numbered list right */}
        <section id="what-you-get" className="border-b border-slate-200 bg-[#fbfaf7]">
          <div className="mx-auto grid max-w-6xl gap-14 px-4 py-20 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="lg:sticky lg:top-24 lg:self-start">
              <Kicker>What you get</Kicker>
              <h2 className="mt-5 font-serif text-4xl font-bold leading-tight text-slate-900 sm:text-5xl">
                <Accent text="A workspace for the immigration details that *matter*" />
              </h2>
              <p className="mt-4 max-w-xs text-sm leading-relaxed text-slate-600">
                Structured enough for professionals, readable enough for families.
              </p>
              <ul className="mt-8 space-y-2.5">
                {trust.map((t) => (
                  <li key={t.text} className="flex items-center gap-2.5 text-sm text-slate-600">
                    <span className="text-emerald-600">{t.icon}</span>
                    {t.text}
                  </li>
                ))}
              </ul>
            </div>
            <div className="divide-y divide-slate-200 border-t border-slate-200">
              {features.map((f, i) => (
                <div key={f.title} className="group grid grid-cols-[56px_1fr] gap-4 py-8">
                  <p className="pt-1 font-mono text-xs text-slate-400">/ {String(i + 1).padStart(2, "0")}</p>
                  <div>
                    <h3 className={`font-serif text-2xl font-bold transition ${i === 0 ? "text-orange-600" : "text-slate-900 group-hover:text-orange-600"}`}>
                      {f.title}
                    </h3>
                    <p className="mt-2 max-w-lg text-sm leading-relaxed text-slate-600">{f.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Numbers */}
        <section className="border-b border-slate-200 bg-[#fbfaf7]">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 text-center sm:grid-cols-3">
            <div>
              <p className="font-serif text-6xl font-bold italic text-orange-600">9+</p>
              <p className="mt-2 text-sm text-slate-600">USCIS workflows organized into guided steps</p>
            </div>
            <div>
              <p className="font-serif text-6xl font-bold italic text-orange-600">5</p>
              <p className="mt-2 text-sm text-slate-600">Core record types: notices, forms, evidence, deadlines, questions</p>
            </div>
            <div>
              <p className="font-serif text-6xl font-bold italic text-orange-600">100%</p>
              <p className="mt-2 text-sm text-slate-600">user-controlled document ownership</p>
            </div>
          </div>
        </section>

        {/* Dark closing CTA, flowing into the dark footer */}
        <section className="bg-[#0b1322]">
          <div className="mx-auto max-w-6xl px-4 pb-4 pt-20">
            <h2 className="max-w-2xl font-serif text-4xl font-bold leading-tight text-white sm:text-5xl">
              <Accent text="Have a USCIS notice you do not want to *misread*?" accentClass="font-serif italic text-orange-400" />
            </h2>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-slate-400">
              Upload it now. Build a timeline, extract the requested evidence, and prepare the next conversation with confidence.
            </p>
            <div className="mt-8">
              <ButtonLink href="/start" className="rounded-full px-8 py-3.5 text-base shadow-lg shadow-orange-700/30">
                Start free →
              </ButtonLink>
            </div>
            <p className="mt-6 text-sm text-slate-400">
              Are you a immigration professional or immigration consultant?{" "}
              <Link href="/register?type=consultant" className="font-semibold text-white underline decoration-slate-500 underline-offset-4 hover:decoration-white">
                Join our partner network
              </Link>
            </p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
