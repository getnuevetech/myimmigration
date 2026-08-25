"use client";

import { useState, useEffect } from "react";
import { PUBLIC_HERO_CAROUSEL } from "@/lib/goal-public";

// Crossfading hero imagery. The image list is admin-managed via the
// home.hero_images setting (JSON array of URLs/paths). Overlay copy is
// options-first so the public funnel does not sell a filed USCIS case.
export function HeroCarousel({ images, intervalMs = 5000 }: { images: string[]; intervalMs?: number }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (images.length <= 1) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % images.length), intervalMs);
    return () => clearInterval(t);
  }, [images.length, intervalMs]);

  if (images.length === 0) return null;

  return (
    <div className="relative">
      <div className="relative aspect-[4/3] overflow-hidden rounded-3xl bg-gradient-to-br from-lime-50 via-lime-50 to-stone-100 shadow-2xl ring-1 ring-lime-100">
        {images.map((src, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={src}
            src={src}
            alt="ImmigrationOnMe makes immigration matters feel simple"
            className={`absolute inset-0 h-full w-full object-cover opacity-30 mix-blend-multiply transition-opacity duration-1000 ${i === index ? "opacity-100" : "opacity-0"}`}
          />
        ))}
        <div className="absolute inset-0 bg-gradient-to-br from-white/80 via-lime-50/80 to-lime-100/70" />
        <div className="absolute inset-x-8 top-8 rounded-3xl border border-lime-100 bg-white/90 p-5 shadow-xl backdrop-blur">
          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-lime-500">
            {PUBLIC_HERO_CAROUSEL.kicker}
          </p>
          <div className="mt-4 space-y-3">
            {PUBLIC_HERO_CAROUSEL.cards.map(({ title, body }) => (
              <div key={title} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                <p className="text-sm font-semibold text-slate-900">{title}</p>
                <p className="text-xs text-slate-500">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Floating product chips for a software feel */}
      <div className="absolute -left-5 top-6 hidden rounded-2xl bg-white px-4 py-3 shadow-lg ring-1 ring-slate-200 sm:block">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{PUBLIC_HERO_CAROUSEL.readinessLabel}</p>
        <div className="mt-1 flex items-center gap-2">
          <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full w-[38%] rounded-full bg-lime-300" />
          </div>
          <span className="text-xs font-bold text-slate-800">{PUBLIC_HERO_CAROUSEL.readinessValue}</span>
        </div>
      </div>
      <div className="absolute -right-4 bottom-16 hidden rounded-2xl bg-white px-4 py-3 shadow-lg ring-1 ring-slate-200 sm:block">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-lime-100 text-[10px] font-bold text-lime-700">✓</span>
          {PUBLIC_HERO_CAROUSEL.checklistTitle}
        </p>
        <p className="mt-0.5 text-[10px] text-slate-400">{PUBLIC_HERO_CAROUSEL.checklistMeta}</p>
      </div>

      {images.length > 1 && (
        <div className="mt-4 flex justify-center gap-2">
          {images.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              aria-label={`Show image ${i + 1}`}
              className={`h-2 rounded-full transition-all ${i === index ? "w-6 bg-lime-300" : "w-2 bg-slate-300 hover:bg-slate-400"}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
