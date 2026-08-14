import { NextRequest, NextResponse } from "next/server";
import { analyzeCase } from "@/lib/agents";
import { getOrCreateGuestSession } from "@/lib/guest-session";
import { getCaseAccess } from "@/lib/subscriptions";
import { saveAnalysisForCase, upsertGuestCaseDraft } from "@/lib/cases";
import { CaseGoal } from "@/types/case";

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      caseId,
      narrative,
      goals,
      documents,
    }: {
      caseId?: string;
      narrative: string;
      goals: CaseGoal[];
      documents: { name: string; text: string }[];
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

    const analysis = await analyzeCase(narrative, goals, documents ?? []);
    try {
      const session = await getOrCreateGuestSession();
      const record = await upsertGuestCaseDraft({
        caseId,
        guestSessionId: session.id,
        narrative,
        goals,
        userId: session.linkedUserId,
      });

      await saveAnalysisForCase({
        caseId: record.id,
        userId: session.linkedUserId,
        documents: documents ?? [],
        analysis,
      });

      const access = await getCaseAccess(session.linkedUserId);
      return NextResponse.json({
        caseId: record.id,
        analysis,
        access,
      });
    } catch {
      return NextResponse.json({
        caseId: null,
        analysis,
        access: {
          level: "preview",
          previewLimit: 1,
          requiresRegistration: true,
          requiresUpgrade: false,
          canExport: false,
        },
      });
    }
  } catch (err) {
    console.error("Analysis error:", err);
    return NextResponse.json(
      { error: "An error occurred during analysis. Please try again." },
      { status: 500 }
    );
  }
}
