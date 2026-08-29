import { caseMustAnswerBeforeClarify, composeAssistantReply, runConversationIntelligence } from "@/lib/conversation";

/** Shows Phase −1 provisional pathways / answer scaffold before clarify when required. */
export function CaseAnswerFirstPanel({
  situation,
  goal,
  intelligenceJson,
}: {
  situation: string;
  goal: string;
  intelligenceJson?: string | null;
}) {
  const must = caseMustAnswerBeforeClarify(situation, goal);
  if (!must) return null;

  let intel = runConversationIntelligence({ message: situation, goal });
  try {
    const stored = intelligenceJson ? JSON.parse(intelligenceJson) : null;
    if (stored?.question_contract && stored?.strategy) intel = stored;
  } catch {
    /* use fresh */
  }

  const body = composeAssistantReply(intel, `${situation}\n${goal}`);
  if (!body.trim()) return null;

  return (
    <section className="mb-6 rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50/90 to-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-slate-900">What we can tell you now</h2>
      <p className="mt-0.5 text-sm text-slate-500">
        Answer first — then only the facts that change which path applies. Documents can come later to confirm.
      </p>
      <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{body}</div>
    </section>
  );
}
