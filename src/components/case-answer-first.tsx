import {
  caseMustAnswerBeforeClarify,
  composeAssistantView,
  parseStoredIntelligence,
  runConversationIntelligence,
} from "@/lib/conversation";
import { AssistantReplyBlocks } from "@/components/assistant-reply";

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
  const stored = parseStoredIntelligence(intelligenceJson);
  if (stored?.question_contract && stored?.strategy) intel = stored;

  const sections = composeAssistantView(intel, `${situation}\n${goal}`);
  if (sections.length === 0) return null;

  return (
    <section className="mb-6 rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50/90 to-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-slate-900">What we can tell you now</h2>
      <p className="mt-0.5 text-sm text-slate-500">
        Answer first — then only the facts that change which path applies. Documents can come later to confirm.
      </p>
      <div className="mt-4">
        <AssistantReplyBlocks sections={sections} />
      </div>
    </section>
  );
}
