import { NextResponse } from "next/server";
import { getOrCreateGuestSession } from "@/lib/guest-session";
import { getPersistedCase } from "@/lib/cases";
import { getCurrentUser } from "@/lib/auth";

export async function GET(
  _req: Request,
  context: { params: Promise<{ caseId: string }> }
) {
  try {
    const { caseId } = await context.params;
    const [session, user] = await Promise.all([
      getOrCreateGuestSession(),
      getCurrentUser(),
    ]);
    const result = await getPersistedCase({
      caseId,
      guestSessionId: session.id,
      userId: user?.id ?? session.linkedUserId,
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
