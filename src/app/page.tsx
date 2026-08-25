import Link from "next/link";
import type { ReactNode } from "react";
import { SiteHeader, SiteFooter } from "@/components/site-nav";
import { ButtonLink } from "@/components/ui";
import { HeroCarousel } from "@/components/hero-carousel";
import { Accent, Kicker } from "@/components/accent";
import { getSettingsMap } from "@/lib/settings";
import { IconShield, IconSparkle, IconCheckCircle } from "@/components/icons";
import { getUscisUpdates } from "@/lib/uscis-updates";
import {
  PUBLIC_CLOSING,
  PUBLIC_HOME_FEATURES,
  PUBLIC_HOME_STEPS,
  PUBLIC_HOW_IT_WORKS_HEADING,
  PUBLIC_HOW_IT_WORKS_INTRO,
  PUBLIC_UPDATES_HEADING,
  PUBLIC_UPDATES_INTRO,
  PUBLIC_WHY_IT_WORKS,
  resolvePublicHero,
} from "@/lib/goal-public";

function EditorialSection({
  number,
  label,
  children,
  className = "bg-[#fbfaf7]",
}: {
  number: string;
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`border-b border-slate-200 ${className}`}>
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 lg:grid-cols-[140px_1fr]">
        <aside className="lg:pt-1">
          <p className="font-serif text-7xl font-medium leading-none tracking-tight text-slate-900 sm:text-8xl">
            {number}
          </p>
          <div className="mt-5 flex items-center gap-3">
            <span className="h-px w-6 bg-lime-500" />
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.34em] text-slate-400">
              {label}
            </p>
          </div>
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </section>
  );
}

export default async function HomePage() {
  const s = await getSettingsMap([
    "app.tagline",
    "home.hero_title",
    "home.hero_subtitle",
    "home.cta_primary",
    "home.cta_secondary",
    "home.hero_images",
  ]);
  let heroImages: string[] = [];
  try {
    const parsed = JSON.parse(s["home.hero_images"] ?? "[]");
    if (Array.isArray(parsed)) heroImages = parsed.map(String);
  } catch {
    heroImages = [];
  }
  if (heroImages.length === 0) heroImages = ["/hero/hero-1.png", "/hero/hero-2.png", "/hero/hero-3.png"];
  const updates = await getUscisUpdates(3);
  const hero = resolvePublicHero(s);
  const steps = PUBLIC_HOME_STEPS;
  const features = PUBLIC_HOME_FEATURES;

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
              <Kicker>{hero.tagline}</Kicker>
              <h1 className="mt-6 font-serif text-5xl font-bold leading-[1.05] tracking-tight text-slate-900 sm:text-6xl xl:text-[4.2rem]">
                <Accent text={hero.title} />
              </h1>
              <p className="mt-6 max-w-md text-base leading-relaxed text-slate-600">
                {hero.subtitle}
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <ButtonLink href={hero.primaryCta.href} className="rounded-full px-7 py-3.5 text-base shadow-lg shadow-lime-700/25">
                  {hero.primaryCta.label} →
                </ButtonLink>
                <ButtonLink href={hero.secondaryCta.href} variant="secondary" className="rounded-full px-7 py-3.5 text-base">
                  {hero.secondaryCta.label}
                </ButtonLink>
              </div>
              <p className="mt-4 text-sm text-slate-500">
                <Link href={hero.letterLink.href} className="font-medium text-slate-700 underline decoration-slate-300 underline-offset-4 hover:decoration-lime-500">
                  {hero.letterLink.label}
                </Link>
              </p>
              <p className="mt-7 font-mono text-[11px] uppercase tracking-widest text-slate-400">
                Private by design &nbsp;·&nbsp; Evidence-first &nbsp;·&nbsp; Built for handoff
              </p>
            </div>
            <HeroCarousel images={heroImages} />
          </div>
        </section>

        {/* How it works — numbered editorial rows */}
        <div id="how-it-works">
          <EditorialSection number="01" label="How it works" className="bg-white">
            <div className="max-w-md">
              <h2 className="font-serif text-4xl font-bold leading-tight text-slate-900 sm:text-5xl">
                <Accent text={PUBLIC_HOW_IT_WORKS_HEADING} />
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-slate-600">
                {PUBLIC_HOW_IT_WORKS_INTRO}
              </p>
            </div>
            <div className="mt-12 divide-y divide-slate-300/60 border-t border-slate-300/60">
              {steps.map((step) => (
                <div key={step.n} className="grid gap-3 py-9 md:grid-cols-[100px_1fr_1.2fr] md:items-baseline md:gap-8">
                  <p className="font-serif text-4xl font-medium italic text-lime-600">{step.n}</p>
                  <h3 className="font-serif text-2xl font-bold text-slate-900">{step.title}</h3>
                  <p className="text-sm leading-relaxed text-slate-600">{step.body}</p>
                </div>
              ))}
            </div>
          </EditorialSection>
        </div>

        {/* What you get — sticky heading left, numbered list right */}
        <div id="what-you-get">
          <EditorialSection number="02" label="What you get">
            <div className="grid gap-14 lg:grid-cols-[0.85fr_1.15fr]">
              <div className="lg:sticky lg:top-24 lg:self-start">
              <Kicker>What you get</Kicker>
              <h2 className="mt-5 font-serif text-4xl font-bold leading-tight text-slate-900 sm:text-5xl">
                <Accent text="A workspace for the immigration details that *matter*" />
              </h2>
              <p className="mt-4 max-w-xs text-sm leading-relaxed text-slate-600">
                Structured enough for professionals, readable enough for families.
              </p>
            </div>
            <div className="divide-y divide-slate-200 border-t border-slate-200">
              {features.map((f, i) => (
                <div key={f.title} className="group grid grid-cols-[56px_1fr] gap-4 py-8">
                  <p className="pt-1 font-mono text-xs text-slate-400">/ {String(i + 1).padStart(2, "0")}</p>
                  <div>
                    <h3 className={`font-serif text-2xl font-bold transition ${i === 0 ? "text-lime-600" : "text-slate-900 group-hover:text-lime-600"}`}>
                      {f.title}
                    </h3>
                    <p className="mt-2 max-w-lg text-sm leading-relaxed text-slate-600">{f.body}</p>
                  </div>
                </div>
              ))}
            </div>
            </div>
          </EditorialSection>
        </div>

        {/* Numbers */}
        <EditorialSection number="03" label="Why it works" className="bg-lime-200">
          <h2 className="font-serif text-4xl font-bold leading-tight text-slate-900 sm:text-5xl">
            <Accent text="Built for clarity, not *panic*" />
          </h2>
          <div className="mt-10 grid gap-8 text-left sm:grid-cols-3">
            {PUBLIC_WHY_IT_WORKS.map((item) => (
              <div key={item.value}>
                <p className="font-serif text-6xl font-bold italic text-slate-900">{item.value}</p>
                <p className="mt-3 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">
                  {item.label}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-12 grid gap-4 border-t border-lime-200 pt-6 sm:grid-cols-3">
            {trust.map((item) => (
              <p key={item.text} className="flex items-center gap-2.5 text-sm text-slate-700">
                <span className="text-lime-700">{item.icon}</span>
                {item.text}
              </p>
            ))}
          </div>
        </EditorialSection>

        <EditorialSection number="04" label="USCIS updates" className="bg-white">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <Kicker>Latest from USCIS</Kicker>
              <h2 className="mt-5 font-serif text-4xl font-bold leading-tight text-slate-900 sm:text-5xl">
                <Accent text={PUBLIC_UPDATES_HEADING} />
              </h2>
              <p className="mt-4 max-w-xl text-sm leading-relaxed text-slate-600">
                {PUBLIC_UPDATES_INTRO}
              </p>
            </div>
            <ButtonLink href="/uscis-updates" variant="secondary" className="rounded-full">View all updates →</ButtonLink>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {updates.length === 0 && (
              <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500 md:col-span-3">
                USCIS updates are temporarily unavailable. Check back soon.
              </p>
            )}
            {updates.map((update) => (
              <a key={update.url} href={update.url} target="_blank" rel="noreferrer" className="rounded-2xl border border-slate-200 bg-[#fbfaf7] p-5 transition hover:border-lime-300">
                <p className="text-xs font-semibold uppercase tracking-wide text-lime-600">
                  {update.publishedAt ? new Date(update.publishedAt).toLocaleDateString("en-US") : "USCIS update"}
                </p>
                <h3 className="mt-2 font-serif text-xl font-bold leading-snug text-slate-900">{update.title}</h3>
                <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-slate-600">{update.summary}</p>
              </a>
            ))}
          </div>
        </EditorialSection>

        {/* Dark closing CTA, flowing into the dark footer */}
        <section className="bg-[#0b1322]">
          <div className="mx-auto max-w-6xl px-4 pb-4 pt-20">
            <h2 className="max-w-2xl font-serif text-4xl font-bold leading-tight text-white sm:text-5xl">
              <Accent text={PUBLIC_CLOSING.title} accentClass="not-italic bg-lime-200 px-1 -mx-1 text-slate-950" />
            </h2>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-slate-400">
              {PUBLIC_CLOSING.body}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href={PUBLIC_CLOSING.optionsCta.href} className="rounded-full px-8 py-3.5 text-base shadow-lg shadow-lime-700/30">
                {PUBLIC_CLOSING.optionsCta.label}
              </ButtonLink>
              <ButtonLink href={PUBLIC_CLOSING.letterCta.href} variant="ghost" className="rounded-full border border-slate-500 px-8 py-3.5 text-base text-white hover:bg-slate-800">
                {PUBLIC_CLOSING.letterCta.label}
              </ButtonLink>
            </div>
            <p className="mt-6 text-sm text-slate-400">
              Are you an immigration professional or immigration consultant?{" "}
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
