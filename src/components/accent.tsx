import type { ReactNode } from "react";

// Editorial headline helper: words wrapped in *asterisks* render with the
// screenshot-style lime highlighter. When no markers are present, the final word is
// accented automatically — so admin-edited copy always gets the treatment.
export function Accent({ text, accentClass = "not-italic bg-lime-200 px-1 -mx-1" }: { text: string; accentClass?: string }) {
  let source = text;
  if (!/\*[^*]+\*/.test(source)) {
    const match = source.match(/^([\s\S]*?)(\S+?)([.!?…]*)$/);
    if (match && match[2]) source = `${match[1]}*${match[2]}*${match[3]}`;
  }
  const parts = source.split(/(\*[^*]+\*)/g);
  const nodes: ReactNode[] = parts.map((part, i) =>
    part.startsWith("*") && part.endsWith("*") ? (
      <em key={i} className={accentClass}>
        {part.slice(1, -1)}
      </em>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
  return <>{nodes}</>;
}

// Small uppercase kicker with the "NEW" pill and spaced label from the reference design.
export function Kicker({ children, light = false }: { children: ReactNode; light?: boolean }) {
  return (
    <p className={`flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.32em] ${light ? "text-lime-100" : "text-slate-400"}`}>
      <span className="rounded-full bg-lime-200 px-2.5 py-1 text-[9px] tracking-normal text-slate-900">
        New
      </span>
      <span>{children}</span>
    </p>
  );
}
