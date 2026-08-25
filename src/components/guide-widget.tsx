"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import Link from "next/link";
import { askGuideAction } from "@/actions/support";
import type { GuideAction } from "@/lib/guide";
import { GUIDE_WIDGET_CHROME_DEFAULT, type GuideChrome } from "@/lib/goal-guide";

type Msg = { role: "user" | "assistant"; content: string; actions?: GuideAction[] };

export function GuideWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [pending, startTransition] = useTransition();
  const [chrome, setChrome] = useState<GuideChrome>(GUIDE_WIDGET_CHROME_DEFAULT);
  const bottomRef = useRef<HTMLDivElement>(null);
  const openedOnce = useRef(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  // Proactive account analysis on first open.
  useEffect(() => {
    if (open && !openedOnce.current) {
      openedOnce.current = true;
      startTransition(async () => {
        const reply = await askGuideAction([]);
        if (reply.chrome) setChrome(reply.chrome);
        setMessages([{ role: "assistant", content: reply.message, actions: reply.actions }]);
      });
    }
  }, [open]);

  const send = () => {
    const question = input.trim();
    if (!question || pending) return;
    setInput("");
    const next: Msg[] = [...messages, { role: "user" as const, content: question }];
    setMessages(next);
    startTransition(async () => {
      const reply = await askGuideAction(next.map((m) => ({ role: m.role, content: m.content })));
      if (reply.chrome) setChrome(reply.chrome);
      setMessages([...next, { role: "assistant", content: reply.message, actions: reply.actions }]);
    });
  };

  return (
    <>
      {/* Floating launcher */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={chrome.launcherLabel}
        className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-lime-600 text-white shadow-lg transition hover:bg-lime-700"
      >
        {open ? (
          <span className="text-xl leading-none">×</span>
        ) : (
          <span className="text-lg font-bold leading-none">?</span>
        )}
      </button>

      {open && (
        <div className="fixed bottom-24 right-5 z-40 flex h-[520px] w-[360px] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between bg-lime-600 px-4 py-3 text-white">
            <div>
              <p className="text-sm font-semibold">{chrome.title}</p>
              <p className="text-xs text-lime-200">{chrome.subtitle}</p>
            </div>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.map((m, i) => (
              <div key={i}>
                <div className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[90%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                      m.role === "user" ? "bg-lime-600 text-white" : "bg-slate-100 text-slate-800"
                    }`}
                  >
                    {m.content}
                  </div>
                </div>
                {m.actions && m.actions.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {m.actions.map((a, j) => (
                      <Link
                        key={j}
                        href={a.href}
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                          a.type === "upgrade" || a.type === "new_case"
                            ? "bg-lime-600 text-white hover:bg-lime-700"
                            : a.type === "ticket_tech" || a.type === "ticket_service"
                              ? "border border-lime-300 bg-lime-50 text-lime-800 hover:bg-lime-100"
                              : "border border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {a.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {pending && (
              <div className="flex justify-start">
                <div className="rounded-2xl bg-slate-100 px-3.5 py-2.5 text-sm text-slate-400">Thinking…</div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="border-t border-slate-200 p-3">
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder={chrome.placeholder}
                className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-lime-500 focus:outline-none focus:ring-2 focus:ring-lime-100"
              />
              <button
                onClick={send}
                disabled={pending || !input.trim()}
                className="rounded-xl bg-lime-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-lime-700 disabled:opacity-50"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
