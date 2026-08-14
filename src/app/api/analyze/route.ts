import { NextRequest, NextResponse } from "next/server";
import { analyzeCase } from "@/lib/agents";
import { CaseGoal } from "@/types/case";

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      narrative,
      goals,
      documents,
    }: {
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
    return NextResponse.json(analysis);
  } catch (err) {
    console.error("Analysis error:", err);
    return NextResponse.json(
      { error: "An error occurred during analysis. Please try again." },
      { status: 500 }
    );
  }
}
