import { NextResponse } from "next/server";
import { getOrCreateGuestSession } from "@/lib/guest-session";
import { getPersistedCase } from "@/lib/cases";

export async function GET(
  _req: Request,
  context: { params: Promise<{ caseId: string }> }
) {
  try {
    const { caseId } = await context.params;
    const session = await getOrCreateGuestSession();
    const result = await getPersistedCase({
      caseId,
      guestSessionId: session.id,
      userId: session.linkedUserId,
    });

    if (!result) {
      return NextResponse.json({ error: "Case not found." }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "We could not load your case." },
      { status: 500 }
    );
  }
}
