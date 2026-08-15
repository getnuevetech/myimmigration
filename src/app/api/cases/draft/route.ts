import { NextRequest, NextResponse } from "next/server";
import { getOrCreateGuestSession } from "@/lib/guest-session";
import { upsertGuestCaseDraft } from "@/lib/cases";
import { CaseGoal } from "@/types/case";
import { getCurrentUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      caseId,
      narrative,
      goals,
    }: {
      caseId?: string;
      narrative: string;
      goals: CaseGoal[];
    } = body;

    if (!narrative || narrative.trim().length < 10) {
      return NextResponse.json(
        { error: "Please provide your immigration story." },
        { status: 400 }
      );
    }

    if (!goals || goals.length === 0) {
      return NextResponse.json(
        { error: "Please select at least one goal." },
        { status: 400 }
      );
    }

    const [session, user] = await Promise.all([
      getOrCreateGuestSession(),
      getCurrentUser(),
    ]);
    const record = await upsertGuestCaseDraft({
      caseId,
      guestSessionId: session.id,
      narrative,
      goals,
      userId: user?.id ?? session.linkedUserId,
    });

    return NextResponse.json({ caseId: record.id });
  } catch {
    return NextResponse.json(
      { error: "We could not save your case right now." },
      { status: 500 }
    );
  }
}
