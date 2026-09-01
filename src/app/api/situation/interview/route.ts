import { NextResponse } from "next/server";
import {
  answerSituationInterviewAction,
  getSituationInterviewNextAction,
} from "@/actions/situation-interview";

/**
 * Phase SI-2 — iterative Question Director bridge.
 * POST { situationId, action: "next" | "answer", candidateId?, answer? }
 */
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const situationId = String(body.situationId ?? "");
  const action = String(body.action ?? "next");
  if (!situationId) return NextResponse.json({ ok: false, error: "situationId required" }, { status: 400 });

  if (action === "answer") {
    const res = await answerSituationInterviewAction(
      situationId,
      String(body.candidateId ?? ""),
      String(body.answer ?? ""),
    );
    return NextResponse.json(res, { status: res.ok ? 200 : 400 });
  }

  const res = await getSituationInterviewNextAction(situationId);
  return NextResponse.json(res, { status: res.ok ? 200 : 400 });
}
