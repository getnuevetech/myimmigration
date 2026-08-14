import { NextRequest, NextResponse } from "next/server";
import { getOrCreateGuestSession } from "@/lib/guest-session";
import { prisma } from "@/lib/db/prisma";
import { claimGuestCasesForUser } from "@/lib/cases";
import { ensureFreeSubscriptionForUser } from "@/lib/subscriptions";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      email,
      firstName,
      lastName,
      acceptedTerms,
    }: {
      email: string;
      firstName?: string;
      lastName?: string;
      acceptedTerms: boolean;
    } = body;

    if (!email?.trim()) {
      return NextResponse.json(
        { error: "Email is required to continue." },
        { status: 400 }
      );
    }

    if (!acceptedTerms) {
      return NextResponse.json(
        { error: "You must accept the terms to continue." },
        { status: 400 }
      );
    }

    const session = await getOrCreateGuestSession();
    const normalizedEmail = email.trim().toLowerCase();

    const user = await prisma.user.upsert({
      where: { email: normalizedEmail },
      update: {
        firstName: firstName?.trim() || undefined,
        lastName: lastName?.trim() || undefined,
        mustAcceptTos: false,
      },
      create: {
        email: normalizedEmail,
        firstName: firstName?.trim() || null,
        lastName: lastName?.trim() || null,
        type: "REGULAR",
        status: "PENDING",
        mustAcceptTos: false,
      },
    });

    await prisma.guestSession.update({
      where: { id: session.id },
      data: { linkedUserId: user.id },
    });

    await claimGuestCasesForUser(session.id, user.id);
    await ensureFreeSubscriptionForUser(user.id);

    return NextResponse.json({ userId: user.id });
  } catch {
    return NextResponse.json(
      { error: "We could not continue your case right now." },
      { status: 500 }
    );
  }
}
