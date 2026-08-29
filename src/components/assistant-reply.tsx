import type { AssistantViewSection } from "@/lib/conversation/assistant-composer";

/** Renders structured Pipeline A answer blocks (branches, ask, disclaimer). */
export function AssistantReplyBlocks({ sections }: { sections: AssistantViewSection[] }) {
  return (
    <div className="space-y-3">
      {sections.map((section, index) => {
        if (section.type === "paragraph") {
          return (
            <p key={index} className="text-sm leading-relaxed text-slate-700">
              {section.text}
            </p>
          );
        }
        if (section.type === "branches") {
          return (
            <div key={index}>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{section.intro}</p>
              <ul className="mt-2 space-y-2">
                {section.branches.map((branch) => (
                  <li
                    key={branch.id}
                    className="rounded-xl border border-emerald-100 bg-white/80 px-3 py-2.5 text-sm text-slate-700"
                  >
                    <span className="font-semibold text-slate-900">{branch.condition}</span>
                    <span className="mt-0.5 block text-slate-600">{branch.explanation}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        }
        if (section.type === "ask") {
          return (
            <div
              key={index}
              className="rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2.5 text-sm text-amber-950"
            >
              <p className="font-medium">{section.question}</p>
              {section.reason ? (
                <p className="mt-1 text-xs text-amber-800/90">Why this matters: {section.reason}</p>
              ) : null}
            </div>
          );
        }
        return (
          <p key={index} className="text-xs leading-relaxed text-slate-500">
            {section.text}
          </p>
        );
      })}
    </div>
  );
}

/** Soft-format stored assistant text: strip leftover markdown emphasis markers. */
export function AssistantMessageText({ content }: { content: string }) {
  const cleaned = content
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .trim();
  return <div className="whitespace-pre-wrap text-sm leading-relaxed">{cleaned}</div>;
}
